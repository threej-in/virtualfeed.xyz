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
    logger.info(`Starting FFmpeg process for URL: ${videoUrl}`);
    
    try {
      const command = ffmpeg(videoUrl);
      
      // Add User-Agent headers for Reddit videos
      if (videoUrl.includes('v.redd.it')) {
        logger.info(`Adding Reddit-specific headers for: ${videoUrl}`);
        // Fix the headers format - use a single -headers option with all headers
        command.inputOptions([
          '-headers',
          'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36\r\nReferer: https://www.reddit.com/\r\n'
        ]);
      }
      
      // Add more verbose logging
      command
        .on('start', (commandLine: string) => {
          logger.info(`FFmpeg command: ${commandLine}`);
        })
        .on('progress', (progress: any) => {
          logger.info(`FFmpeg progress: ${JSON.stringify(progress)}`);
        })
        .on('error', (err: Error) => {
          logger.error(`Error extracting thumbnail from video: ${videoUrl}`);
          logger.error(`Error details: ${err.message}`);
          reject(err);
        })
        .on('end', () => {
          logger.info(`FFmpeg successfully generated thumbnail at: ${outputPath}`);
          resolve();
        })
        // Use a more direct approach with explicit output path
        .outputOptions([
          '-ss', '00:00:01.000',  // Seek to 1 second
          '-frames:v', '1',       // Extract only one frame
          '-q:v', '2',           // High quality
          '-vf', 'scale=640:360'  // Scale to desired size
        ])
        .output(outputPath)
        .outputFormat('image2')    // Force image output format
        .run();  // Execute the command
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Exception in FFmpeg initialization: ${errorMessage}`);
      reject(error);
    }
  });
}

/**
 * Updates thumbnail URLs in the database and regenerates thumbnails using FFmpeg
 * @param options Configuration options for the update process
 * @param options.regenerateFailedOnly If true, only regenerate thumbnails that previously failed
 * @param options.forceRegenerate If true, regenerate all thumbnails even if they already exist
 */
async function updateThumbnailUrls(options: { regenerateFailedOnly?: boolean; forceRegenerate?: boolean } = {}) {
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
      
      // Check if we should process this thumbnail
      const thumbnailExists = fs.existsSync(thumbnailPath) && fs.statSync(thumbnailPath).size > 0;
      
      // Skip if thumbnail exists and we're not forcing regeneration
      if (thumbnailExists && !options.forceRegenerate) {
        // If we're only regenerating failed thumbnails, skip this one since it exists
        if (options.regenerateFailedOnly) {
          logger.info(`Thumbnail already exists for video ${video.id}. Skipping.`);
          skippedCount++;
          continue;
        }
      }
      
      // If we're only regenerating failed thumbnails, check if this is a failed one
      if (options.regenerateFailedOnly && !thumbnailExists) {
        logger.info(`Found failed thumbnail for video ${video.id}. Attempting to regenerate.`);
      }

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

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  regenerateFailedOnly: args.includes('--failed-only') || args.includes('-f'),
  forceRegenerate: args.includes('--force') || args.includes('-F')
};

// Display help if requested
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Thumbnail Update Script
----------------------

Usage: ts-node update-thumbnails.ts [options]

Options:
  -f, --failed-only    Only regenerate thumbnails that previously failed
  -F, --force          Force regeneration of all thumbnails even if they exist
  -h, --help           Display this help message

Examples:
  ts-node update-thumbnails.ts                 # Update all missing thumbnails
  ts-node update-thumbnails.ts --failed-only   # Only regenerate failed thumbnails
  ts-node update-thumbnails.ts --force         # Regenerate all thumbnails
`);
  process.exit(0);
}

// Log the selected options
logger.info('Starting thumbnail update with options:');
logger.info(`- Regenerate failed only: ${options.regenerateFailedOnly}`);
logger.info(`- Force regenerate all: ${options.forceRegenerate}`);

// Run the update function
updateThumbnailUrls(options)
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed:', error);
    process.exit(1);
  });
