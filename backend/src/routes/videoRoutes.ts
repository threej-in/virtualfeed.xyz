import express, { Router } from 'express';
import { getVideos, updateVideoStats, updateUpvotes, fetchRedditUpvotes, secureVideoAction } from '../controllers/videoController';

const router: Router = express.Router();

router.get('/', getVideos);
router.post('/:id/stats', updateVideoStats);
router.post('/:id/upvotes', updateUpvotes);
router.get('/:id/reddit-upvotes', fetchRedditUpvotes);

// Secure route for marking videos as NSFW or deleting them
// Example usage: /api/videos/123/secure-action?action=nsfw&secret=your-secret-code
// Example usage: /api/videos/123/secure-action?action=delete&secret=your-secret-code
router.get('/:id/secure-action', secureVideoAction);

export default router;
