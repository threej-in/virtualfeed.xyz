import dotenv from 'dotenv';
import { logger } from '../services/logger';
import { LanguageDetector } from '../utils/languageDetection';

dotenv.config();

type VideoRow = {
  id: number;
  title: string | null;
  description: string | null;
  tags: any;
  language: string | null;
};

function parseArgs() {
  const args = process.argv.slice(2);
  const getFlag = (name: string) => args.includes(name);
  const getValue = (name: string, fallback: string) => {
    const hit = args.find((arg) => arg.startsWith(`${name}=`));
    return hit ? hit.split('=').slice(1).join('=') : fallback;
  };

  return {
    onlyMissing: getFlag('--only-missing'),
    batchSize: Math.max(50, Number(getValue('--batch', '500')) || 500),
  };
}

function normalizeTags(tags: any): string[] {
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag));
  }

  if (typeof tags === 'string') {
    try {
      const parsed = JSON.parse(tags);
      if (Array.isArray(parsed)) {
        return parsed.map((tag) => String(tag));
      }
    } catch (_error) {
      // Keep non-JSON tags as free text signal.
      if (tags.trim()) return [tags.trim()];
    }
  }

  return [];
}

async function reindexVideoLanguages() {
  const { onlyMissing, batchSize } = parseArgs();
  const db = require('../config/database').default;

  const missingClause = `(language IS NULL OR language = '')`;
  const whereClause = onlyMissing ? `WHERE ${missingClause}` : '';

  const [countRows] = await db.query(`SELECT COUNT(*) AS total FROM videos ${whereClause}`);
  const total = Number(countRows?.[0]?.total || 0);

  logger.info(
    `Starting language reindex for ${total} videos (${onlyMissing ? 'only missing languages' : 'full reindex'})`
  );

  let lastId = 0;
  let scanned = 0;
  let updated = 0;

  while (true) {
    const selectionWhere = [
      'id > ?',
      ...(onlyMissing ? [missingClause] : [])
    ].join(' AND ');

    const [rows] = await db.query(
      `
        SELECT id, title, description, tags, language
        FROM videos
        WHERE ${selectionWhere}
        ORDER BY id ASC
        LIMIT ?
      `,
      { replacements: [lastId, batchSize] }
    );

    const videos = rows as VideoRow[];
    if (videos.length === 0) {
      break;
    }

    for (const video of videos) {
      const detected = await LanguageDetector.detectVideoLanguage({
        title: video.title || '',
        description: video.description || '',
        tags: normalizeTags(video.tags),
      });

      scanned++;
      lastId = video.id;

      if (detected.language && detected.language !== (video.language || '')) {
        await db.query('UPDATE videos SET language = ? WHERE id = ?', {
          replacements: [detected.language, video.id],
        });
        updated++;
      }
    }

    logger.info(`Progress: scanned ${scanned}/${total}, updated ${updated}`);
  }

  logger.info(`Language reindex completed. Scanned=${scanned}, Updated=${updated}, Total=${total}`);
}

if (require.main === module) {
  reindexVideoLanguages()
    .then(() => process.exit(0))
    .catch((error) => {
      logger.error('Language reindex failed:', {
        name: error?.name,
        message: error?.message,
        stack: error?.stack,
      });
      process.exit(1);
    });
}

export default reindexVideoLanguages;
