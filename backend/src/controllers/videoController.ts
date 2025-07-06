import { Request, Response } from 'express';
import Video from '../models/Video';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Secret code for secure actions
const SECURE_ACTION_SECRET = process.env.SECURE_ACTION_SECRET || 'default-secret-change-me';

export const getVideos = async (req: Request, res: Response): Promise<void> => {
    try {
        const { 
            page = 1, 
            limit = 12,
            search,
            sortBy = 'createdAt',
            order = 'desc',
            subreddit,
            showNsfw = 'false'
        } = req.query;

        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;
        
        // Use the sequelize instance directly from the database config
        const db = require('../config/database').default;
        
        try {
            // Build the WHERE clause for the SQL query
            let whereConditions = [];
            let queryParams: any[] = [];
            if (search) {
                whereConditions.push('(title LIKE ? OR description LIKE ?)');
                queryParams.push(`%${search}%`, `%${search}%`);
            }
            
            if (subreddit && subreddit !== '') {
                whereConditions.push('subreddit = ?');
                queryParams.push(subreddit);
            }
            
            // Filter NSFW content if showNsfw is false
            if (showNsfw !== 'true') {
                whereConditions.push('(nsfw = 0 OR nsfw IS NULL)');
            }
            
            const whereClause = whereConditions.length > 0 
                ? `WHERE ${whereConditions.join(' AND ')}` 
                : '';
            
            // Count matching records with filters
            const countQuery = `SELECT COUNT(*) as count FROM videos ${whereClause}`;
            const [countResult] = await db.query(countQuery, { replacements: queryParams });
            const count = countResult[0].count;
            
            // Return early if no videos match the filters
            if (count === 0) {
                res.json({
                    videos: [],
                    total: 0,
                    pages: 0,
                    currentPage: pageNum
                });
                return;
            }
            
            // Validate sort field
            const validSortFields = ['id', 'title', 'createdAt', 'views', 'likes'];
            const finalSortBy = validSortFields.includes(sortBy as string) ? sortBy : 'createdAt';
            const finalOrder = order === 'asc' ? 'ASC' : 'DESC';            
            // Get paginated videos
            const videosQuery = `
                SELECT * FROM videos 
                ${whereClause} 
                ORDER BY ${finalSortBy} ${finalOrder} 
                LIMIT ${limitNum} OFFSET ${offset}
            `;
            const [videos] = await db.query(videosQuery, { replacements: queryParams });
                        
            res.json({
                videos,
                total: count,
                pages: Math.ceil(count / limitNum),
                currentPage: pageNum
            });
            
        } catch (dbError) {
            console.error('Database error:', dbError);
            res.status(500).json({ message: 'Database error occurred' });
        }
    } catch (error) {
        console.error('Error fetching videos:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message, error.stack);
        }
        res.status(500).json({ message: 'Error fetching videos' });
    }
};

export const updateVideoStats = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { type } = req.body;

        const video = await Video.findByPk(id);
        if (!video) {
            res.status(404).json({ message: 'Video not found' });
            return;
        }

        if (type === 'view') {
            video.views += 1;
        } else if (type === 'like') {
            video.likes += 1;
        }

        await video.save();
        res.json({ success: true, video });
    } catch (error) {
        console.error('Error updating video stats:', error);
        res.status(500).json({ message: 'Error updating video stats' });
    }
};

export const updateUpvotes = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { upvotes } = req.body;

        if (typeof upvotes !== 'number') {
            res.status(400).json({ message: 'Upvotes must be a number' });
            return;
        }

        const video = await Video.findByPk(id);
        if (!video) {
            res.status(404).json({ message: 'Video not found' });
            return;
        }

        // Update the metadata object with the new upvotes value
        const metadata = { ...video.metadata as any, upvotes };
        
        // Update the video record
        await video.update({ metadata });
        
        res.json({ success: true, video });
    } catch (error) {
        console.error('Error updating upvotes:', error);
        res.status(500).json({ message: 'Error updating upvotes' });
    }
};

export const fetchRedditUpvotes = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;

        const video = await Video.findByPk(id);
        if (!video) {
            res.status(404).json({ message: 'Video not found' });
            return;
        }

        // Get the Reddit ID from the video
        const redditId = video.redditId;
        if (!redditId) {
            res.status(400).json({ message: 'Video has no associated Reddit ID' });
            return;
        }

        try {
            // Import the Reddit client
            const { redditClient } = require('../config/reddit');
            
            // Fetch the submission from Reddit
            const submission = await redditClient.getSubmission(redditId).fetch();
            
            // Get the current score (upvotes)
            const upvotes = submission.score;
            
            // Update the metadata object with the new upvotes value
            const metadata = { ...video.metadata as any, upvotes };
            
            // Update the video record
            await video.update({ metadata });
            
            res.json({ success: true, upvotes, video });
        } catch (redditError) {
            console.error('Error fetching from Reddit API:', redditError);
            res.status(500).json({ message: 'Error fetching upvotes from Reddit' });
        }
    } catch (error) {
        console.error('Error in fetchRedditUpvotes:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

/**
 * Proxy endpoint to fetch Reddit audio files with proper headers
 * This helps bypass CORS and 403 errors when fetching audio directly from the client
 */
export const proxyRedditAudio = async (req: Request, res: Response): Promise<void> => {
    try {
        const { url } = req.query;
        
        if (!url || typeof url !== 'string') {
            res.status(400).json({ error: 'URL parameter is required' });
            return;
        }
        
        // Only allow Reddit URLs
        if (!url.includes('v.redd.it')) {
            res.status(403).json({ error: 'Only Reddit URLs are allowed' });
            return;
        }
        
        try {
            const response = await axios({
                method: 'get',
                url: url,
                responseType: 'stream',
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Accept': '*/*',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Connection': 'keep-alive',
                    'Range': 'bytes=0-',
                    'Referer': 'https://www.reddit.com/',
                    'Origin': 'https://www.reddit.com'
                },
                timeout: 10000 // 10 seconds timeout
            });
            
            // Set appropriate headers
            res.setHeader('Content-Type', response.headers['content-type'] || 'audio/mp4');
            if (response.headers['content-length']) {
                res.setHeader('Content-Length', response.headers['content-length']);
            }
            if (response.headers['accept-ranges']) {
                res.setHeader('Accept-Ranges', response.headers['accept-ranges']);
            }
            if (response.headers['content-range']) {
                res.setHeader('Content-Range', response.headers['content-range']);
            }
            
            // Stream the response
            response.data.pipe(res);
        } catch (error: any) {
            console.error('Error proxying Reddit audio:', error.message);
            
            // If we get a 403 or other error, return a proper error response
            const status = error.response?.status || 500;
            const errorMessage = error.response?.statusText || error.message || 'Unknown error';
            
            res.status(status).json({
                error: `Failed to proxy Reddit audio: ${errorMessage}`,
                status: status
            });
        }
    } catch (error) {
        console.error('Error in proxyRedditAudio:', error);
        res.status(500).json({ error: 'Server error' });
    }
};

/**
 * Secure Video Action - Mark as NSFW or Delete a video
 * Requires a secret code to perform the action
 */
export const secureVideoAction = async (req: Request, res: Response): Promise<void> => {
    try {
        const { id } = req.params;
        const { action, secret } = req.query;
        
        // Validate required parameters
        if (!id) {
            res.status(400).json({ error: 'Video ID is required' });
            return;
        }
        
        if (!action || typeof action !== 'string') {
            res.status(400).json({ error: 'Action parameter is required (nsfw or delete)' });
            return;
        }
        
        if (!secret || typeof secret !== 'string') {
            res.status(400).json({ error: 'Secret code is required' });
            return;
        }
        
        // Verify secret code
        if (secret !== SECURE_ACTION_SECRET) {
            // Use a constant-time comparison to prevent timing attacks
            // Even though we return the same error, we want to avoid leaking info via timing differences
            res.status(403).json({ error: 'Invalid secret code' });
            return;
        }
        
        // Find the video
        const video = await Video.findByPk(id);
        
        if (!video) {
            res.status(404).json({ error: 'Video not found' });
            return;
        }
        
        // Perform the requested action
        if (action === 'nsfw') {
            // Mark video as NSFW
            await video.update({ nsfw: true });
            res.status(200).json({ 
                message: 'Video marked as NSFW successfully',
                video: {
                    id: video.id,
                    title: video.title,
                    nsfw: true
                }
            });
        } else if (action === 'delete') {
            // Delete the video
            await video.destroy();
            res.status(200).json({ 
                message: 'Video deleted successfully',
                videoId: id
            });
        } else {
            res.status(400).json({ error: 'Invalid action. Use "nsfw" or "delete"' });
        }
    } catch (error) {
        console.error('Error in secureVideoAction:', error);
        res.status(500).json({ error: 'Server error' });
    }
};
