import { Submission } from 'snoowrap';
import Video from '../models/Video';
import { Op } from 'sequelize';
import { logger } from './logger';

/**
 * Service for detecting and handling duplicate videos
 */
export class DuplicateVideoDetector {
    /**
     * Find potential duplicate videos based on similarity metrics
     * @param post The Reddit post submission
     * @param videoMetadata The video metadata
     * @returns The duplicate video if found, null otherwise
     */
    public static async findDuplicateVideo(post: Submission, videoMetadata: any): Promise<any> {
        try {
            // Define similarity thresholds
            const TITLE_SIMILARITY_THRESHOLD = 0.7; // 70% similarity in title
            const DURATION_DIFFERENCE_THRESHOLD = 5; // 5 seconds difference in duration
            const TIME_WINDOW = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
            
            // First, check for duplicates within the same subreddit
            const sameSubredditVideos = await Video.findAll({
                where: {
                    subreddit: post.subreddit.display_name,
                    redditId: { [Op.ne]: post.id }, // Not the same post
                    createdAt: {
                        [Op.gte]: new Date(Date.now() - TIME_WINDOW) // Posted within the time window
                    }
                },
                order: [['createdAt', 'DESC']] // Most recent first
            });
            
            // Check for duplicates across all subreddits from the same author
            let crossSubredditVideos: any[] = [];
            if (post.author && post.author.name) {
                // First get all recent videos, then filter by author in application code
                // This is because Sequelize JSON queries can be complex and may not work as expected
                const allRecentVideos = await Video.findAll({
                    where: {
                        redditId: { [Op.ne]: post.id }, // Not the same post
                        createdAt: {
                            [Op.gte]: new Date(Date.now() - TIME_WINDOW) // Posted within the time window
                        }
                    },
                    order: [['createdAt', 'DESC']] // Most recent first
                });
                
                // Filter for videos from the same author
                crossSubredditVideos = allRecentVideos.filter(video => {
                    if (video.metadata && typeof video.metadata === 'object') {
                        const metadata = video.metadata as any;
                        return metadata.author === post.author.name;
                    }
                    return false;
                });
            }
            
            // Also check for exact video URL matches across all subreddits (this catches most cross-subreddit duplicates)
            let exactUrlMatches: any[] = [];
            if (videoMetadata.url) {
                exactUrlMatches = await Video.findAll({
                    where: {
                        redditId: { [Op.ne]: post.id }, // Not the same post
                        videoUrl: videoMetadata.url // Exact URL match
                    },
                    order: [['createdAt', 'DESC']] // Most recent first
                });
            }
            
            // Combine all arrays and remove duplicates
            const allRecentVideos = [...sameSubredditVideos];
            for (const video of crossSubredditVideos) {
                if (!allRecentVideos.find(v => v.id === video.id)) {
                    allRecentVideos.push(video);
                }
            }
            for (const video of exactUrlMatches) {
                if (!allRecentVideos.find(v => v.id === video.id)) {
                    allRecentVideos.push(video);
                }
            }
            
            if (!allRecentVideos || allRecentVideos.length === 0) {
                return null;
            }
            
            logger.debug(`Checking ${allRecentVideos.length} recent videos for duplicates (${sameSubredditVideos.length} same subreddit, ${crossSubredditVideos.length} cross-subreddit from same author, ${exactUrlMatches.length} exact URL matches)`);
            
            // Helper function to calculate title similarity (simple version)
            const calculateTitleSimilarity = (title1: string, title2: string): number => {
                const t1 = title1.toLowerCase().replace(/[^\w\s]/g, '');
                const t2 = title2.toLowerCase().replace(/[^\w\s]/g, '');
                
                // Count matching words
                const words1 = t1.split(/\s+/).filter(w => w.length > 3); // Only consider meaningful words
                const words2 = t2.split(/\s+/).filter(w => w.length > 3);
                
                let matchCount = 0;
                for (const word of words1) {
                    if (words2.includes(word)) {
                        matchCount++;
                    }
                }
                
                // Calculate similarity as percentage of matching words
                const totalWords = Math.max(words1.length, words2.length);
                return totalWords > 0 ? matchCount / totalWords : 0;
            };
            
            // Check each recent video for similarity
            for (const video of allRecentVideos) {
                let similarityScore = 0;
                
                // Check for exact URL match first (highest priority)
                if (videoMetadata.url && video.videoUrl && videoMetadata.url === video.videoUrl) {
                    similarityScore = 1.0; // 100% match for exact URL
                    logger.debug(`Exact URL match found: ${videoMetadata.url}`);
                }
                
                // Check title similarity
                const titleSimilarity = calculateTitleSimilarity(post.title, video.title);
                if (titleSimilarity >= TITLE_SIMILARITY_THRESHOLD) {
                    similarityScore += 0.4; // 40% weight for title
                }
                
                // Check duration similarity if available
                if (videoMetadata.duration && video.metadata && typeof video.metadata === 'object') {
                    const metadata = video.metadata as any;
                    if ('duration' in metadata) {
                        const durationDiff = Math.abs(videoMetadata.duration - metadata.duration);
                        if (durationDiff <= DURATION_DIFFERENCE_THRESHOLD) {
                            similarityScore += 0.3; // 30% weight for duration
                        }
                    }
                }
                
                // Check if same author (if available) - higher weight for cross-subreddit duplicates
                if (post.author && post.author.name && video.metadata && typeof video.metadata === 'object') {
                    const metadata = video.metadata as any;
                    if ('author' in metadata && metadata.author === post.author.name) {
                        // Higher weight for same author, especially if it's a cross-subreddit duplicate
                        const isCrossSubreddit = video.subreddit !== post.subreddit.display_name;
                        similarityScore += isCrossSubreddit ? 0.4 : 0.2; // 40% for cross-subreddit, 20% for same subreddit
                    }
                }
                
                // Check video URL similarity (exact match for Reddit videos)
                // Skip this check if we already have an exact URL match
                if (similarityScore < 1.0 && videoMetadata.url && video.videoUrl) {
                    // For Reddit videos, check if they have the same video ID
                    if (videoMetadata.url.includes('v.redd.it') && video.videoUrl.includes('v.redd.it')) {
                        const url1Match = videoMetadata.url.match(/v\.redd\.it\/([^/?]+)/i);
                        const url2Match = video.videoUrl.match(/v\.redd\.it\/([^/?]+)/i);
                        if (url1Match && url2Match && url1Match[1] === url2Match[1]) {
                            similarityScore += 0.5; // 50% weight for same video ID
                        }
                    }
                    // For other videos, check exact URL match
                    else if (videoMetadata.url === video.videoUrl) {
                        similarityScore += 0.5; // 50% weight for exact URL match
                    }
                }
                
                // If similarity score is high enough, consider it a duplicate
                // Lower threshold for cross-subreddit duplicates from same author
                const isCrossSubredditSameAuthor = video.subreddit !== post.subreddit.display_name && 
                    post.author && post.author.name && 
                    video.metadata && typeof video.metadata === 'object' && 
                    (video.metadata as any).author === post.author.name;
                
                const threshold = isCrossSubredditSameAuthor ? 0.6 : 0.7; // 60% for cross-subreddit same author, 70% otherwise
                
                // Log high similarity scores for debugging
                if (similarityScore >= 0.5) {
                    logger.debug(`High similarity score ${similarityScore.toFixed(2)} for ${post.title} vs ${video.title} (threshold: ${threshold})`);
                }
                
                // For exact URL matches, always consider it a duplicate regardless of threshold
                if (similarityScore >= 1.0) {
                    logger.info(`Exact URL duplicate detected: ${post.title} (${post.id}) matches ${video.title} (${video.redditId})`);
                    return video;
                }
                
                if (similarityScore >= threshold) {
                    logger.info(`Duplicate detected: ${post.title} (${post.id}) matches ${video.title} (${video.redditId}) with score ${similarityScore.toFixed(2)}`);
                    return video;
                }
            }
            
            return null;
        } catch (error) {
            logger.error(`Error checking for duplicate videos: ${error}`);
            return null; // Continue with normal processing if error occurs
        }
    }

    /**
     * Handle a potential duplicate video
     * @param post The Reddit post submission
     * @param videoData The video data to be saved
     * @param potentialDuplicate The potential duplicate video
     * @returns The video object if it should be kept, null if it should be skipped
     */
    public static async handleDuplicate(post: Submission, videoData: any, potentialDuplicate: any): Promise<any> {
        try {
            // Check if this is an exact URL match
            const isExactUrlMatch = videoData.videoUrl === potentialDuplicate.videoUrl;
            
            // For cross-subreddit duplicates from same author, always prefer the one with more upvotes
            const isCrossSubredditSameAuthor = potentialDuplicate.subreddit !== post.subreddit.display_name && 
                post.author && post.author.name && 
                potentialDuplicate.metadata && typeof potentialDuplicate.metadata === 'object' && 
                (potentialDuplicate.metadata as any).author === post.author.name;
            
            if (isExactUrlMatch) {
                // For exact URL matches, always prefer the one with more upvotes
                if (post.score > potentialDuplicate.likes) {
                    logger.info(`Replacing exact URL duplicate: ${potentialDuplicate.title} (${potentialDuplicate.redditId}) with ${post.title} (${post.id})`);
                    await potentialDuplicate.update(videoData);
                    return potentialDuplicate;
                } else {
                    logger.info(`Skipping exact URL duplicate: ${post.title} (${post.id}) - existing has more upvotes`);
                    return null;
                }
            } else if (isCrossSubredditSameAuthor) {
                if (post.score > potentialDuplicate.likes) {
                    // This new post has more upvotes, replace the old one
                    logger.info(`Replacing cross-subreddit duplicate: ${potentialDuplicate.title} (${potentialDuplicate.redditId}) with ${post.title} (${post.id})`);
                    await potentialDuplicate.update(videoData);
                    return potentialDuplicate;
                } else {
                    // The existing post has more upvotes, skip this one
                    logger.info(`Skipping cross-subreddit duplicate: ${post.title} (${post.id}) - existing has more upvotes`);
                    return null;
                }
            } else {
                // For same-subreddit duplicates, use the original logic
                if (post.score > potentialDuplicate.likes) {
                    // This new post has more upvotes, replace the old one
                    await potentialDuplicate.update(videoData);
                    return potentialDuplicate;
                } else {
                    // The existing post has more upvotes, skip this one
                    return null;
                }
            }
        } catch (error) {
            logger.error(`Error handling duplicate video: ${error}`);
            return null;
        }
    }
}
