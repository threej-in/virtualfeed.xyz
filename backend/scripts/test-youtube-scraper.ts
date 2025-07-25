import { YouTubeScraper } from '../src/services/youtubeScraper';
import { logger } from '../src/services/logger';
import sequelize from '../src/config/database';

async function testYouTubeScraper() {
    try {
        // Test database connection
        await sequelize.authenticate();
        logger.info('Successfully connected to MySQL database');

        // Sync models
        await sequelize.sync();
        logger.info('Database models synchronized.');

        // Test YouTube scraping with only 3 search terms to avoid rate limiting
        logger.info('Starting YouTube scraper test with limited search terms...');
        const processedCount = await YouTubeScraper.scrapeYouTubeVideos(undefined, 3);
        logger.info(`YouTube scraping test completed. Total processed: ${processedCount} videos.`);

    } catch (error) {
        logger.error('Error in YouTube scraping test:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

testYouTubeScraper(); 