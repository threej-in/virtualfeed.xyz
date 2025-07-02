import Snoowrap from 'snoowrap';
import dotenv from 'dotenv';

dotenv.config();

export const redditClient = new Snoowrap({
    userAgent: 'virtualfeed-app',
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    refreshToken: process.env.REDDIT_REFRESH_TOKEN
});
