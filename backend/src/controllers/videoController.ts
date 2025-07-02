import { Request, Response } from 'express';
import Video from '../models/Video';
import axios from 'axios';

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
            const [countResult] = await db.query(countQuery, queryParams);
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
            const [videos] = await db.query(videosQuery, queryParams);
                        
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
    const { url } = req.query;
    
    if (!url || typeof url !== 'string') {
        res.status(400).json({ message: 'URL parameter is required' });
        return;
    }
    
    try {
        // Only allow Reddit audio URLs
        if (!url.includes('v.redd.it')) {
            res.status(403).json({ message: 'Only Reddit audio URLs are allowed' });
            return;
        }
        
        console.log(`Proxying Reddit audio: ${url}`);
        
        const response = await axios({
            method: 'get',
            url,
            responseType: 'stream',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.reddit.com/',
                'Accept': '*/*',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive'
            },
            timeout: 10000 // 10 second timeout
        });
        
        // Forward content type header
        if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        } else {
            res.setHeader('Content-Type', 'audio/mp4');
        }
        
        // Set cache headers
        res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 24 hours
        
        // Pipe the response stream directly to the client
        response.data.pipe(res);
    } catch (error: any) {
        console.error(`Error proxying Reddit audio: ${error.message}`);
        
        // Check if headers have already been sent
        if (!res.headersSent) {
            res.status(500).json({ 
                message: 'Failed to proxy audio', 
                error: error.message 
            });
        }
    }
};
