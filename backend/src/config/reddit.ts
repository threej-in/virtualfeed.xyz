import Snoowrap from 'snoowrap';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const redditUserAgent =
    process.env.REDDIT_USER_AGENT ||
    'web:virtualfeed.xyz:v1.0.0 (by /u/virtualfeed)';

export const redditClient = new Snoowrap({
    userAgent: redditUserAgent,
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    refreshToken: process.env.REDDIT_REFRESH_TOKEN
});
