"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedditScraper = void 0;
const reddit_1 = require("../config/reddit");
const subreddits_1 = require("../config/subreddits");
const videoProcessor_1 = require("./videoProcessor");
const logger_1 = require("./logger");
const Video_1 = __importDefault(require("../models/Video"));
class RedditScraper {
    static processPost(post, subredditConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            try {
                // Log post details for debugging - only at debug level
                // logger.info(`Processing post: ${post.title} (${post.id}) from r/${post.subreddit}`);
                // Check if post has minimum score (more lenient now)
                if (post.score < subredditConfig.minScore) {
                    // logger.info(`Skipping post: Score too low (${post.score} < ${subredditConfig.minScore})`);
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
                        logger_1.logger.info(`Skipping post: Insufficient AI-related terms in title/description`);
                        return false;
                    }
                }
                // Check for excluded terms
                if (subredditConfig.excludeTerms && subredditConfig.excludeTerms.length > 0) {
                    const postText = `${post.title} ${post.selftext || ''}`.toLowerCase();
                    const hasExcludedTerm = subredditConfig.excludeTerms.some(term => postText.includes(term.toLowerCase()));
                    if (hasExcludedTerm) {
                        // logger.info(`Skipping post: Contains excluded term`);
                        return false;
                    }
                }
                // Process video URL
                let videoUrl = '';
                // Check for Reddit-hosted videos
                if (post.is_video && ((_a = post.media) === null || _a === void 0 ? void 0 : _a.reddit_video)) {
                    // Try to get the highest quality video URL
                    const videoData = post.media.reddit_video;
                    // Don't log full video data JSON to reduce log size
                    logger_1.logger.info(`Found Reddit video: ${post.id} (${videoData.height}p)`);
                    if (videoData.dash_url) {
                        videoUrl = videoData.dash_url;
                        // logger.info(`Found Reddit DASH video: ${videoUrl}`);
                    }
                    else if (videoData.hls_url) {
                        videoUrl = videoData.hls_url;
                        // logger.info(`Found Reddit HLS video: ${videoUrl}`);
                    }
                    else if (videoData.fallback_url) {
                        // Remove any quality suffix to get the base URL
                        videoUrl = videoData.fallback_url.replace(/_\d+\.mp4/, '.mp4');
                        // logger.info(`Found Reddit fallback video: ${videoUrl}`);
                    }
                }
                // Check for direct video links
                else if ((_b = post.url) === null || _b === void 0 ? void 0 : _b.match(/\.(mp4|webm)$/i)) {
                    videoUrl = post.url;
                    // logger.info(`Found direct video link: ${videoUrl}`);
                }
                // Check for external video platforms
                else if (((_c = post.media) === null || _c === void 0 ? void 0 : _c.type) === 'youtube.com' || ((_d = post.url) === null || _d === void 0 ? void 0 : _d.includes('youtube.com')) || ((_e = post.url) === null || _e === void 0 ? void 0 : _e.includes('youtu.be'))) {
                    logger_1.logger.info(`Skipping YouTube video`);
                    return false;
                }
                if (!videoUrl) {
                    // logger.info(`Skipping post: No video URL found`);
                    return false;
                }
                // Validate video URL
                const videoMetadata = yield videoProcessor_1.VideoProcessor.validateVideo(videoUrl);
                if (!videoMetadata) {
                    // logger.info(`Skipping post: Invalid video URL: ${videoUrl}`);
                    return false;
                }
                // Generate thumbnail
                const thumbnailUrl = yield videoProcessor_1.VideoProcessor.generateThumbnail(videoUrl);
                // Extract tags - create simple tags from title and subreddit if extractTags not available
                let tags;
                try {
                    // Use the VideoProcessor.extractTags method if available
                    tags = videoProcessor_1.VideoProcessor.extractTags(post.title, post.subreddit.display_name);
                }
                catch (error) {
                    // Fallback tag extraction if the method is not available
                    logger_1.logger.warn('VideoProcessor.extractTags not available, using fallback tag extraction');
                    const tagSet = new Set();
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
                    // Log NSFW status
                    if (isNsfw) {
                        logger_1.logger.info(`Post is marked as NSFW: ${post.id}`);
                    }
                    // Check if video with this redditId already exists
                    const existingVideo = yield Video_1.default.findOne({ where: { redditId: post.id } });
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
                        metadata: {
                            width: videoMetadata.width,
                            height: videoMetadata.height,
                            format: videoMetadata.format,
                            duration: videoMetadata.duration,
                            redditScore: post.score,
                            redditUrl: `https://reddit.com${post.permalink}`,
                            upvotes: post.score // Store upvotes in metadata too for backward compatibility
                        }
                    };
                    let video;
                    if (existingVideo) {
                        // Update existing video
                        yield existingVideo.update(videoData);
                        video = existingVideo;
                        logger_1.logger.info(`Updated existing video: ${video.title} (${video.id})`);
                    }
                    else {
                        // Create new video
                        video = yield Video_1.default.create(Object.assign(Object.assign({}, videoData), { createdAt: new Date(post.created_utc * 1000), views: 0, likes: 0 }));
                        logger_1.logger.info(`Successfully processed new video: ${video.title} (${video.id})`);
                    }
                    return true;
                }
                catch (error) {
                    logger_1.logger.error(`Failed to save video to database: ${post.title} (${post.id})`, error);
                    return false; // Skip this video but continue processing others
                }
            }
            catch (error) {
                logger_1.logger.error(`Error processing post: ${post.id}`, {
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
        });
    }
    // Helper function to delay execution for rate limiting
    static delay(ms) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(resolve => setTimeout(resolve, ms));
        });
    }
    static getSubredditPosts(subredditName) {
        return __awaiter(this, void 0, void 0, function* () {
            const posts = [];
            const seenIds = new Set();
            try {
                // Check if subreddit exists and is accessible
                try {
                    // Get hot posts with reduced limit (25 instead of 100)
                    logger_1.logger.info(`Fetching hot posts from r/${subredditName}`);
                    const hotPosts = yield reddit_1.redditClient.getSubreddit(subredditName).getHot({ limit: 25 });
                    for (const post of hotPosts) {
                        if (!seenIds.has(post.id)) {
                            posts.push(post);
                            seenIds.add(post.id);
                        }
                    }
                    // Add delay between API calls to avoid rate limiting
                    yield this.delay(2000); // 2 second delay
                    // Get only top posts from one time period (week) instead of all four periods
                    // This significantly reduces the number of API calls
                    logger_1.logger.info(`Fetching week top posts from r/${subredditName}`);
                    const topPosts = yield reddit_1.redditClient.getSubreddit(subredditName).getTop({ time: 'week', limit: 25 });
                    for (const post of topPosts) {
                        if (!seenIds.has(post.id)) {
                            posts.push(post);
                            seenIds.add(post.id);
                        }
                    }
                    logger_1.logger.info(`Retrieved ${posts.length} total posts from r/${subredditName}`);
                }
                catch (subredditError) {
                    // Check if this is a banned subreddit error
                    if (subredditError.statusCode === 404 &&
                        subredditError.error &&
                        subredditError.error.reason === 'banned') {
                        logger_1.logger.warn(`Skipping banned subreddit: r/${subredditName}`);
                        // We'll return an empty array for banned subreddits
                    }
                    else {
                        // Re-throw other errors to be caught by the outer catch block
                        throw subredditError;
                    }
                }
            }
            catch (error) {
                logger_1.logger.error(`Error fetching posts from subreddit: ${subredditName}`, error);
            }
            return posts;
        });
    }
    static scrapeSubreddit(subredditConfig) {
        return __awaiter(this, void 0, void 0, function* () {
            let processedCount = 0;
            try {
                logger_1.logger.info(`Starting to scrape r/${subredditConfig.name}`);
                const posts = yield this.getSubredditPosts(subredditConfig.name);
                for (const post of posts) {
                    try {
                        const processed = yield this.processPost(post, subredditConfig);
                        if (processed)
                            processedCount++;
                    }
                    catch (postError) {
                        logger_1.logger.error(`Error processing post ${post.id} from r/${subredditConfig.name}`, postError);
                        // Continue with next post
                    }
                }
                logger_1.logger.info(`Finished scraping r/${subredditConfig.name}. Processed ${processedCount} new videos`);
            }
            catch (subredditError) {
                logger_1.logger.error(`Error scraping subreddit: ${subredditConfig.name}`, subredditError);
                // Continue with next subreddit
            }
            return processedCount;
        });
    }
    static scrapeSubreddits() {
        return __awaiter(this, void 0, void 0, function* () {
            logger_1.logger.info('Starting Reddit scraping process');
            let totalProcessed = 0;
            try {
                // Process subreddits sequentially with delays instead of in parallel
                // This helps avoid Reddit API rate limits
                for (const config of subreddits_1.subreddits) {
                    try {
                        logger_1.logger.info(`Processing subreddit: r/${config.name}`);
                        const count = yield this.scrapeSubreddit(config);
                        totalProcessed += count;
                        // Add a 5-second delay between subreddits to avoid rate limiting
                        if (config !== subreddits_1.subreddits[subreddits_1.subreddits.length - 1]) {
                            logger_1.logger.info(`Waiting 5 seconds before processing next subreddit...`);
                            yield this.delay(5000);
                        }
                    }
                    catch (error) {
                        logger_1.logger.error(`Error processing subreddit r/${config.name}`, error);
                        // Continue with next subreddit even if one fails
                    }
                }
                logger_1.logger.info(`Reddit scraping completed. Total new videos processed: ${totalProcessed}`);
            }
            catch (error) {
                logger_1.logger.error('Fatal error during Reddit scraping', error);
            }
        });
    }
}
exports.RedditScraper = RedditScraper;
