import { RedditScraper } from '../services/redditScraper';
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

        // Start scraping
        await RedditScraper.scrapeSubreddits();
    } catch (error) {
        logger.error('Error in scrape script:', error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

main();
