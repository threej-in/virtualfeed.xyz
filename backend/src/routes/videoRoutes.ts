import express, { Router } from 'express';
import { getVideos, updateVideoStats, updateUpvotes, fetchRedditUpvotes } from '../controllers/videoController';

const router: Router = express.Router();

router.get('/', getVideos);
router.post('/:id/stats', updateVideoStats);
router.post('/:id/upvotes', updateUpvotes);
router.get('/:id/reddit-upvotes', fetchRedditUpvotes);

export default router;
