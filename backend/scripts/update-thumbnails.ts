import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import dotenv from 'dotenv';
import { logger } from '../src/services/logger';
import sequelize from '../src/config/database';
import Video from '../src/models/Video';
// Use require for fluent-ffmpeg as it doesn't have proper TypeScript default export
const ffmpeg = require('fluent-ffmpeg');

// Load environment variables
dotenv.config();

/**
 * Generates a thumbnail for a video URL using FFmpeg
 * @param videoUrl The URL of the video
 * @param outputPath The path where the thumbnail should be saved
 * @returns Promise that resolves when the thumbnail is generated
 */
function generateThumbnail(videoUrl: string, outputPath: string): Promise<void> {
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
        logger.info(`Successfully generated thumbnail for video: ${videoUrl}`);
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
 * Updates thumbnail URLs in the database and regenerates thumbnails using FFmpeg
 */
async function updateThumbnailUrls() {
  try {
    // Connect to database
    await sequelize.authenticate();
    logger.info('Successfully connected to MySQL database');

    // Get all videos from the database
    const videos = await Video.findAll();
    logger.info(`Found ${videos.length} videos in the database`);

    // Path to thumbnails directory
    const thumbnailDir = path.join(process.cwd(), 'public', 'thumbnails');
    
    // Ensure thumbnails directory exists
    if (!fs.existsSync(thumbnailDir)) {
      fs.mkdirSync(thumbnailDir, { recursive: true });
    }

    // Create a default thumbnail
    const defaultThumbnailPath = path.join(thumbnailDir, 'default.jpg');
    
    // Track statistics
    let updatedCount = 0;
    let generatedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;

    // Process each video
    for (const video of videos) {
      if (!video.videoUrl) {
        logger.warn(`Video ${video.id} has no videoUrl. Skipping.`);
        skippedCount++;
        continue;
      }

      // Calculate MD5 hash of the video URL
      const hash = crypto.createHash('md5').update(video.videoUrl).digest('hex');
      const thumbnailPath = path.join(thumbnailDir, `${hash}.jpg`);
      const thumbnailUrl = `/thumbnails/${hash}.jpg`;

      logger.info(`Processing video ${video.id} - ${video.title || 'Untitled'}`);
      logger.info(`Video URL: ${video.videoUrl}`);
      logger.info(`Thumbnail path: ${thumbnailPath}`);

      try {
        // Fix Reddit video URLs that might be truncated
        let videoUrlToUse = video.videoUrl;
        
        // Check if it's a Reddit video
        if (video.videoUrl.includes('v.redd.it')) {
          // Extract the video ID from the URL
          let videoId = '';
          
          // Try to extract video ID from different URL formats
          if (video.videoUrl.includes('/DASH_')) {
            // Format: https://v.redd.it/{id}/DASH_1080.mp4
            const match = video.videoUrl.match(/v\.redd\.it\/([^/]+)\//i);
            if (match && match[1]) videoId = match[1];
          } else {
            // Format: https://v.redd.it/{id}
            const match = video.videoUrl.match(/v\.redd\.it\/([^/?]+)/i);
            if (match && match[1]) videoId = match[1];
          }
          
          if (videoId) {
            // Create a list of possible URL formats to try
            const urlFormats = [
              video.videoUrl, // Original URL
              `https://v.redd.it/${videoId}/DASH_720.mp4`, // Standard format
              `https://v.redd.it/${videoId}/DASH_480.mp4`, // Lower quality
              `https://v.redd.it/${videoId}/DASH_360.mp4`, // Even lower quality
              `https://v.redd.it/${videoId}/DASH_96.mp4`, // Lowest quality
            ];
            
            // Try each URL format until one works
            let success = false;
            for (const url of urlFormats) {
              try {
                logger.info(`Trying URL format: ${url}`);
                await generateThumbnail(url, thumbnailPath);
                videoUrlToUse = url;
                success = true;
                logger.info(`Successfully generated thumbnail using URL: ${url}`);
                break;
              } catch (formatError) {
                logger.warn(`Failed with URL format: ${url}`);
                // Continue to next format
              }
            }
            
            if (success) {
              generatedCount++;
            } else {
              throw new Error(`All URL formats failed for video ID: ${videoId}`);
            }
          } else {
            // If we couldn't extract a video ID, try with the original URL
            logger.warn(`Could not extract video ID from URL: ${video.videoUrl}`);
            await generateThumbnail(videoUrlToUse, thumbnailPath);
            generatedCount++;
          }
        } else {
          // For non-Reddit videos, just use the original URL
          await generateThumbnail(videoUrlToUse, thumbnailPath);
          generatedCount++;
        }
        
        // Update the thumbnail URL in the database if needed
        if (video.thumbnailUrl !== thumbnailUrl) {
          logger.info(`Updating thumbnail URL for video ${video.id}`);
          logger.info(`Old URL: ${video.thumbnailUrl}`);
          logger.info(`New URL: ${thumbnailUrl}`);
          
          await video.update({ thumbnailUrl });
          updatedCount++;
        }
      } catch (error) {
        logger.error(`Failed to generate thumbnail for video ${video.id}. Creating empty file.`);
        failedCount++;
        
        // Create an empty file as a fallback
        try {
          fs.writeFileSync(thumbnailPath, '');
          
          // Update the thumbnail URL in the database
          if (video.thumbnailUrl !== thumbnailUrl) {
            await video.update({ thumbnailUrl });
            updatedCount++;
          }
        } catch (writeError) {
          logger.error(`Error creating empty thumbnail file: ${writeError}`);
        }
      }
    }

    // Log summary
    logger.info('Thumbnail URL update completed');
    logger.info(`Total videos: ${videos.length}`);
    logger.info(`Generated thumbnails: ${generatedCount}`);
    logger.info(`Failed generations: ${failedCount}`);
    logger.info(`Updated URLs in DB: ${updatedCount}`);
    logger.info(`Skipped: ${skippedCount}`);

  } catch (error) {
    logger.error('Error updating thumbnail URLs:', error);
  } finally {
    // Close database connection
    await sequelize.close();
    logger.info('Database connection closed');
  }
}

// Run the update function
updateThumbnailUrls()
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
