"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.VideoProcessor = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("./logger");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const crypto = __importStar(require("crypto"));
// Use require for fluent-ffmpeg as it doesn't have proper TypeScript default export
const ffmpeg = require('fluent-ffmpeg');
class VideoProcessor {
    static validateVideo(url) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    const response = yield axios_1.default.head(url, { timeout: 5000 });
                    const contentType = response.headers['content-type'];
                    // More lenient content type checking - accept anything with 'video' in it
                    // or if the URL ends with a video extension
                    if ((contentType === null || contentType === void 0 ? void 0 : contentType.includes('video')) || url.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
                        const format = (contentType === null || contentType === void 0 ? void 0 : contentType.split('/')[1]) || 'mp4';
                        return {
                            url,
                            format,
                            height: 720, // Default to 720p for non-Reddit videos
                            width: 1280,
                            duration: 0
                        };
                    }
                }
                catch (headError) {
                    // If HEAD request fails, try to infer from URL
                    // logger.info(`HEAD request failed for ${url}, trying to infer from URL`);
                }
                // If HEAD request failed or content type wasn't video, try to infer from URL
                if (url.match(/\.(mp4|webm|mov|avi|mkv)$/i)) {
                    const format = url.split('.').pop() || 'mp4';
                    // logger.info(`Inferred video format from URL: ${format}`);
                    return {
                        url,
                        format,
                        height: 720,
                        width: 1280,
                        duration: 0
                    };
                }
                // If we can't validate it as a video, log but still accept it
                // This is the most lenient approach - assume it's a video unless proven otherwise
                // logger.info(`Could not validate ${url} as video, but accepting anyway`);
                return {
                    url,
                    format: 'unknown',
                    height: 720,
                    width: 1280,
                    duration: 0
                };
            }
            catch (error) {
                logger_1.logger.error(`Error validating video URL: ${url}`, error);
                return null;
            }
        });
    }
    static generateThumbnail(videoUrl) {
        return __awaiter(this, void 0, void 0, function* () {
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
                    logger_1.logger.info(`Using existing thumbnail for video: ${videoUrl}`);
                    return thumbnailUrl;
                }
                // Extract the first frame of the video using ffmpeg
                return new Promise((resolve, reject) => {
                    // Create a new ffmpeg command
                    const command = ffmpeg(videoUrl);
                    command
                        .on('error', (err) => {
                        logger_1.logger.error(`Error extracting thumbnail from video: ${videoUrl}`, err);
                        // Fall back to a placeholder if ffmpeg fails
                        resolve('https://via.placeholder.com/640x360?text=Video+Preview&bg=121212&fg=ffffff');
                    })
                        .on('end', () => {
                        logger_1.logger.info(`Successfully generated thumbnail for video: ${videoUrl}`);
                        resolve(thumbnailUrl);
                    })
                        .screenshots({
                        timestamps: ['00:00:01.000'], // Take screenshot at the 1-second mark
                        filename: `${hash}.jpg`,
                        folder: thumbnailDir,
                        size: '640x360'
                    });
                });
            }
            catch (error) {
                // Catch any unexpected errors in the entire thumbnail generation process
                logger_1.logger.error(`Unexpected error generating thumbnail for URL: ${videoUrl}`, error);
                return `https://via.placeholder.com/640x360?text=Video+Thumbnail`;
            }
        });
    }
    static extractTags(title, subreddit) {
        const tags = new Set();
        // Add subreddit as a tag
        tags.add(subreddit);
        // Split title into words and clean them
        const words = title
            .toLowerCase()
            .replace(/[^\w\s#]/g, ' ') // Replace non-word chars (except #) with space
            .split(/\s+/) // Split on whitespace
            .filter((word) => word.length > 2); // Filter out short words
        // Extract hashtags
        const hashtags = title.match(/#[\w\u0590-\u05ff]+/g) || [];
        hashtags.forEach((tag) => tags.add(tag.slice(1).toLowerCase()));
        // Extract quoted phrases
        const quotes = title.match(/"([^"]+)"/g) || [];
        quotes.forEach((quote) => tags.add(quote.replace(/"/g, '').toLowerCase()));
        // Extract bracketed terms
        const brackets = title.match(/\[([^\]]+)\]/g) || [];
        brackets.forEach((bracket) => tags.add(bracket.replace(/[\[\]]/g, '').toLowerCase()));
        // Extract parenthetical terms
        const parentheses = title.match(/\(([^)]+)\)/g) || [];
        parentheses.forEach((paren) => tags.add(paren.replace(/[()]/g, '').toLowerCase()));
        // Extract common prefixes
        const prefixes = ['using', 'made with', 'created by', 'powered by', 'generated by'];
        prefixes.forEach((prefix) => {
            const regex = new RegExp(`${prefix}\\s+([\\w\\s]+)`, 'gi');
            const matches = title.match(regex) || [];
            matches.forEach((match) => {
                const term = match.replace(new RegExp(`^${prefix}\\s+`, 'i'), '').toLowerCase();
                tags.add(term);
            });
        });
        // Add significant words (nouns, proper nouns, etc.)
        words.forEach((word) => {
            // Add words that are likely significant
            if (word.length > 3 && // Longer words
                !['the', 'and', 'but', 'for', 'with', 'this', 'that', 'from', 'what', 'when', 'where', 'which'].includes(word) && // Skip common stop words
                (/^[A-Z]/.test(word) || // Capitalized words
                    word.includes('ai') || // AI-related terms
                    /\d/.test(word) || // Words with numbers
                    word.length > 6 // Longer words are more likely to be significant
                )) {
                tags.add(word);
            }
        });
        // Convert tags to array and limit to reasonable number
        return Array.from(tags)
            .filter((tag) => tag.length > 0 && tag.length < 50) // Remove empty or too long tags
            .slice(0, 15); // Limit to 15 tags max
    }
}
exports.VideoProcessor = VideoProcessor;
