import crypto from 'crypto';

type FeedMemoryEntry = {
  ids: number[];
  updatedAt: number;
};

const FEED_MEMORY_TTL_MS = Number(process.env.FEED_MEMORY_TTL_HOURS || 24) * 60 * 60 * 1000;
const FEED_MEMORY_MAX_IDS = Number(process.env.FEED_MEMORY_MAX_IDS || 300);
const store = new Map<string, FeedMemoryEntry>();

const cleanupExpired = () => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    if (now - entry.updatedAt > FEED_MEMORY_TTL_MS) {
      store.delete(key);
    }
  }
};

export const buildFeedMemoryKey = (
  forwardedFor: string | undefined,
  remoteAddress: string | undefined,
  userAgent: string | undefined,
  language: string | undefined
): string => {
  const clientIp = (forwardedFor || remoteAddress || '').split(',')[0]?.trim() || 'unknown';
  const ua = userAgent || 'unknown';
  const lang = language || 'unknown';
  const raw = `${clientIp}|${ua}|${lang}`;
  return crypto.createHash('sha1').update(raw).digest('hex');
};

export const getRecentFeedIds = (key: string): number[] => {
  cleanupExpired();
  const entry = store.get(key);
  if (!entry) return [];
  return entry.ids;
};

export const rememberFeedIds = (key: string, ids: number[]): void => {
  if (!ids.length) return;

  cleanupExpired();

  const existing = store.get(key);
  const merged = [...(existing?.ids || []), ...ids];

  // Keep order while removing duplicates (latest wins).
  const deduped: number[] = [];
  const seen = new Set<number>();
  for (let i = merged.length - 1; i >= 0; i--) {
    const id = merged[i];
    if (seen.has(id)) continue;
    seen.add(id);
    deduped.push(id);
  }
  deduped.reverse();

  const trimmed = deduped.slice(-FEED_MEMORY_MAX_IDS);
  store.set(key, {
    ids: trimmed,
    updatedAt: Date.now(),
  });
};

