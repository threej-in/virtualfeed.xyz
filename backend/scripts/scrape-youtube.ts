import { YouTubeScraper } from '../src/services/youtubeScraper';
import { logger } from '../src/services/logger';
import sequelize from '../src/config/database';

async function scrapeYouTubeOnly() {
    try {
        // Test database connection
        await sequelize.authenticate();
        logger.info('Successfully connected to MySQL database');

        // Sync models
        await sequelize.sync();
        logger.info('Database models synchronized.');

        // Start YouTube scraping with multiple search terms
        logger.info('Starting YouTube-only scraping...');
        const processedCount = await YouTubeScraper.scrapeYouTubeVideos();
        logger.info(`YouTube scraping completed. Total processed: ${processedCount} videos.`);

    } catch (error) {
        logger.error('Error in YouTube scraping script:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

scrapeYouTubeOnly(); 