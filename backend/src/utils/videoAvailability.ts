import axios from 'axios';

type CacheEntry = {
  available: boolean;
  checkedAt: number;
};

const availabilityCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

const YOUTUBE_ID_REGEX =
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/;

function extractYouTubeId(video: any): string | null {
  const metadataId = video?.metadata?.youtubeId;
  if (typeof metadataId === 'string' && metadataId.length === 11) {
    return metadataId;
  }

  const videoUrl = video?.videoUrl;
  if (typeof videoUrl !== 'string') {
    return null;
  }

  const match = videoUrl.match(YOUTUBE_ID_REGEX);
  return match?.[1] || null;
}

async function isYouTubeVideoAvailable(youtubeId: string): Promise<boolean> {
  const cached = availabilityCache.get(youtubeId);
  const now = Date.now();

  if (cached && now - cached.checkedAt < CACHE_TTL_MS) {
    return cached.available;
  }

  try {
    const watchUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    await axios.get('https://www.youtube.com/oembed', {
      params: { url: watchUrl, format: 'json' },
      timeout: 5000,
    });

    availabilityCache.set(youtubeId, { available: true, checkedAt: now });
    return true;
  } catch {
    availabilityCache.set(youtubeId, { available: false, checkedAt: now });
    return false;
  }
}

export async function filterAvailableVideos<T extends { platform?: string }>(
  videos: T[]
): Promise<T[]> {
  if (!Array.isArray(videos) || videos.length === 0) {
    return [];
  }

  const checks = videos.map(async (video) => {
    if (video.platform !== 'youtube') {
      return true;
    }

    const youtubeId = extractYouTubeId(video);
    if (!youtubeId) {
      return false;
    }

    return isYouTubeVideoAvailable(youtubeId);
  });

  const results = await Promise.all(checks);
  return videos.filter((_, index) => results[index]);
}

