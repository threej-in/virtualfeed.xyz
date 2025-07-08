import express, { Router } from 'express';
import { blacklistVideo, unblacklistVideo, getBlacklistedVideos } from '../controllers/blacklistController';

const router: Router = express.Router();

// Blacklist a video
router.post('/:id/add', blacklistVideo);

// Remove a video from blacklist
router.post('/:id/remove', unblacklistVideo);

// Get all blacklisted videos
router.get('/', getBlacklistedVideos);

export default router;
