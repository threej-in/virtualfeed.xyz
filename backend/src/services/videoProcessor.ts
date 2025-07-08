import axios from 'axios';
import { logger } from './logger';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
// Use require for fluent-ffmpeg as it doesn't have proper TypeScript default export
const ffmpeg = require('fluent-ffmpeg');

interface VideoMetadata {
    url: string;
    format: string;
    height: number;
    width: number;
    duration: number;
}

export class VideoProcessor {
    static async validateVideo(url: string): Promise<VideoMetadata | null> {
        try {
            // Special handling for Reddit DASH/HLS videos
            if (url.includes('v.redd.it')) {
                // Extract the video ID for better handling
                let videoId = '';
                let directUrl = url;
                let height = 720;
                let width = 1280;
                
                // Extract video ID from different URL formats
                if (url.includes('/DASH_')) {
                    // Format: https://v.redd.it/{id}/DASH_1080.mp4
                    const match = url.match(/v\.redd\.it\/([^/]+)\//i);
                    if (match && match[1]) {
                        videoId = match[1];
                        // Extract resolution if available
                        const resMatch = url.match(/DASH_(\d+)/i);
                        if (resMatch && resMatch[1]) {
                            height = parseInt(resMatch[1]);
                            width = Math.round(height * 16 / 9);
                        }
                        // Keep the direct URL as is since it's already a playable format
                    }
                } 
                else if (url.includes('DASHPlaylist.mpd') || url.includes('HLSPlaylist')) {
                    // Format: https://v.redd.it/{id}/DASHPlaylist.mpd?...
                    const match = url.match(/v\.redd\.it\/([^/]+)\//i);
                    if (match && match[1]) {
                        videoId = match[1];
                        // Convert to direct MP4 URL for better compatibility
                        directUrl = `https://v.redd.it/${videoId}/DASH_720.mp4`;
                        height = 720;
                        width = 1280;
                    }
                }
                else {
                    // Simple format: https://v.redd.it/{id}
                    const parts = url.split('/');
                    for (let i = 0; i < parts.length; i++) {
                        if (parts[i] === 'v.redd.it' && i + 1 < parts.length) {
                            videoId = parts[i + 1].split('?')[0]; // Remove any query parameters
                            // Convert to direct MP4 URL
                            directUrl = `https://v.redd.it/${videoId}/DASH_720.mp4`;
                            break;
                        }
                    }
                }
                
                // Determine format
                const format = directUrl.endsWith('.mp4') ? 'mp4' : 
                             directUrl.includes('dash') ? 'dash' : 
                             directUrl.includes('hls') ? 'hls' : 'mp4';

                // Return metadata with the potentially modified URL
                return {
                    url: directUrl, // Use the direct URL for better playback compatibility
                    format,
                    height,
                    width,
                    duration: 0 // We'll need to implement duration detection if needed
                };
            }

            // Try to validate with a HEAD request first
            try {
                const response = await axios.head(url, { timeout: 5000 });
                const contentType = response.headers['content-type'];
                
                // More lenient content type checking - accept anything with 'video' in it
                // or if the URL ends with a video extension
                if (contentType?.includes('video') || url.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
                    const format = contentType?.split('/')[1] || 'mp4';
                    return {
                        url,
                        format,
                        height: 720, // Default to 720p for non-Reddit videos
                        width: 1280,
                        duration: 0
                    };
                }
            } catch (headError) {
                // If HEAD request fails, try to infer from URL
            }
            
            // If HEAD request failed or content type wasn't video, try to infer from URL
            if (url.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
                const format = url.split('.').pop() || 'mp4';
                return {
                    url,
                    format,
                    height: 720,
                    width: 1280,
                    duration: 0
                };
            }
            
            return {
                url,
                format: 'unknown',
                height: 720,
                width: 1280,
                duration: 0
            };
        } catch (error) {
            logger.error(`Error validating video URL: ${url}`, error);
            return null;
        }
    }

    static async generateThumbnail(videoUrl: string): Promise<string> {
        try {
            // Create a unique filename for the thumbnail based on the video URL
            const hash = crypto.createHash('md5').update(videoUrl).digest('hex');
            const thumbnailDir = path.join(process.cwd(), 'public', 'thumbnails');
            const thumbnailPath = path.join(thumbnailDir, `${hash}.jpg`);
            const thumbnailUrl = `/thumbnails/${hash}.jpg`;
            
            // Ensure the thumbnails directory exists
            if (!fs.existsSync(thumbnailDir)) {
                fs.mkdirSync(thumbnailDir, { recursive: true });
            }
            
            // Check if we already have a thumbnail for this video
            if (fs.existsSync(thumbnailPath)) {
                return thumbnailUrl;
            }
            
            // Handle Reddit videos specially with multiple URL formats
            if (videoUrl.includes('v.redd.it')) {
                // Extract the video ID from the URL
                let videoId = '';
                
                // Try to extract video ID from different URL formats
                if (videoUrl.includes('/DASH_')) {
                    // Format: https://v.redd.it/{id}/DASH_1080.mp4
                    const match = videoUrl.match(/v\.redd\.it\/([^/]+)\//i);
                    if (match && match[1]) videoId = match[1];
                } else {
                    // Format: https://v.redd.it/{id}
                    const match = videoUrl.match(/v\.redd\.it\/([^/?]+)/i);
                    if (match && match[1]) videoId = match[1];
                }
                
                if (videoId) {
                    // Create a list of possible URL formats to try
                    const urlFormats = [
                        videoUrl, // Original URL
                        `https://v.redd.it/${videoId}/DASH_720.mp4`, // Standard format
                        `https://v.redd.it/${videoId}/DASH_480.mp4`, // Lower quality
                        `https://v.redd.it/${videoId}/DASH_360.mp4`, // Even lower quality
                        `https://v.redd.it/${videoId}/DASH_96.mp4`, // Lowest quality
                    ];
                    
                    // Try each URL format until one works
                    for (const url of urlFormats) {
                        try {
                            await this.generateThumbnailWithFFmpeg(url, thumbnailPath);
                            return thumbnailUrl;
                        } catch (formatError) {
                            // Continue to next format
                        }
                    }
                    
                    // If all formats failed, fall back to default thumbnail
                    logger.error(`All URL formats failed for video ID: ${videoId}`);
                    return this.createDefaultThumbnail(thumbnailPath, thumbnailUrl);
                }
            }
            
            // For non-Reddit videos or if we couldn't extract a video ID
            try {
                await this.generateThumbnailWithFFmpeg(videoUrl, thumbnailPath);
                return thumbnailUrl;
            } catch (error) {
                logger.error(`Error generating thumbnail for video: ${videoUrl}`, error);
                return this.createDefaultThumbnail(thumbnailPath, thumbnailUrl);
            }
        } catch (error) {
            // Catch any unexpected errors in the entire thumbnail generation process
            logger.error(`Unexpected error generating thumbnail for URL: ${videoUrl}`, error);
            
            // Create a hash for the video URL to maintain consistency
            const hash = crypto.createHash('md5').update(videoUrl).digest('hex');
            const thumbnailDir = path.join(process.cwd(), 'public', 'thumbnails');
            const thumbnailPath = path.join(thumbnailDir, `${hash}.jpg`);
            const thumbnailUrl = `/thumbnails/${hash}.jpg`;
            
            // Ensure the thumbnails directory exists
            if (!fs.existsSync(thumbnailDir)) {
                fs.mkdirSync(thumbnailDir, { recursive: true });
            }
            
            try {
                // Try to copy a default thumbnail if it exists
                const defaultThumbnailPath = path.join(process.cwd(), 'public', 'thumbnails', 'default.jpg');
                
                if (fs.existsSync(defaultThumbnailPath)) {
                    // Copy the default thumbnail to our hash-based filename
                    fs.copyFileSync(defaultThumbnailPath, thumbnailPath);
                } else {
                    // Create an empty file as a last resort
                    fs.writeFileSync(thumbnailPath, '');
                }
            } catch (copyError) {
                logger.error(`Error creating default thumbnail in error handler: ${copyError}`);
            }
            
            // Always return the local thumbnail URL path
            return thumbnailUrl;
        }
    }

    /**
     * Helper method to generate a thumbnail using FFmpeg
     */
    private static async generateThumbnailWithFFmpeg(videoUrl: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const command = ffmpeg(videoUrl);
            
            // Add User-Agent headers for Reddit videos
            if (videoUrl.includes('v.redd.it')) {
                command.inputOptions([
                    '-user_agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    '-headers', 'Referer: https://www.reddit.com/\r\n'
                ]);
            }
            
            command
                .on('error', (err: Error) => {
                    logger.error(`Error extracting thumbnail from video: ${videoUrl}`, err);
                    reject(err);
                })
                .on('end', () => {
                    resolve();
                })
                .screenshots({
                    timestamps: ['00:00:01.000'], // Take screenshot at the 1-second mark
                    filename: path.basename(outputPath),
                    folder: path.dirname(outputPath),
                    size: '640x360'
                });
        });
    }
    
    /**
     * Helper method to create a default thumbnail when generation fails
     */
    private static createDefaultThumbnail(thumbnailPath: string, thumbnailUrl: string): string {
        try {
            // Ensure the thumbnails directory exists
            const thumbnailDir = path.dirname(thumbnailPath);
            if (!fs.existsSync(thumbnailDir)) {
                fs.mkdirSync(thumbnailDir, { recursive: true });
            }
            
            // Try to copy a default thumbnail if it exists
            const defaultThumbnailPath = path.join(process.cwd(), 'public', 'thumbnails', 'default.jpg');
            
            if (fs.existsSync(defaultThumbnailPath)) {
                // Copy the default thumbnail to our hash-based filename
                fs.copyFileSync(defaultThumbnailPath, thumbnailPath);
            } else {
                // Create an empty file as a last resort
                fs.writeFileSync(thumbnailPath, '');
            }
        } catch (copyError) {
            logger.error(`Error creating default thumbnail: ${copyError}`);
        }
        
        // Always return the local thumbnail URL path
        return thumbnailUrl;
    }

    static extractTags(title: string, subreddit: string): string[] {
        const tags = new Set<string>();
        
        // Add subreddit as a tag
        tags.add(subreddit);

        // Split title into words and clean them
        const words = title
            .toLowerCase()
            .replace(/[^\w\s#]/g, ' ')  // Replace non-word chars (except #) with space
            .split(/\s+/)               // Split on whitespace
            .filter((word: string) => word.length > 2);  // Filter out short words

        // Extract hashtags
        const hashtags = title.match(/#[\w\u0590-\u05ff]+/g) || [];
        hashtags.forEach((tag: string) => tags.add(tag.slice(1).toLowerCase()));

        // Extract quoted phrases
        const quotes = title.match(/"([^"]+)"/g) || [];
        quotes.forEach((quote: string) => tags.add(quote.replace(/"/g, '').toLowerCase()));

        // Extract bracketed terms
        const brackets = title.match(/\[([^\]]+)\]/g) || [];
        brackets.forEach((bracket: string) => tags.add(bracket.replace(/[\[\]]/g, '').toLowerCase()));

        // Extract parenthetical terms
        const parentheses = title.match(/\(([^)]+)\)/g) || [];
        parentheses.forEach((paren: string) => tags.add(paren.replace(/[()]/g, '').toLowerCase()));

        // Extract common prefixes
        const prefixes = ['using', 'made with', 'created by', 'powered by', 'generated by'];
        prefixes.forEach((prefix: string) => {
            const regex = new RegExp(`${prefix}\\s+([\\w\\s]+)`, 'gi');
            const matches = title.match(regex) || [];
            matches.forEach((match: string) => {
                const term = match.replace(new RegExp(`^${prefix}\\s+`, 'i'), '').toLowerCase();
                tags.add(term);
            });
        });

        // Add significant words (nouns, proper nouns, etc.)
        words.forEach((word: string) => {
            // Add words that are likely significant
            if (
                word.length > 3 && // Longer words
                !['the', 'and', 'but', 'for', 'with', 'this', 'that', 'from', 'what', 'when', 'where', 'which'].includes(word) && // Skip common stop words
                (
                    /^[A-Z]/.test(word) || // Capitalized words
                    word.includes('ai') ||  // AI-related terms
                    /\d/.test(word) ||     // Words with numbers
                    word.length > 6         // Longer words are more likely to be significant
                )
            ) {
                tags.add(word);
            }
        });

        // Convert tags to array and limit to reasonable number
        return Array.from(tags)
            .filter((tag: string) => tag.length > 0 && tag.length < 50) // Remove empty or too long tags
            .slice(0, 15); // Limit to 15 tags max
    }
}
