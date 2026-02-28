import { RedditScraper } from '../services/redditScraper';
import { logger } from '../services/logger';

const parseLimit = (): number => {
  const arg = process.argv.find((item) => item.startsWith('--limit='));
  const fromArg = arg ? Number(arg.split('=').slice(1).join('=')) : NaN;
  const fromEnv = Number(process.env.REDDIT_MEDIA_REFRESH_LIMIT || 200);
  const value = Number.isFinite(fromArg) && fromArg > 0 ? fromArg : fromEnv;
  return Math.max(1, value);
};

const run = async () => {
  const limit = parseLimit();
  const updated = await RedditScraper.refreshRecentMediaSources(limit);
  logger.info(`Manual reddit media refresh finished. Updated=${updated}`);
};

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Manual reddit media refresh failed:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      });
      process.exit(1);
    });
}

export default run;
