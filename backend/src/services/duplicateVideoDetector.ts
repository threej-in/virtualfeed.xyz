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
            
            // Get recent videos from the same subreddit
            const recentVideos = await Video.findAll({
                where: {
                    subreddit: post.subreddit.display_name,
                    redditId: { [Op.ne]: post.id }, // Not the same post
                    createdAt: {
                        [Op.gte]: new Date(Date.now() - TIME_WINDOW) // Posted within the time window
                    }
                },
                order: [['createdAt', 'DESC']] // Most recent first
            });
            
            if (!recentVideos || recentVideos.length === 0) {
                return null;
            }
            
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
            for (const video of recentVideos) {
                let similarityScore = 0;
                
                // Check title similarity
                const titleSimilarity = calculateTitleSimilarity(post.title, video.title);
                if (titleSimilarity >= TITLE_SIMILARITY_THRESHOLD) {
                    similarityScore += 0.5; // 50% weight for title
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
                
                // Check if same author (if available)
                if (post.author && post.author.name && video.metadata && typeof video.metadata === 'object') {
                    const metadata = video.metadata as any;
                    if ('author' in metadata && metadata.author === post.author.name) {
                        similarityScore += 0.2; // 20% weight for same author
                    }
                }
                
                // If similarity score is high enough, consider it a duplicate
                if (similarityScore >= 0.7) { // 70% overall similarity threshold
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
            if (post.score > potentialDuplicate.likes) {
                // This new post has more upvotes, replace the old one
                await potentialDuplicate.update(videoData);
                return potentialDuplicate;
            } else {
                // The existing post has more upvotes, skip this one
                return null;
            }
        } catch (error) {
            logger.error(`Error handling duplicate video: ${error}`);
            return null;
        }
    }
}
