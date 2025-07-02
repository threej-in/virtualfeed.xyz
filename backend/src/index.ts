import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { RedditScraper } from './services/redditScraper';
import { logger } from './services/logger';
import sequelize from './config/database';
import videoRoutes from './routes/videoRoutes';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from the public directory
app.use(express.static('public'));
// Explicitly serve thumbnails directory
app.use('/thumbnails', express.static('public/thumbnails'));

// Routes
app.use('/api/videos', videoRoutes);

// Start server and initialize database
async function startServer() {
    try {
        // Test database connection
        await sequelize.authenticate();
        logger.info('Successfully connected to MySQL database');

        // Sync database models
        await sequelize.sync();
        logger.info('Database models synchronized successfully');

        // Start the server
        app.listen(port, () => {
            logger.info(`Server is running on port ${port}`);
        });

        // Start Reddit scraper
        const startScraping = async () => {
            try {
                await RedditScraper.scrapeSubreddits();
            } catch (error) {
                logger.error('Error in scraping cycle:', error);
            }
        };

        // Check if scraping should be enabled
        const enableScraping = process.argv.includes('--enable-scraping');
        
        if (enableScraping) {
            logger.info('Reddit scraping is enabled');
            // Schedule periodic scraping (every 60 minutes instead of 30 to reduce API calls)
            setInterval(startScraping, 60 * 60 * 1000);
            
            // Delay initial scrape by 10 seconds to ensure server is fully started
            setTimeout(() => {
                logger.info('Starting initial Reddit scrape');
                startScraping();
            }, 10000);
        } else {
            logger.info('Reddit scraping is disabled. Start with --enable-scraping flag to enable');
        }
    } catch (error) {
        logger.error('Error starting server:', error);
        process.exit(1);
    }
}

startServer();
