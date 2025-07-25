import { RedditScraper } from '../services/redditScraper';
import { YouTubeScraper } from '../services/youtubeScraper';
import { logger } from '../services/logger';
import sequelize from '../config/database';

async function main() {
    try {
        // Test database connection
        await sequelize.authenticate();
        logger.info('Database connection established successfully.');

        // Sync models
        await sequelize.sync();
        logger.info('Database models synchronized.');

        // Start Reddit scraping
        logger.info('Starting Reddit scraping...');
        await RedditScraper.scrapeSubreddits();
        logger.info('Reddit scraping completed.');

        // Start YouTube scraping
        logger.info('Starting YouTube scraping...');
        const youtubeCount = await YouTubeScraper.scrapeYouTubeVideos();
        logger.info(`YouTube scraping completed. Processed ${youtubeCount} videos.`);

        logger.info('Total scraping completed. Processed videos from Reddit and YouTube.');

    } catch (error) {
        logger.error('Error in scrape script:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

main();
