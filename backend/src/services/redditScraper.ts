import { redditClient } from '../config/reddit';
import { subreddits, SubredditConfig } from '../config/subreddits';
import { VideoProcessor } from './videoProcessor';
import { logger } from './logger';
import Video from '../models/Video';
import { Submission, Listing } from 'snoowrap';

export class RedditScraper {
    private static readonly RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
    private static readonly DEFAULT_SEARCH_TERMS = [
        'ai video',
        'generated video',
        'stable diffusion video',
        'midjourney video',
        'sora video'
    ];

    private static decodeRedditUrl(url: string | undefined): string {
        if (!url || typeof url !== 'string') return '';
        return url.replace(/&amp;/g, '&').trim();
    }

    private static getPostRedditVideo(post: Submission): any | null {
        const asAny = post as any;

        const direct =
            asAny?.media?.reddit_video ||
            asAny?.secure_media?.reddit_video;
        if (direct) return direct;

        const crosspost = asAny?.crosspost_parent_list?.[0];
        const crosspostVideo =
            crosspost?.media?.reddit_video ||
            crosspost?.secure_media?.reddit_video;
        if (crosspostVideo) return crosspostVideo;

        return null;
    }

    private static getRedditPreviewThumbnail(post: Submission): string | null {
        const asAny = post as any;
        const previewUrl = asAny?.preview?.images?.[0]?.source?.url
            || asAny?.crosspost_parent_list?.[0]?.preview?.images?.[0]?.source?.url;
        if (typeof previewUrl === 'string' && previewUrl.startsWith('http')) {
            // Reddit returns escaped URLs like "&amp;"
            return this.decodeRedditUrl(previewUrl);
        }

        const thumb = asAny?.thumbnail || asAny?.crosspost_parent_list?.[0]?.thumbnail;
        if (typeof thumb === 'string' && thumb.startsWith('http')) {
            return this.decodeRedditUrl(thumb);
        }

        return null;
    }

    private static async fetchWithRetry<T>(label: string, fn: () => Promise<T>, maxAttempts: number = 3): Promise<T> {
        let lastError: any = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                lastError = error;
                const statusCode = Number(error?.statusCode || error?.response?.status || 0);
                const shouldRetry = this.RETRYABLE_STATUS_CODES.has(statusCode);
                if (!shouldRetry || attempt === maxAttempts) {
                    throw error;
                }

                const waitMs = Math.min(15000, 1000 * Math.pow(2, attempt));
                logger.warn(`Reddit API ${label} failed with status ${statusCode}. Retrying in ${waitMs}ms (attempt ${attempt}/${maxAttempts})`);
                await this.delay(waitMs);
            }
        }

        throw lastError;
    }

    private static async processPost(post: Submission, subredditConfig: SubredditConfig, isManualSubmission: boolean = false): Promise<boolean> {
        try {
            // Log post details for debugging - only at debug level
            // 

            // Check if post has minimum score (more lenient now)
            if (post.score < subredditConfig.minScore) {
                // 
                return false;
            }
            
            // For AI-focused subreddits, we don't need to check for search terms
            const aiSubreddits = ['StableDiffusion', 'midjourney', 'sdforall', 'aivideo', 'AIGeneratedContent', 'aiArt', 'chatgpttoolbox', 'aiart', 'artificial', 'machinelearning'];
            const isAIFocusedSubreddit = aiSubreddits.includes(post.subreddit.display_name);
            
            // Check for required search terms (only for non-AI-focused subreddits)
            if (!isAIFocusedSubreddit) {
                const postText = `${post.title} ${post.selftext || ''} ${post.link_flair_text || ''}`.toLowerCase();
                
                // For manual submissions, use more lenient filtering
                if (isManualSubmission) {
                    // LENIENT FILTERING: Require at least one AI-related term
                    const aiTerms = ['ai', 'artificial intelligence', 'generated', 'stable diffusion', 'midjourney', 'dall-e', 'sora', 'gpt', 'chatgpt', 'machine learning', 'neural network', 'deep learning', 'algorithm', 'automated', 'synthetic', 'aigenerated', 'ai-generated', 'ai generated'];
                    
                    const hasAITerm = aiTerms.some(term => {
                        // Use word boundaries to prevent substring matches like "ai" in "rain"
                        const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                        return regex.test(postText);
                    });
                    
                    if (!hasAITerm) {
                        logger.info(`Manual submission rejected: No AI-related terms found in title/description`);
                        return false;
                    }
                } else {
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
            let redditVideo: any = null;
            
            // Check for Reddit-hosted videos
            redditVideo = this.getPostRedditVideo(post);
            if (post.is_video && redditVideo) {
                const fallbackUrl = this.decodeRedditUrl(redditVideo?.fallback_url as string | undefined);
                const dashUrl = this.decodeRedditUrl(redditVideo?.dash_url as string | undefined);
                const hlsUrl = this.decodeRedditUrl(redditVideo?.hls_url as string | undefined);
                
                if (fallbackUrl) {
                    const match = fallbackUrl.match(/\/([a-zA-Z0-9]+)\//i);
                    if (match && match[1]) videoId = match[1];
                }
                
                // redditp-style: use exact Reddit fallback MP4 URL for playback.
                if (fallbackUrl && /\/DASH_\d+\.mp4/i.test(fallbackUrl)) {
                    videoUrl = fallbackUrl;
                } else if (dashUrl || hlsUrl) {
                    // Keep dash/hls as metadata-only options; skip ingest when no playable fallback mp4 exists.
                    videoUrl = '';
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

            // Prefer Reddit-provided preview thumbnails to avoid ffmpeg failures.
            let thumbnailUrl = '';
            const redditPreviewThumbnail = this.getRedditPreviewThumbnail(post);
            if (redditPreviewThumbnail) {
                thumbnailUrl = redditPreviewThumbnail;
            }

            if (videoMetadata.url.includes('v.redd.it') && videoId) {
                // Only attempt thumbnail generation if we do not already have a usable preview thumbnail.
                if (!thumbnailUrl) {
                    thumbnailUrl = await VideoProcessor.generateThumbnail(videoMetadata.url);
                }
                
                // Ensure thumbnailUrl is never undefined
                if (!thumbnailUrl) {
                    thumbnailUrl = await VideoProcessor.generateThumbnail(videoMetadata.url);
                }
            } else {
                // For non-Reddit videos, use the standard method
                if (!thumbnailUrl) {
                    thumbnailUrl = await VideoProcessor.generateThumbnail(videoMetadata.url);
                }
                
                // Ensure thumbnailUrl is never undefined for non-Reddit videos too
                if (!thumbnailUrl) {
                    thumbnailUrl = await VideoProcessor.generateThumbnail(videoMetadata.url);
                }
            }

            // Skip rows with no usable thumbnail.
            if (!thumbnailUrl || !(thumbnailUrl.startsWith('/thumbnails/') || /^https?:\/\//i.test(thumbnailUrl))) {
                return false;
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
            let redditVideoSources: { fallbackUrl?: string; dashUrl?: string; hlsUrl?: string } | undefined;
            if (videoMetadata.url.includes('v.redd.it')) {
                const fallbackUrl = this.decodeRedditUrl(redditVideo?.fallback_url as string | undefined) || undefined;
                const dashUrl = this.decodeRedditUrl(redditVideo?.dash_url as string | undefined) || undefined;
                const hlsUrl = this.decodeRedditUrl(redditVideo?.hls_url as string | undefined) || undefined;

                if (fallbackUrl || dashUrl || hlsUrl) {
                    redditVideoSources = {
                        fallbackUrl,
                        dashUrl,
                        hlsUrl
                    };
                }

                const querySuffix = fallbackUrl && fallbackUrl.includes('?')
                    ? fallbackUrl.substring(fallbackUrl.indexOf('?'))
                    : '';

                if (videoId) {
                    audioUrl = `https://v.redd.it/${videoId}/DASH_AUDIO_128.mp4${querySuffix}`;
                } else {
                    const match = videoMetadata.url.match(/v\.redd\.it\/([^/?]+)/i);
                    if (match && match[1]) videoId = match[1];
                    
                    if (videoId) {
                        audioUrl = `https://v.redd.it/${videoId}/DASH_AUDIO_128.mp4${querySuffix}`;
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
                platform: 'reddit',
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
                    redditVideoSources,
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

    private static getSearchTermsForSubreddit(subredditConfig: SubredditConfig): string[] {
        const envTerms = process.env.REDDIT_SEARCH_TERMS
            ?.split(',')
            .map(term => term.trim())
            .filter(Boolean) || [];
        const configTerms = (subredditConfig.searchTerms || []).map(term => term.trim()).filter(Boolean);

        if (configTerms.length > 0) {
            return configTerms;
        }

        if (envTerms.length > 0) {
            return envTerms;
        }

        return this.DEFAULT_SEARCH_TERMS;
    }

    private static async getSubredditPosts(subredditConfig: SubredditConfig): Promise<Submission[]> {
        const subredditName = subredditConfig.name;
        const posts: Submission[] = [];
        const seenIds = new Set<string>();
        const searchTerms = this.getSearchTermsForSubreddit(subredditConfig);
        
        // Get existing redditIds from the database to avoid processing posts we already have
        let existingRedditIds = new Set<string>();
        try {
            const existingVideos = await Video.findAll({
                attributes: ['redditId'],
                where: { subreddit: subredditName },
                raw: true
            });
            existingRedditIds = new Set(
                existingVideos
                    .map((video: any) => video.redditId)
                    .filter((redditId: any) => typeof redditId === 'string' && redditId.length > 0)
            );
        } catch (error) {
            logger.error(`Error fetching existing videos for subreddit ${subredditName}`, error);
            // Continue with empty array if there was an error
        }

        const pushIfNew = (post: Submission) => {
            if (!seenIds.has(post.id) && !existingRedditIds.has(post.id)) {
                posts.push(post);
                seenIds.add(post.id);
            }
        };
        
        try {
            // Check if subreddit exists and is accessible
            try {
                const subreddit = redditClient.getSubreddit(subredditName);

                // Search-first ingestion for targeted matching posts.
                for (const term of searchTerms) {
                    const searchPosts = await this.fetchWithRetry(
                        `r/${subredditName} search(${term})`,
                        () => subreddit.search({
                            query: term,
                            sort: 'new',
                            time: 'week',
                            limit: 25,
                            restrictSr: true
                        } as any) as Promise<Listing<Submission>>
                    );
                    for (const post of searchPosts) {
                        pushIfNew(post);
                    }
                    await this.delay(1200);
                }

                // Fallback listing endpoints to fill gaps.
                const newPosts = await this.fetchWithRetry(
                    `r/${subredditName} getNew`,
                    () => subreddit.getNew({ limit: 30 })
                );
                for (const post of newPosts) {
                    pushIfNew(post);
                }

                // Add delay between API calls to avoid rate limiting
                await this.delay(1200);

                const hotPosts = await this.fetchWithRetry(
                    `r/${subredditName} getHot`,
                    () => subreddit.getHot({ limit: 15 })
                );
                for (const post of hotPosts) {
                    pushIfNew(post);
                }

                // Add delay between API calls to avoid rate limiting
                await this.delay(1200);

                const topPosts = await this.fetchWithRetry(
                    `r/${subredditName} getTop(week)`,
                    () => subreddit.getTop({ time: 'week', limit: 15 })
                );
                for (const post of topPosts) {
                    pushIfNew(post);
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
            const posts = await this.getSubredditPosts(subredditConfig);
            
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

    static async refreshRecentMediaSources(limit: number = 200): Promise<number> {
        logger.info(`Refreshing Reddit media sources for up to ${limit} videos...`);
        const refreshedWindowMs = 6 * 60 * 60 * 1000; // 6h
        let refreshedCount = 0;

        const videos = await Video.findAll({
            where: {
                platform: 'reddit',
                blacklisted: false
            },
            order: [['updatedAt', 'ASC']],
            limit
        });

        for (const video of videos) {
            try {
                const metadata: any = typeof video.metadata === 'object' && video.metadata ? { ...(video.metadata as any) } : {};
                const lastRefreshedAt = metadata?.mediaRefreshedAt ? new Date(metadata.mediaRefreshedAt).getTime() : 0;
                if (lastRefreshedAt && Date.now() - lastRefreshedAt < refreshedWindowMs) {
                    continue;
                }

                const post: any = await this.fetchWithRetry<any>(
                    `refresh submission ${video.redditId}`,
                    () => (redditClient.getSubmission(video.redditId) as any).fetch(),
                    2
                );

                if (!post || (!post.is_video && !(post.media as any)?.reddit_video)) {
                    await video.update({ blacklisted: true });
                    continue;
                }

                const redditVideo = this.getPostRedditVideo(post as Submission);
                const fallbackUrl = this.decodeRedditUrl(redditVideo?.fallback_url as string | undefined) || undefined;
                const dashUrl = this.decodeRedditUrl(redditVideo?.dash_url as string | undefined) || undefined;
                const hlsUrl = this.decodeRedditUrl(redditVideo?.hls_url as string | undefined) || undefined;
                const refreshedVideoUrl = fallbackUrl || video.videoUrl;

                // If we still don't have a playable fallback mp4, blacklist to avoid dead cards.
                if (!refreshedVideoUrl || !/\/DASH_\d+\.mp4/i.test(refreshedVideoUrl)) {
                    await video.update({ blacklisted: true });
                    continue;
                }

                const querySuffix = refreshedVideoUrl.includes('?')
                    ? refreshedVideoUrl.substring(refreshedVideoUrl.indexOf('?'))
                    : '';

                const match = refreshedVideoUrl.match(/v\.redd\.it\/([^/?]+)/i);
                const refreshedAudioUrl = match?.[1]
                    ? `https://v.redd.it/${match[1]}/DASH_AUDIO_128.mp4${querySuffix}`
                    : metadata?.audioUrl || '';

                const refreshedMetadata = {
                    ...metadata,
                    redditUrl: `https://reddit.com${post.permalink}`,
                    redditScore: post.score,
                    upvotes: post.score,
                    audioUrl: refreshedAudioUrl,
                    redditVideoSources: {
                        fallbackUrl,
                        dashUrl,
                        hlsUrl
                    },
                    mediaRefreshedAt: new Date().toISOString()
                };

                await video.update({
                    videoUrl: refreshedVideoUrl,
                    likes: post.score,
                    metadata: refreshedMetadata
                });

                refreshedCount++;
                await this.delay(400);
            } catch (error: any) {
                const statusCode = Number(error?.statusCode || error?.response?.status || 0);
                if (statusCode === 403 || statusCode === 404) {
                    await video.update({ blacklisted: true });
                    continue;
                }
                logger.warn(`Failed to refresh media sources for redditId=${video.redditId}`, {
                    message: error?.message,
                    statusCode
                });
            }
        }

        logger.info(`Reddit media refresh completed. Updated ${refreshedCount} videos`);
        return refreshedCount;
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
            const post: any = await this.fetchWithRetry<any>(
                `submission ${postId} fetch`,
                () => (redditClient.getSubmission(postId) as any).fetch()
            );
            
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
            const processed = await RedditScraper.processPost(post as Submission, subredditConfig, true); // true = manual submission
            
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
