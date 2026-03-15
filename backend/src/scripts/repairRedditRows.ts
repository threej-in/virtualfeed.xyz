import Video from '../models/Video';
import { logger } from '../services/logger';

const hasPlayableUrl = (value: string | undefined): boolean => {
  if (!value || typeof value !== 'string') return false;
  return /v\.redd\.it|\.mp4(\?|$)|\.webm(\?|$)|\.gifv(\?|$)|format=mp4/i.test(value);
};

const hasUsableRedditSources = (metadata: any): boolean => {
  const sources = metadata?.redditVideoSources;
  if (!sources || typeof sources !== 'object') return false;

  if (hasPlayableUrl(sources.fallbackUrl) || hasPlayableUrl(sources.dashUrl) || hasPlayableUrl(sources.hlsUrl)) {
    return true;
  }

  if (Array.isArray(sources.mp4Candidates)) {
    return sources.mp4Candidates.some((candidate: any) => hasPlayableUrl(candidate));
  }

  return false;
};

const parseMetadata = (raw: any): any => {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return {};
};

const isRepairable = (video: any): boolean => {
  const metadata = parseMetadata(video.metadata);
  const thumbnailUrl = typeof video.thumbnailUrl === 'string' ? video.thumbnailUrl.trim() : '';
  const videoUrl = typeof video.videoUrl === 'string' ? video.videoUrl.trim() : '';

  if (!thumbnailUrl) return false;
  if (!hasPlayableUrl(videoUrl) && !hasUsableRedditSources(metadata)) return false;

  return true;
};

const dryRun = process.argv.includes('--dry-run');

const run = async () => {
  const rows = await Video.findAll({
    where: {
      platform: 'reddit',
      blacklisted: true
    }
  });

  let repairableCount = 0;
  let repairedCount = 0;

  for (const video of rows) {
    if (!isRepairable(video)) continue;
    repairableCount++;

    if (!dryRun) {
      await video.update({ blacklisted: false });
      repairedCount++;
    }
  }

  logger.info(`Reddit repair scan completed. repairable=${repairableCount} repaired=${dryRun ? 0 : repairedCount} dryRun=${dryRun}`);
};

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Reddit repair script failed:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      });
      process.exit(1);
    });
}

export default run;
