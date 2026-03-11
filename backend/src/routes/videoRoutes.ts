import express, { Router } from 'express';
import {
  getVideos,
  updateVideoStats,
  updateUpvotes,
  fetchRedditUpvotes,
  proxyRedditAudio,
  proxyRedditVideo,
  proxyRedditThumbnail,
  secureVideoAction,
  recordVideoEngagement
} from '../controllers/videoController';
import { RedditScraper } from '../services/redditScraper';
import { logger } from '../services/logger';
import { SubredditConfig } from '../config/subreddits';

const router: Router = express.Router();
const INGEST_SECRET = process.env.INGEST_SECRET || process.env.SECURE_ACTION_SECRET || '';

// Submit a new video from Reddit URL
router.post('/submit', async (req: any, res: any) => {
  try {
    const { redditUrl, isNsfw = false } = req.body;

    if (!redditUrl) {
      return res.status(400).json({ 
        success: false, 
        message: 'Reddit URL is required' 
      });
    }

    // Validate Reddit URL format
    const redditUrlPattern = /^https?:\/\/(www\.)?reddit\.com\/r\/[^\/]+\/comments\/[^\/]+\/[^\/]+\/?/;
    if (!redditUrlPattern.test(redditUrl)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid Reddit URL format' 
      });
    }

    logger.info(`Processing video submission: ${redditUrl}`);

    // Use the existing Reddit scraper to process the single post
    const result = await RedditScraper.processSinglePost(redditUrl, isNsfw);

    if (result.success) {
      res.json({
        success: true,
        message: 'Video submitted successfully! It will be reviewed and added to our collection.',
        video: result.video
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.error || 'Failed to process video'
      });
    }

  } catch (error) {
    logger.error('Error in video submission:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Internal server error while processing video submission'
    });
  }
});

// Get videos with filters
router.get('/', getVideos);


router.post('/:id/stats', updateVideoStats);
router.post('/:id/engagement', recordVideoEngagement);
router.post('/:id/upvotes', updateUpvotes);
router.get('/reddit-audio', proxyRedditAudio);
router.get('/reddit-video', proxyRedditVideo);
router.get('/reddit-thumbnail', proxyRedditThumbnail);
router.get('/:id/reddit-upvotes', fetchRedditUpvotes);

// Secure route for marking videos as NSFW or deleting them
// Example usage: /api/videos/123/secure-action?action=nsfw&secret=your-secret-code
// Example usage: /api/videos/123/secure-action?action=delete&secret=your-secret-code
router.get('/:id/secure-action', secureVideoAction);

// Secure remote ingest route (for local scraper worker posting to server)
router.post('/ingest/reddit-post', async (req: any, res: any) => {
  try {
    const providedSecret = req.headers['x-ingest-secret'] || req.body?.secret;
    if (!INGEST_SECRET || providedSecret !== INGEST_SECRET) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized ingest request'
      });
    }

    const post = req.body?.post;
    const subredditConfig = req.body?.subredditConfig as Partial<SubredditConfig> | undefined;

    if (!post || typeof post !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Missing or invalid post payload'
      });
    }

    const result = await RedditScraper.ingestRawPost(post, subredditConfig);
    if (!result.success) {
      return res.status(422).json({
        success: false,
        message: result.error || 'Post was not ingested'
      });
    }

    return res.json({ success: true });
  } catch (error) {
    logger.error('Error in remote reddit ingest route:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
