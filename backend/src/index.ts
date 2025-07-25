import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as path from 'path';
import { RedditScraper } from './services/redditScraper';
import { logger } from './services/logger';
import sequelize from './config/database';
import videoRoutes from './routes/videoRoutes';
import blacklistRoutes from './routes/blacklistRoutes';
import { YouTubeScraper } from './services/youtubeScraper';

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure express.static with proper MIME types
const staticOptions = {
  setHeaders: (res: express.Response, path: string) => {
    // Set appropriate content type for images
    if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
      res.set('Content-Type', 'image/jpeg');
    } else if (path.endsWith('.png')) {
      res.set('Content-Type', 'image/png');
    }
    
    // Add cache control headers
    res.set('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
    res.set('X-Content-Type-Options', 'nosniff'); // Prevent MIME sniffing
  }
};

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public'), staticOptions));

// Log all requests to help with debugging
app.use((req, res, next) => {
  next();
});

// Routes
app.use('/api/videos', videoRoutes);
app.use('/api/blacklist', blacklistRoutes);

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
                await YouTubeScraper.scrapeYouTubeVideos();
            } catch (error) {
                logger.error('Error in scraping cycle:', error);
            }
        };

        // Check if scraping should be enabled
        const enableScraping = process.argv.includes('--enable-scraping');
        
        if (enableScraping) {
            logger.info('Reddit scraping is enabled');
            // Schedule periodic scraping (every 24 hours to reduce API calls)
            setInterval(startScraping, 24 * 60 * 60 * 1000);
            
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
