import axios from 'axios';
import dotenv from 'dotenv';
import { subreddits } from '../config/subreddits';

dotenv.config();

const REMOTE_INGEST_URL = process.env.REMOTE_INGEST_URL || '';
const INGEST_SECRET = process.env.INGEST_SECRET || process.env.SECURE_ACTION_SECRET || '';
const USER_AGENT = process.env.REDDIT_USER_AGENT || 'web:virtualfeed.xyz:v1.0.0 (by /u/virtualfeed)';
const REQUEST_DELAY_MS = Number(process.env.REDDIT_REQUEST_DELAY_MS || 1200);
const POST_DELAY_MS = Number(process.env.REMOTE_INGEST_POST_DELAY_MS || 150);

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mapListingChildren = (listing: any): any[] => {
  const children = listing?.data?.children || [];
  if (!Array.isArray(children)) return [];
  return children
    .map((child: any) => child?.data)
    .filter((post: any) => post && typeof post.id === 'string');
};

const fetchRedditJsonWithFallback = async (url: string): Promise<any> => {
  const candidates = [url];
  if (url.includes('https://www.reddit.com/')) {
    candidates.push(url.replace('https://www.reddit.com/', 'https://api.reddit.com/'));
    candidates.push(url.replace('https://www.reddit.com/', 'https://old.reddit.com/'));
    candidates.push(url.replace('https://www.reddit.com/', 'https://reddit.com/'));
  }

  let lastError: any = null;
  for (const candidate of candidates) {
    try {
      const response = await axios.get(candidate, {
        timeout: 15000,
        maxRedirects: 5,
        headers: {
          'User-Agent': USER_AGENT,
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept': 'application/json',
          'Cookie': 'over18=1',
          'Referer': 'https://www.reddit.com/'
        }
      });
      return response.data;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError;
};

const postToRemoteIngest = async (post: any, subredditConfig: any): Promise<boolean> => {
  try {
    const response = await axios.post(
      REMOTE_INGEST_URL,
      {
        post,
        subredditConfig: {
          name: subredditConfig.name,
          minScore: subredditConfig.minScore,
          aiFocused: Boolean(subredditConfig.aiFocused),
          excludeTerms: Array.isArray(subredditConfig.excludeTerms) ? subredditConfig.excludeTerms : [],
          searchTerms: []
        }
      },
      {
        timeout: 30000,
        headers: {
          'Content-Type': 'application/json',
          'x-ingest-secret': INGEST_SECRET
        },
        validateStatus: () => true
      }
    );

    return response.status >= 200 && response.status < 300 && Boolean(response.data?.success);
  } catch {
    return false;
  }
};

const run = async (): Promise<void> => {
  if (!REMOTE_INGEST_URL) {
    throw new Error('REMOTE_INGEST_URL is required');
  }
  if (!INGEST_SECRET) {
    throw new Error('INGEST_SECRET (or SECURE_ACTION_SECRET) is required');
  }

  let totalFetched = 0;
  let totalIngested = 0;

  for (const subredditConfig of subreddits) {
    const subredditName = subredditConfig.name;
    console.log(`[remote-ingest] Scraping r/${subredditName}`);

    const listingUrls = [
      `https://www.reddit.com/r/${subredditName}/new.json?limit=60&raw_json=1`,
      `https://www.reddit.com/r/${subredditName}/rising.json?limit=40&raw_json=1`,
      `https://www.reddit.com/r/${subredditName}/hot.json?limit=40&raw_json=1`,
      `https://www.reddit.com/r/${subredditName}/top.json?t=week&limit=40&raw_json=1`
    ];

    const seen = new Set<string>();
    const posts: any[] = [];

    for (const url of listingUrls) {
      try {
        const json = await fetchRedditJsonWithFallback(url);
        const items = mapListingChildren(json);
        for (const item of items) {
          if (!item?.id || seen.has(item.id)) continue;
          seen.add(item.id);
          posts.push(item);
        }
      } catch (error: any) {
        const statusCode = Number(error?.statusCode || error?.response?.status || 0);
        const message = error?.message || 'unknown_error';
        console.warn(`[remote-ingest] Listing fetch failed r/${subredditName}: ${url}`, { statusCode, message });
      }
      await delay(REQUEST_DELAY_MS);
    }

    totalFetched += posts.length;
    let subredditIngested = 0;
    for (const post of posts) {
      const ok = await postToRemoteIngest(post, subredditConfig);
      if (ok) {
        totalIngested += 1;
        subredditIngested += 1;
      }
      await delay(POST_DELAY_MS);
    }

    console.log(`[remote-ingest] r/${subredditName}: fetched=${posts.length}, ingested=${subredditIngested}`);
  }

  console.log(`[remote-ingest] completed fetched=${totalFetched}, ingested=${totalIngested}`);
};

run().catch((error) => {
  console.error('[remote-ingest] failed', error);
  process.exit(1);
});

