import { redditClient } from '../config/reddit';
import { subreddits, SubredditConfig } from '../config/subreddits';
import { VideoProcessor } from './videoProcessor';
import { logger } from './logger';
import Video from '../models/Video';
import { Submission, Listing } from 'snoowrap';

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
                const primaryAITerms = ['ai', 'artificial intelligence', 'generated', 'stable diffusion', 'midjourney', 'dall-e', 'sora'];
                const secondaryTerms = ['video', 'created', 'made', 'produced', 'animation', 'render', 'generated'];
                
                // Check if post contains at least one primary AI term
                const hasPrimaryTerm = primaryAITerms.some(term => postText.includes(term.toLowerCase()));
                
                // Check if post contains at least one secondary term
                const hasSecondaryTerm = secondaryTerms.some(term => postText.includes(term.toLowerCase()));
                
                // Only accept posts that have both a primary AI term AND a secondary term
                if (!(hasPrimaryTerm && hasSecondaryTerm)) {
                    
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

            // Check for Reddit-hosted videos
            if (post.is_video && post.media?.reddit_video) {
                // Try to get the highest quality video URL
                const videoData = post.media.reddit_video;
                
                if (videoData.dash_url) {
                    videoUrl = videoData.dash_url;
                } else if (videoData.hls_url) {
                    videoUrl = videoData.hls_url;
                } else if (videoData.fallback_url) {
                    // Remove any quality suffix to get the base URL
                    videoUrl = videoData.fallback_url.replace(/_\d+\.mp4/, '.mp4');
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

            // Generate thumbnail
            const thumbnailUrl = await VideoProcessor.generateThumbnail(videoUrl);

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

            // Create or update video record
            try {
                // Check if post is marked as NSFW (over_18 property in Reddit API)
                const isNsfw = post.over_18 === true;
              
                // Check if video with this redditId already exists
                const existingVideo = await Video.findOne({ where: { redditId: post.id } });
                
                // Extract audio URL for Reddit videos
                let audioUrl = null;
                if (videoMetadata.url && videoMetadata.url.includes('v.redd.it')) {
                    let videoId = '';
                    if (videoMetadata.url.includes('/DASH_')) {
                        const match = videoMetadata.url.match(/v\.redd\.it\/([^/]+)\//i);
                        if (match && match[1]) videoId = match[1];
                    } else {
                        const match = videoMetadata.url.match(/v\.redd\.it\/([^/?]+)/i);
                        if (match && match[1]) videoId = match[1];
                    }
                    
                    if (videoId) {
                        audioUrl = `https://v.redd.it/${videoId}/DASH_audio.mp4`;
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
                        audioUrl // Store the audio URL in metadata
                    }
                };
                
                let video;
                if (existingVideo) {
                    // Update existing video
                    await existingVideo.update(videoData);
                    video = existingVideo;
                } else {
                    // Create new video
                    video = await Video.create({
                        ...videoData,
                        createdAt: new Date(post.created_utc * 1000),
                        views: 0,
                        likes: 0,
                        blacklisted: false // Add the blacklisted field with default value
                    });
                }
                
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
        
        try {
            // Check if subreddit exists and is accessible
            try {
                // Get hot posts with reduced limit (25 instead of 100)
                const hotPosts = await redditClient.getSubreddit(subredditName).getHot({ limit: 25 });
                for (const post of hotPosts) {
                    if (!seenIds.has(post.id)) {
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
                    if (!seenIds.has(post.id)) {
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
        let totalProcessed = 0;

        try {
            // Process subreddits sequentially with delays instead of in parallel
            // This helps avoid Reddit API rate limits
            for (const config of subreddits) {
                try {
                    const count = await this.scrapeSubreddit(config);
                    totalProcessed += count;
                    
                    // Add a 5-second delay between subreddits to avoid rate limiting
                    if (config !== subreddits[subreddits.length - 1]) {
                        await this.delay(5000);
                    }
                } catch (error) {
                    logger.error(`Error processing subreddit r/${config.name}`, error);
                    // Continue with next subreddit even if one fails
                }
            }
            
        } catch (error) {
            logger.error('Fatal error during Reddit scraping', error);
        }
    }
}
