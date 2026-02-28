import axios from 'axios';

type CacheEntry = {
  available: boolean;
  checkedAt: number;
};

const availabilityCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

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
    // Prefer YouTube Data API when available to ensure the video is embeddable.
    if (YOUTUBE_API_KEY) {
      const apiResponse = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
        params: {
          part: 'status',
          id: youtubeId,
          key: YOUTUBE_API_KEY,
        },
        timeout: 5000,
      });

      const item = apiResponse.data?.items?.[0];
      const status = item?.status;
      const isEmbeddable = status?.embeddable === true;
      const privacyStatus = status?.privacyStatus;
      const uploadStatus = status?.uploadStatus;
      const isPublicOrUnlisted = privacyStatus === 'public' || privacyStatus === 'unlisted';
      const isUploadActive = uploadStatus === 'processed' || uploadStatus === 'uploaded';

      const available = Boolean(item && isEmbeddable && isPublicOrUnlisted && isUploadActive);
      availabilityCache.set(youtubeId, { available, checkedAt: now });
      return available;
    }

    // Fallback check if API key is missing.
    const watchUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
    await axios.get('https://www.youtube.com/oembed', {
      params: { url: watchUrl, format: 'json' },
      timeout: 5000,
    });

    availabilityCache.set(youtubeId, { available: true, checkedAt: now });
    return true;
  } catch (error: any) {
    const status = Number(error?.response?.status || 0);

    // Definitive unavailability signals from YouTube/oEmbed.
    if ([401, 403, 404].includes(status)) {
      availabilityCache.set(youtubeId, { available: false, checkedAt: now });
      return false;
    }

    // Network/transient failures should not blank the feed.
    availabilityCache.set(youtubeId, { available: true, checkedAt: now });
    return true;
  }
}

export async function filterAvailableVideos<T extends { platform?: string }>(
  videos: T[]
): Promise<T[]> {
  if (!Array.isArray(videos) || videos.length === 0) {
    return [];
  }

  const checks = videos.map(async (video) => {
    const thumbnailUrl = (video as any)?.thumbnailUrl;
    if (typeof thumbnailUrl !== 'string' || thumbnailUrl.trim().length === 0) {
      return false;
    }

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
