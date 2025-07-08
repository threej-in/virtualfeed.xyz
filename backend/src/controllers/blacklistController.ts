import { Request, Response } from 'express';
import Video from '../models/Video';
import dotenv from 'dotenv';

dotenv.config();

// Secret code for secure actions
const SECURE_ACTION_SECRET = process.env.SECURE_ACTION_SECRET || 'default-secret-change-me';

/**
 * Blacklist a video
 * Requires a secret code for authentication
 */
export const blacklistVideo = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { secret } = req.body;
        
        // Validate required parameters
        if (!id) {
            res.status(400).json({ error: 'Video ID is required' });
            return;
        }
        
        if (!secret) {
            res.status(400).json({ error: 'Secret code is required' });
            return;
        }
        
        // Verify secret code
        if (secret !== SECURE_ACTION_SECRET) {
            res.status(403).json({ error: 'Invalid secret code' });
            return;
        }
        
        // Find the video
        const video = await Video.findByPk(id);
        
        if (!video) {
            res.status(404).json({ error: 'Video not found' });
            return;
        }
        
        // Check if already blacklisted
        if (video.blacklisted) {
            res.status(200).json({ 
                message: 'Video was already blacklisted',
                video: {
                    id: video.id,
                    title: video.title,
                    blacklisted: true
                }
            });
            return;
        }
        
        // Mark video as blacklisted
        await video.update({ blacklisted: true });
        
        res.status(200).json({ 
            message: 'Video blacklisted successfully',
            video: {
                id: video.id,
                title: video.title,
                blacklisted: true
            }
        });
    } catch (error) {
        console.error('Error blacklisting video:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Remove a video from blacklist
 * Requires a secret code for authentication
 */
export const unblacklistVideo = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { secret } = req.body;
        
        // Validate required parameters
        if (!id) {
            res.status(400).json({ error: 'Video ID is required' });
            return;
        }
        
        if (!secret) {
            res.status(400).json({ error: 'Secret code is required' });
            return;
        }
        
        // Verify secret code
        if (secret !== SECURE_ACTION_SECRET) {
            res.status(403).json({ error: 'Invalid secret code' });
            return;
        }
        
        // Find the video
        const video = await Video.findByPk(id);
        
        if (!video) {
            res.status(404).json({ error: 'Video not found' });
            return;
        }
        
        // Check if not blacklisted
        if (!video.blacklisted) {
            res.status(200).json({ 
                message: 'Video was not blacklisted',
                video: {
                    id: video.id,
                    title: video.title,
                    blacklisted: false
                }
            });
            return;
        }
        
        // Remove video from blacklist
        await video.update({ blacklisted: false });
        
        res.status(200).json({ 
            message: 'Video removed from blacklist successfully',
            video: {
                id: video.id,
                title: video.title,
                blacklisted: false
            }
        });
    } catch (error) {
        console.error('Error removing video from blacklist:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Get all blacklisted videos
 * Requires a secret code for authentication
 */
export const getBlacklistedVideos = async (req: Request, res: Response): Promise<void> => {
    try {
        const { secret } = req.query;
        
        // Validate required parameters
        if (!secret || typeof secret !== 'string') {
            res.status(400).json({ error: 'Secret code is required' });
            return;
        }
        
        // Verify secret code
        if (secret !== SECURE_ACTION_SECRET) {
            res.status(403).json({ error: 'Invalid secret code' });
            return;
        }
        
        // Get all blacklisted videos
        const videos = await Video.findAll({
            where: {
                blacklisted: true
            }
        });
        
        res.status(200).json({ 
            message: `Found ${videos.length} blacklisted videos`,
            videos: videos.map(video => ({
                id: video.id,
                title: video.title,
                subreddit: video.subreddit,
                createdAt: video.createdAt
            }))
        });
    } catch (error) {
        console.error('Error fetching blacklisted videos:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
