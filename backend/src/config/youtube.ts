import dotenv from 'dotenv';

dotenv.config();

export const youtubeConfig = {
  apiKey: process.env.YOUTUBE_API_KEY || '',
  baseUrl: 'https://www.googleapis.com/youtube/v3',
  maxResults: 50, // Maximum results per request (YouTube API limit)
  quotaLimit: 10000, // Daily quota limit for YouTube API
  quotaUsed: 0, // Track quota usage
};

// YouTube API endpoints
export const youtubeEndpoints = {
  search: `${youtubeConfig.baseUrl}/search`,
  videos: `${youtubeConfig.baseUrl}/videos`,
  channels: `${youtubeConfig.baseUrl}/channels`,
};

// Helper function to check if API key is configured
export function isYouTubeApiConfigured(): boolean {
  return !!youtubeConfig.apiKey;
}

// Helper function to track quota usage
export function incrementQuotaUsage(cost: number = 100): void {
  youtubeConfig.quotaUsed += cost;
}

// Helper function to get remaining quota
export function getRemainingQuota(): number {
  return youtubeConfig.quotaLimit - youtubeConfig.quotaUsed;
}

// Helper function to check if we have enough quota
export function hasEnoughQuota(estimatedCost: number = 100): boolean {
  return getRemainingQuota() >= estimatedCost;
} 