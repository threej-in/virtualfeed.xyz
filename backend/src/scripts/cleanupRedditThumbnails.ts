import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { logger } from '../services/logger';

dotenv.config();

type VideoRow = {
  id: number;
  thumbnailUrl: string | null;
};

const DEFAULT_PLACEHOLDER_URL =
  'https://via.placeholder.com/400x720/1a1a1a/ffffff?text=Video';

const PLACEHOLDER_URL =
  process.env.REDDIT_FALLBACK_THUMBNAIL_URL || DEFAULT_PLACEHOLDER_URL;

function isDryRun(): boolean {
  return process.argv.includes('--dry-run');
}

function isBrokenLocalThumbnail(thumbnailUrl: string): boolean {
  if (!thumbnailUrl.startsWith('/thumbnails/')) {
    return false;
  }

  const relativePath = thumbnailUrl.startsWith('/')
    ? thumbnailUrl.slice(1)
    : thumbnailUrl;
  const absolutePath = path.join(process.cwd(), 'public', relativePath);

  if (!fs.existsSync(absolutePath)) {
    return true;
  }

  try {
    const stats = fs.statSync(absolutePath);
    return !stats.isFile() || stats.size === 0;
  } catch (_error) {
    return true;
  }
}

function shouldReplaceThumbnail(thumbnailUrl: string | null): boolean {
  if (!thumbnailUrl || !thumbnailUrl.trim()) {
    return true;
  }

  return isBrokenLocalThumbnail(thumbnailUrl.trim());
}

async function cleanupRedditThumbnails() {
  const dryRun = isDryRun();
  const db = require('../config/database').default;

  const [rows] = await db.query(
    `
      SELECT id, thumbnailUrl
      FROM videos
      WHERE platform = 'reddit'
    `
  );

  const videos = rows as VideoRow[];
  let scanned = 0;
  let fixed = 0;

  for (const video of videos) {
    scanned++;
    if (!shouldReplaceThumbnail(video.thumbnailUrl)) {
      continue;
    }

    if (!dryRun) {
      await db.query('UPDATE videos SET thumbnailUrl = ? WHERE id = ?', {
        replacements: [PLACEHOLDER_URL, video.id],
      });
    }

    fixed++;
  }

  logger.info(
    `Reddit thumbnail cleanup completed (dryRun=${dryRun}). Scanned=${scanned}, Fixed=${fixed}, Placeholder=${PLACEHOLDER_URL}`
  );
}

if (require.main === module) {
  cleanupRedditThumbnails()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Reddit thumbnail cleanup failed:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      });
      process.exit(1);
    });
}

export default cleanupRedditThumbnails;
