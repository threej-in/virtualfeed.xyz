import { redditClient } from '../config/reddit';
import { subreddits, SubredditConfig } from '../config/subreddits';
import { VideoProcessor } from './videoProcessor';
import { logger } from './logger';
import Video from '../models/Video';
import { Submission, Listing } from 'snoowrap';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { DuplicateVideoDetector } from './duplicateVideoDetector';

export class RedditScraper {
    private static async processPost(post: Submission, subredditConfig: SubredditConfig): Promise<boolean> {
        try {
            // Log post details for debugging - only at debug level
            // 

            // Check if post has minimum score (more lenient now)
            if (post.score < subredditConfig.minScore) {
                // 
                return false;
            }
            
            // For AI-focused subreddits, we don't need to check for search terms
            const aiSubreddits = ['StableDiffusion', 'midjourney', 'sdforall', 'aivideo', 'AIGeneratedContent', 'aiArt'];
            const isAIFocusedSubreddit = aiSubreddits.includes(post.subreddit.display_name);
            
            // Check for required search terms (only for non-AI-focused subreddits)
            if (!isAIFocusedSubreddit) {
                const postText = `${post.title} ${post.selftext || ''} ${post.link_flair_text || ''}`.toLowerCase();
                
                // STRICT FILTERING: Require at least one primary AI term AND one secondary term
                const primaryAITerms = ['ai', 'artificial intelligence', 'generated', 'stable diffusion', 'midjourney', 'dall-e', 'sora', 'gpt', 'chatgpt', 'machine learning', 'neural network', 'deep learning', 'algorithm', 'automated', 'synthetic'];
                const secondaryTerms = ['video', 'created', 'made', 'produced', 'animation', 'render', 'generated', 'using', 'with', 'by', 'through'];
                
                // Check if post contains at least one primary AI term (using word boundaries)
                const hasPrimaryTerm = primaryAITerms.some(term => {
                    // Use word boundaries to prevent substring matches like "ai" in "rain"
                    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                    return regex.test(postText);
                });
                
                // Check if post contains at least one secondary term (using word boundaries)
                const hasSecondaryTerm = secondaryTerms.some(term => {
                    // Use word boundaries to prevent substring matches
                    const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                    return regex.test(postText);
                });
                
                // Only accept posts that have both a primary AI term AND a secondary term
                if (!(hasPrimaryTerm && hasSecondaryTerm)) {
                    logger.info(`Skipping post: Insufficient AI-related terms in title/description - Primary: ${hasPrimaryTerm}, Secondary: ${hasSecondaryTerm}`);
                    return false;
                }
                
                // Additional check: Ensure the primary AI term is actually referring to AI generation, not just mentioning AI
                const aiGenerationPatterns = [
                    /ai\s+(generated|created|made|produced|video|animation|render|using|with|by|through)/i,
                    /(generated|created|made|produced)\s+(by|with|using)\s+ai/i,
                    /(stable diffusion|midjourney|dall-e|sora)\s+(generated|created|made|produced|video|animation|render|using|with|by|through)/i,
                    /(generated|created|made|produced)\s+(by|with|using)\s+(stable diffusion|midjourney|dall-e|sora)/i,
                    /machine learning\s+(generated|created|made|produced)/i,
                    /neural network\s+(generated|created|made|produced)/i,
                    /deep learning\s+(generated|created|made|produced)/i,
                    /algorithm\s+(generated|created|made|produced)/i
                ];
                
                const hasAIGenerationPattern = aiGenerationPatterns.some(pattern => pattern.test(postText));
                
                if (!hasAIGenerationPattern) {
                    logger.info(`Skipping post: No clear AI generation pattern found in title/description`);
                    return false;
                }
            }

            // Check for excluded terms
            if (subredditConfig.excludeTerms && subredditConfig.excludeTerms.length > 0) {
                const postText = `${post.title} ${post.selftext || ''}`.toLowerCase();
                const hasExcludedTerm = subredditConfig.excludeTerms.some(term => postText.includes(term.toLowerCase()));
                if (hasExcludedTerm) {
                    // 
                    return false;
                }
            }

            // Process video URL
            let videoUrl = '';

            // Extract the video ID for better handling with Reddit videos
            let videoId = '';
            
            // Check for Reddit-hosted videos
            if (post.is_video && post.media?.reddit_video) {
                // Try to get the highest quality video URL
                const videoData = post.media.reddit_video;
                
                if (videoData.fallback_url) {
                    const match = videoData.fallback_url.match(/\/([a-zA-Z0-9]+)\//i);
                    if (match && match[1]) videoId = match[1];
                }
                
                // Use the fallback_url as the primary source
                if (videoData.fallback_url) {
                    // Store the original fallback URL
                    videoUrl = videoData.fallback_url;
                    
                    // Store the video ID for thumbnail generation
                    // We'll use a local variable instead of adding to the post object to avoid TypeScript errors
                } else if (videoData.dash_url) {
                    videoUrl = videoData.dash_url;
                } else if (videoData.hls_url) {
                    videoUrl = videoData.hls_url;
                }
            } 
            // Check for direct video links
            else if (post.url?.match(/\.(mp4|webm)$/i)) {
                videoUrl = post.url;
            }
            // Check for external video platforms
            else if (post.media?.type === 'youtube.com' || post.url?.includes('youtube.com') || post.url?.includes('youtu.be')) {
                
                return false;
            }

            if (!videoUrl) {
                return false;
            }

            // Validate video URL
            const videoMetadata = await VideoProcessor.validateVideo(videoUrl);
            if (!videoMetadata) {
                return false;
            }

            // Generate thumbnail - use enhanced URL handling for Reddit videos
            let thumbnailUrl = '';
            if (videoMetadata.url.includes('v.redd.it') && videoId) {
                // For Reddit videos, use the video ID to create multiple URL formats to try
                const urlFormats = [
                    videoMetadata.url, // Original URL
                    `https://v.redd.it/${videoId}/DASH_720.mp4`, // Standard format
                    `https://v.redd.it/${videoId}/DASH_480.mp4`, // Lower quality
                    `https://v.redd.it/${videoId}/DASH_360.mp4`, // Even lower quality
                    `https://v.redd.it/${videoId}/DASH_96.mp4`  // Lowest quality
                ];
                
                // Try each URL format until thumbnail generation succeeds
                let thumbnailGenerated = false;
                for (const url of urlFormats) {
                    try {
                        thumbnailUrl = await VideoProcessor.generateThumbnail(url);
                        thumbnailGenerated = true;
                        break;
                    } catch (thumbnailError) {
                        logger.debug(`Failed to generate thumbnail with URL: ${url}`);
                        // Continue to next format
                    }
                }
                
                if (!thumbnailGenerated) {
                    // If all formats failed, try the default method
                    thumbnailUrl = await VideoProcessor.generateThumbnail(videoMetadata.url);
                }
                
                // Ensure thumbnailUrl is never undefined
                if (!thumbnailUrl) {
                    // Create a hash for the video URL to maintain consistency
                    const hash = crypto.createHash('md5').update(videoMetadata.url).digest('hex');
                    const thumbnailDir = path.join(process.cwd(), 'public', 'thumbnails');
                    const thumbnailPath = path.join(thumbnailDir, `${hash}.jpg`);
                    thumbnailUrl = `/thumbnails/${hash}.jpg`;
                    
                    // Ensure the thumbnails directory exists
                    if (!fs.existsSync(thumbnailDir)) {
                        fs.mkdirSync(thumbnailDir, { recursive: true });
                    }
                    
                    // Create a default thumbnail
                    const defaultThumbnailPath = path.join(process.cwd(), 'public', 'thumbnails', 'default.jpg');
                    if (fs.existsSync(defaultThumbnailPath)) {
                        // Copy the default thumbnail
                        fs.copyFileSync(defaultThumbnailPath, thumbnailPath);
                    } else {
                        // Create an empty file as a last resort
                        fs.writeFileSync(thumbnailPath, '');
                    }
                }
            } else {
                // For non-Reddit videos, use the standard method
                thumbnailUrl = await VideoProcessor.generateThumbnail(videoMetadata.url);
                
                // Ensure thumbnailUrl is never undefined for non-Reddit videos too
                if (!thumbnailUrl) {
                    const hash = crypto.createHash('md5').update(videoMetadata.url).digest('hex');
                    thumbnailUrl = `/thumbnails/${hash}.jpg`;
                }
            }

            // Extract tags - create simple tags from title and subreddit if extractTags not available
            let tags;
            try {
                // Use the VideoProcessor.extractTags method if available
                tags = VideoProcessor.extractTags(post.title, post.subreddit.display_name);
            } catch (error) {
                // Fallback tag extraction if the method is not available
                const tagSet = new Set<string>();
                
                // Add subreddit as a tag
                tagSet.add(post.subreddit.display_name.toLowerCase());
                
                // Add simple word-based tags from title
                const words = post.title.toLowerCase()
                    .replace(/[^\w\s]/g, ' ')
                    .split(/\s+/)
                    .filter(word => word.length > 3 && !['with', 'this', 'that', 'from', 'what', 'when', 'where'].includes(word));
                
                words.forEach(word => tagSet.add(word));
                
                tags = Array.from(tagSet).slice(0, 10);
            }
            
            // Check if post is NSFW
            const isNsfw = post.over_18 || false;
            
            // For Reddit videos, try to extract audio URL
            let audioUrl = '';
            if (videoMetadata.url.includes('v.redd.it')) {
                if (videoId) {
                    audioUrl = `https://v.redd.it/${videoId}/DASH_audio.mp4`;
                } else {
                    const match = videoMetadata.url.match(/v\.redd\.it\/([^/?]+)/i);
                    if (match && match[1]) videoId = match[1];
                    
                    if (videoId) {
                        audioUrl = `https://v.redd.it/${videoId}/DASH_audio.mp4`;
                    }
                }
            }
            
            // Prepare video data
            const videoData = {
                title: post.title,
                description: post.selftext || '',
                videoUrl: videoMetadata.url,
                thumbnailUrl,
                redditId: post.id,
                subreddit: post.subreddit.display_name,
                tags,
                nsfw: isNsfw,
                likes: post.score, // Store upvotes in likes column for frontend display
                metadata: {
                    width: videoMetadata.width,
                    height: videoMetadata.height,
                    format: videoMetadata.format,
                    duration: videoMetadata.duration,
                    redditScore: post.score,
                    redditUrl: `https://reddit.com${post.permalink}`,
                    upvotes: post.score, // Store upvotes in metadata too for backward compatibility
                    audioUrl, // Store the audio URL in metadata
                    author: post.author ? post.author.name : null // Store author name for duplicate detection
                }
            };
            
            try {
                // First, check if a video with this exact redditId already exists
                const existingVideo = await Video.findOne({ where: { redditId: post.id } });
                
                if (existingVideo) {
                    // Video with this redditId already exists, update it if the new one has more upvotes
                    if (post.score > existingVideo.likes) {
                        await existingVideo.update(videoData);
                        return true;
                    } else {
                        // Skip this video as we already have it with equal or higher upvotes
                        return false;
                    }
                }
                
                // If no exact match by redditId, check for duplicate videos using similarity metrics
                const potentialDuplicate = await DuplicateVideoDetector.findDuplicateVideo(post, videoMetadata);
                
                if (potentialDuplicate) {
                    // Handle the duplicate - either update the existing one or skip this one
                    const result = await DuplicateVideoDetector.handleDuplicate(post, videoData, potentialDuplicate);
                    return result !== null; // Return true if we kept/updated a video, false if we skipped it
                }
                
                // No duplicate found, create a new video
                await Video.create({
                    ...videoData,
                    createdAt: new Date(post.created_utc * 1000),
                    views: 0,
                    blacklisted: false // Add the blacklisted field with default value
                });
                
                return true;
            } catch (error) {
                logger.error(`Failed to save video to database: ${post.title} (${post.id})`, error);
                return false; // Skip this video but continue processing others
            }
        } catch (error) {
            logger.error(`Error processing post: ${post.id}`, {
                error: error instanceof Error ? error.message : String(error),
                post: {
                    id: post.id,
                    title: post.title,
                    subreddit: post.subreddit,
                    is_video: post.is_video,
                    media: post.media,
                    url: post.url
                }
            });
            return false;
        }
    }

    // Helper function to delay execution for rate limiting
    private static async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private static async getSubredditPosts(subredditName: string): Promise<Submission[]> {
        const posts: Submission[] = [];
        const seenIds = new Set<string>();
        
        // Get existing redditIds from the database to avoid processing posts we already have
        let existingRedditIds: string[] = [];
        try {
            const existingVideos = await Video.findAll({
                attributes: ['redditId'],
                where: { subreddit: subredditName },
                raw: true
            });
            existingRedditIds = existingVideos.map((video: any) => video.redditId);
        } catch (error) {
            logger.error(`Error fetching existing videos for subreddit ${subredditName}`, error);
            // Continue with empty array if there was an error
        }
        
        try {
            // Check if subreddit exists and is accessible
            try {
                // Get hot posts with reduced limit (25 instead of 100)
                const hotPosts = await redditClient.getSubreddit(subredditName).getHot({ limit: 25 });
                for (const post of hotPosts) {
                    // Skip posts we've already seen in this batch or already have in the database
                    if (!seenIds.has(post.id) && !existingRedditIds.includes(post.id)) {
                        posts.push(post);
                        seenIds.add(post.id);
                    }
                }

                // Add delay between API calls to avoid rate limiting
                await this.delay(2000); // 2 second delay

                // Get only top posts from one time period (week) instead of all four periods
                // This significantly reduces the number of API calls
                const topPosts = await redditClient.getSubreddit(subredditName).getTop({ time: 'week', limit: 25 });
                for (const post of topPosts) {
                    // Skip posts we've already seen in this batch or already have in the database
                    if (!seenIds.has(post.id) && !existingRedditIds.includes(post.id)) {
                        posts.push(post);
                        seenIds.add(post.id);
                    }
                }

            } catch (subredditError: any) {
                // Check if this is a banned subreddit error
                if (subredditError.statusCode === 404 && 
                    subredditError.error && 
                    subredditError.error.reason === 'banned') {
                } else {
                    // Re-throw other errors to be caught by the outer catch block
                    throw subredditError;
                }
            }
        } catch (error) {
            logger.error(`Error fetching posts from subreddit: ${subredditName}`, error);
        }

        return posts;
    }

    private static async scrapeSubreddit(subredditConfig: SubredditConfig): Promise<number> {
        let processedCount = 0;
        try {
            const posts = await this.getSubredditPosts(subredditConfig.name);
            
            for (const post of posts) {
                try {
                    const processed = await this.processPost(post, subredditConfig);
                    if (processed) processedCount++;
                } catch (postError) {
                    logger.error(`Error processing post ${post.id} from r/${subredditConfig.name}`, postError);
                    // Continue with next post
                }
            }
        } catch (subredditError) {
            logger.error(`Error scraping subreddit: ${subredditConfig.name}`, subredditError);
            // Continue with next subreddit
        }
        return processedCount;
    }

    static async scrapeSubreddits(): Promise<void> {
        logger.info('Starting Reddit scraping...');
        
        for (const subredditConfig of subreddits) {
            try {
                logger.info(`Scraping subreddit: ${subredditConfig.name}`);
                const processedCount = await RedditScraper.scrapeSubreddit(subredditConfig);
                logger.info(`Processed ${processedCount} videos from r/${subredditConfig.name}`);
                
                // Add delay between subreddits to be respectful to Reddit's API
                await RedditScraper.delay(2000);
            } catch (error) {
                logger.error(`Error scraping subreddit ${subredditConfig.name}:`, error);
            }
        }
        
        logger.info('Reddit scraping completed.');
    }

    static async processSinglePost(redditUrl: string, isNsfw: boolean = false): Promise<{ success: boolean; video?: any; error?: string }> {
        try {
            // Extract subreddit name and post ID from URL
            const urlMatch = redditUrl.match(/reddit\.com\/r\/([^\/]+)\/comments\/([^\/]+)\/([^\/]+)/);
            if (!urlMatch) {
                return { success: false, error: 'Invalid Reddit URL format' };
            }

            const [, subredditName, postId] = urlMatch;
            
            // Get the post using Reddit API
            const post = await (redditClient.getSubmission(postId) as any).fetch();
            
            // Create a mock subreddit config for processing
            const subredditConfig: SubredditConfig = {
                name: subredditName,
                minScore: 1, // Lower threshold for manual submissions
                excludeTerms: [],
                searchTerms: [] // No search terms required for manual submissions
            };

            // Override NSFW check if user explicitly marked it as NSFW
            if (isNsfw) {
                post.over_18 = true;
            }

            // Check if video already exists
            const existingVideo = await Video.findOne({
                where: { redditId: post.id }
            });

            if (existingVideo) {
                return { success: false, error: 'Video already exists in our collection' };
            }

            // Process the post using existing logic
            const processed = await RedditScraper.processPost(post, subredditConfig);
            
            if (processed) {
                // Find the newly created video
                const newVideo = await Video.findOne({
                    where: { redditId: post.id }
                });

                if (newVideo) {
                    return { success: true, video: newVideo.toJSON() };
                } else {
                    return { success: false, error: 'Video was processed but not found in database' };
                }
            } else {
                return { 
                    success: false, 
                    error: 'This video does not appear to be AI-generated content. Please submit videos that are clearly created using AI tools like Stable Diffusion, Midjourney, DALL-E, or other AI generation platforms.' 
                };
            }

        } catch (error) {
            logger.error('Error processing single post:', error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error occurred' 
            };
        }
    }
}
