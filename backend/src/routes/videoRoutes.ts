import express, { Router } from 'express';
import { getVideos, updateVideoStats, updateUpvotes, fetchRedditUpvotes, secureVideoAction } from '../controllers/videoController';
import { RedditScraper } from '../services/redditScraper';
import { logger } from '../services/logger';

const router: Router = express.Router();

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
      logger.info(`Video submitted successfully: ${result.video?.title}`);
      res.json({
        success: true,
        message: 'Video submitted successfully! It will be reviewed and added to our collection.',
        video: result.video
      });
    } else {
      logger.warn(`Video submission failed: ${result.error}`);
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
router.post('/:id/upvotes', updateUpvotes);
router.get('/:id/reddit-upvotes', fetchRedditUpvotes);

// Secure route for marking videos as NSFW or deleting them
// Example usage: /api/videos/123/secure-action?action=nsfw&secret=your-secret-code
// Example usage: /api/videos/123/secure-action?action=delete&secret=your-secret-code
router.get('/:id/secure-action', secureVideoAction);

export default router;
