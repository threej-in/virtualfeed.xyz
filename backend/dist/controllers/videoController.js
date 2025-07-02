"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchRedditUpvotes = exports.updateUpvotes = exports.updateVideoStats = exports.getVideos = void 0;
const Video_1 = __importDefault(require("../models/Video"));
const getVideos = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('getVideos endpoint called with query:', req.query);
    try {
        const { page = 1, limit = 12, search, sortBy = 'createdAt', order = 'desc', subreddit, showNsfw = 'false' } = req.query;
        const pageNum = Number(page);
        const limitNum = Number(limit);
        const offset = (pageNum - 1) * limitNum;
        // Use the sequelize instance directly from the database config
        const db = require('../config/database').default;
        try {
            // Build the WHERE clause for the SQL query
            let whereConditions = [];
            let queryParams = [];
            console.log(showNsfw);
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
                whereConditions.push('(nsfw = ? OR nsfw IS NULL)');
                queryParams.push(0);
                console.log('Filtering NSFW content');
            }
            else {
                console.log('Including NSFW content');
            }
            const whereClause = whereConditions.length > 0
                ? `WHERE ${whereConditions.join(' AND ')}`
                : '';
            // Count matching records with filters
            const countQuery = `SELECT COUNT(*) as count FROM videos ${whereClause}`;
            console.log('Count query:', countQuery);
            console.log('Count query params:', queryParams);
            const [countResult] = yield db.query(countQuery, queryParams);
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
            const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
            const finalOrder = order === 'asc' ? 'ASC' : 'DESC';
            // Get paginated videos
            const videosQuery = `
                SELECT * FROM videos 
                ${whereClause} 
                ORDER BY ${finalSortBy} ${finalOrder} 
                LIMIT ${limitNum} OFFSET ${offset}
            `;
            console.log('Videos query:', videosQuery);
            console.log('Query parameters:', queryParams);
            const [videos] = yield db.query(videosQuery, queryParams);
            res.json({
                videos,
                total: count,
                pages: Math.ceil(count / limitNum),
                currentPage: pageNum
            });
        }
        catch (dbError) {
            console.error('Database error:', dbError);
            res.status(500).json({ message: 'Database error occurred' });
        }
    }
    catch (error) {
        console.error('Error fetching videos:', error);
        if (error instanceof Error) {
            console.error('Error details:', error.message, error.stack);
        }
        res.status(500).json({ message: 'Error fetching videos' });
    }
});
exports.getVideos = getVideos;
const updateVideoStats = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { type } = req.body;
        const video = yield Video_1.default.findByPk(id);
        if (!video) {
            res.status(404).json({ message: 'Video not found' });
            return;
        }
        if (type === 'view') {
            video.views += 1;
        }
        else if (type === 'like') {
            video.likes += 1;
        }
        yield video.save();
        res.json({ success: true, video });
    }
    catch (error) {
        console.error('Error updating video stats:', error);
        res.status(500).json({ message: 'Error updating video stats' });
    }
});
exports.updateVideoStats = updateVideoStats;
const updateUpvotes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const { upvotes } = req.body;
        if (typeof upvotes !== 'number') {
            res.status(400).json({ message: 'Upvotes must be a number' });
            return;
        }
        const video = yield Video_1.default.findByPk(id);
        if (!video) {
            res.status(404).json({ message: 'Video not found' });
            return;
        }
        // Update the metadata object with the new upvotes value
        const metadata = Object.assign(Object.assign({}, video.metadata), { upvotes });
        // Update the video record
        yield video.update({ metadata });
        res.json({ success: true, video });
    }
    catch (error) {
        console.error('Error updating upvotes:', error);
        res.status(500).json({ message: 'Error updating upvotes' });
    }
});
exports.updateUpvotes = updateUpvotes;
const fetchRedditUpvotes = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const video = yield Video_1.default.findByPk(id);
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
            const submission = yield redditClient.getSubmission(redditId).fetch();
            // Get the current score (upvotes)
            const upvotes = submission.score;
            // Update the metadata object with the new upvotes value
            const metadata = Object.assign(Object.assign({}, video.metadata), { upvotes });
            // Update the video record
            yield video.update({ metadata });
            res.json({ success: true, upvotes, video });
        }
        catch (redditError) {
            console.error('Error fetching from Reddit API:', redditError);
            res.status(500).json({ message: 'Error fetching upvotes from Reddit' });
        }
    }
    catch (error) {
        console.error('Error in fetchRedditUpvotes:', error);
        res.status(500).json({ message: 'Server error' });
    }
});
exports.fetchRedditUpvotes = fetchRedditUpvotes;
