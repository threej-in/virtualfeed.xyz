import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import * as path from 'path';
import fs from 'fs';
import { RedditScraper } from './services/redditScraper';
import { logger } from './services/logger';
import sequelize from './config/database';
import videoRoutes from './routes/videoRoutes';
import blacklistRoutes from './routes/blacklistRoutes';
import { YouTubeScraper } from './services/youtubeScraper';

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3002;

// Middleware
app.use(cors());
app.use(express.json());

// Configure express.static with proper MIME types
const staticOptions = {
  setHeaders: (res: express.Response, filePath: string) => {
    if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.set('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.png')) {
      res.set('Content-Type', 'image/png');
    }

    res.set('Cache-Control', 'public, max-age=86400');
    res.set('X-Content-Type-Options', 'nosniff');
  },
};
const thumbnailStaticOptions = {
  ...staticOptions,
  fallthrough: false,
};

// Serve thumbnails with strict 404 behavior so missing files don't resolve to index.html.
app.use('/thumbnails', express.static(path.join(__dirname, '../public', 'thumbnails'), thumbnailStaticOptions));
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const originalUrl = typeof req.originalUrl === 'string' ? req.originalUrl : '';
  if (originalUrl.startsWith('/thumbnails/')) {
    const maybeError = err as { status?: number; code?: string };
    if (maybeError?.status === 404 || maybeError?.code === 'ENOENT') {
      res.status(404).set('Cache-Control', 'no-store').end();
      return;
    }
  }
  next(err);
});

// Serve static assets from public directory (legacy assets)
app.use(express.static(path.join(__dirname, '../public'), staticOptions));

// Basic request logging (silent for now but hook for future)
app.use((_req, _res, next) => {
  next();
});

// API routes
app.use('/api/videos', videoRoutes);
app.use('/api/blacklist', blacklistRoutes);

// Serve React build if it exists
const clientBuildPath = path.join(__dirname, '../../build');
if (fs.existsSync(clientBuildPath)) {
  app.use(express.static(clientBuildPath));

  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

async function startServer() {
  try {
    await sequelize.authenticate();
    logger.info('Successfully connected to MySQL database');

    await sequelize.sync();
    logger.info('Database models synchronized successfully');

    app.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
    });

    const enableScraping = process.argv.includes('--enable-scraping');
    const enableRedditScraping =
      process.argv.includes('--enable-reddit-scraping') ||
      (process.env.ENABLE_REDDIT_SCRAPING || 'false').toLowerCase() === 'true';
    const enableYouTubeScraping =
      enableScraping ||
      process.argv.includes('--enable-youtube-scraping') ||
      (process.env.ENABLE_YOUTUBE_SCRAPING || 'false').toLowerCase() === 'true';

    const startRedditScraping = async () => {
      try {
        await RedditScraper.scrapeSubreddits();
        await RedditScraper.refreshRecentMediaSources(Number(process.env.REDDIT_MEDIA_REFRESH_LIMIT || 200));
      } catch (error) {
        logger.error('Error in Reddit scraping cycle:', error);
      }
    };

    const startYouTubeScraping = async () => {
      try {
        await YouTubeScraper.scrapeYouTubeVideos();
      } catch (error) {
        logger.error('Error in YouTube scraping cycle:', error);
      }
    };

    if (enableRedditScraping) {
      logger.info('Reddit scraping is enabled');
      setInterval(startRedditScraping, 24 * 60 * 60 * 1000);
      setInterval(
        () => {
          RedditScraper.refreshRecentMediaSources(Number(process.env.REDDIT_MEDIA_REFRESH_LIMIT || 200)).catch((error) =>
            logger.error('Error in reddit media refresh cycle:', error)
          );
        },
        6 * 60 * 60 * 1000
      );

      setTimeout(() => {
        logger.info('Starting initial Reddit scrape');
        startRedditScraping();
      }, 10000);
    } else {
      logger.info('Reddit scraping is disabled. Start with --enable-scraping flag to enable');
    }

    if (enableYouTubeScraping) {
      logger.info('YouTube scraping is enabled');
      setInterval(startYouTubeScraping, 24 * 60 * 60 * 1000);
      setTimeout(() => {
        logger.info('Starting initial YouTube scrape');
        startYouTubeScraping();
      }, 10000);
    } else {
      logger.info('YouTube scraping is disabled. Start with --enable-scraping flag to enable');
    }
  } catch (error) {
    logger.error('Error starting server:', error);
    process.exit(1);
  }
}

startServer();
