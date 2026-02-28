import axios from 'axios';
import { logger } from './logger';
import Video from '../models/Video';
import { youtubeConfig, youtubeEndpoints, isYouTubeApiConfigured, incrementQuotaUsage, hasEnoughQuota } from '../config/youtube';
import { getEnabledSearchTerms, YouTubeSearchConfig } from '../config/youtubeSearchTerms';

interface YouTubeSearchResponse {
  kind: string;
  etag: string;
  nextPageToken?: string;
  regionCode: string;
  pageInfo: {
    totalResults: number;
    resultsPerPage: number;
  };
  items: YouTubeSearchItem[];
}

interface YouTubeSearchItem {
  kind: string;
  etag: string;
  id: {
    kind: string;
    videoId: string;
  };
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      default: { url: string; width: number; height: number };
      medium: { url: string; width: number; height: number };
      high: { url: string; width: number; height: number };
      standard?: { url: string; width: number; height: number };
      maxres?: { url: string; width: number; height: number };
    };
    channelTitle: string;
    tags?: string[];
    categoryId: string;
    liveBroadcastContent: string;
    defaultLanguage?: string;
    localized?: {
      title: string;
      description: string;
    };
    defaultAudioLanguage?: string;
  };
}

interface YouTubeVideoResponse {
  kind: string;
  etag: string;
  items: YouTubeVideoItem[];
}

interface YouTubeVideoItem {
  kind: string;
  etag: string;
  id: string;
  snippet: {
    publishedAt: string;
    channelId: string;
    title: string;
    description: string;
    thumbnails: {
      default: { url: string; width: number; height: number };
      medium: { url: string; width: number; height: number };
      high: { url: string; width: number; height: number };
      standard?: { url: string; width: number; height: number };
      maxres?: { url: string; width: number; height: number };
    };
    channelTitle: string;
    tags?: string[];
    categoryId: string;
    liveBroadcastContent: string;
    defaultLanguage?: string;
    localized?: {
      title: string;
      description: string;
    };
    defaultAudioLanguage?: string;
  };
  contentDetails: {
    duration: string;
    dimension: {
      width: string;
      height: string;
    };
    definition: string;
    caption: string;
    licensedContent: boolean;
    contentRating: any;
    projection: string;
  };
  statistics: {
    viewCount: string;
    likeCount: string;
    favoriteCount: string;
    commentCount: string;
  };
}

export class YouTubeApiService {
  private static readonly MIN_LIKE_COUNT = Number(process.env.YOUTUBE_MIN_LIKE_COUNT || 10);
  static async scrapeYouTubeVideos(maxPages?: number, searchTermLimit?: number): Promise<number> {
    try {
      // Check if YouTube API is configured
      if (!isYouTubeApiConfigured()) {
        logger.error('YouTube API key is not configured. Please set YOUTUBE_API_KEY environment variable.');
        return 0;
      }

      const searchTerms = searchTermLimit ? getEnabledSearchTerms().slice(0, searchTermLimit) : getEnabledSearchTerms();
      logger.info(`Starting YouTube video scraping for ${searchTerms.length} search terms${searchTermLimit ? ` (limited to ${searchTermLimit})` : ''}...`);
      
      let totalProcessedCount = 0;
      
      // Scrape for each search term
      for (const searchConfig of searchTerms) {
        try {
          // Check quota before processing
          if (!hasEnoughQuota(200)) { // Estimate 200 quota units per search term
            logger.warn(`YouTube API quota limit reached. Processed ${totalProcessedCount} videos so far.`);
            break;
          }

          const searchTermProcessedCount = await this.scrapeYouTubeForSearchTerm(searchConfig, maxPages);
          totalProcessedCount += searchTermProcessedCount;
          
          logger.info(`Search term "${searchConfig.searchTerm}": Processed ${searchTermProcessedCount} videos`);
          
          // Add delay between search terms to be respectful to the API
          if (searchTerms.indexOf(searchConfig) < searchTerms.length - 1) {
            await this.delay(2000); // 2 second delay between search terms
          }
          
        } catch (error) {
          logger.error(`Error scraping YouTube for search term "${searchConfig.searchTerm}":`, error);
          // Continue with next search term
        }
      }
      
      logger.info(`Successfully processed ${totalProcessedCount} YouTube videos from ${searchTerms.length} search terms`);
      return totalProcessedCount;
      
    } catch (error) {
      logger.error('Error in YouTube video scraping:', error);
      return 0;
    }
  }

  private static async scrapeYouTubeForSearchTerm(searchConfig: YouTubeSearchConfig, globalMaxPages?: number): Promise<number> {
    try {
      const maxPages = globalMaxPages || searchConfig.maxPages || 1;
      logger.info(`Scraping YouTube for search term "${searchConfig.searchTerm}" (${searchConfig.description}) - up to ${maxPages} pages`);
      
      let totalProcessedCount = 0;
      let nextPageToken: string | undefined;
      
      // Scrape multiple pages for this search term
      for (let page = 0; page < maxPages; page++) {
        try {
          // Check quota before each page
          if (!hasEnoughQuota(100)) {
            logger.warn(`YouTube API quota limit reached for search term "${searchConfig.searchTerm}".`);
            break;
          }

          const pageResult = await this.searchYouTubeVideos(searchConfig.searchTerm, nextPageToken);
          if (!pageResult) break;

          const { videos, nextToken } = pageResult;
          nextPageToken = nextToken;
          
          let pageProcessedCount = 0;
          for (const video of videos) {
            try {
              const processed = await this.processYouTubeVideo(video, searchConfig.searchTerm);
              if (processed) {
                pageProcessedCount++;
              }
            } catch (error) {
              logger.error(`Error processing YouTube video ${video.id.videoId}:`, error);
              // Continue with next video
            }
          }
          
          totalProcessedCount += pageProcessedCount;
          logger.info(`Search "${searchConfig.searchTerm}" - Page ${page + 1}: Processed ${pageProcessedCount} videos`);
          
          // If no next page token, we've reached the end
          if (!nextPageToken) {
            logger.info(`No more pages available for search term "${searchConfig.searchTerm}"`);
            break;
          }
          
          // Add delay between pages to be respectful to the API
          if (page < maxPages - 1 && nextPageToken) {
            await this.delay(1000); // 1 second delay between pages
          }
          
        } catch (error) {
          logger.error(`Error scraping YouTube page ${page + 1} for search term "${searchConfig.searchTerm}":`, error);
          // Continue with next page
        }
      }
      
      return totalProcessedCount;
      
    } catch (error) {
      logger.error(`Error scraping YouTube for search term "${searchConfig.searchTerm}":`, error);
      return 0;
    }
  }

  private static async searchYouTubeVideos(searchTerm: string, pageToken?: string): Promise<{ videos: YouTubeSearchItem[]; nextToken?: string } | null> {
    try {
      const params = {
        part: 'snippet',
        q: searchTerm,
        type: 'video',
        videoDuration: 'short', // Focus on short videos
        order: 'date', // Sort by date (newest first)
        maxResults: youtubeConfig.maxResults,
        key: youtubeConfig.apiKey,
        ...(pageToken && { pageToken })
      };

      incrementQuotaUsage(100); // Search costs 100 quota units

      const response = await axios.get<YouTubeSearchResponse>(youtubeEndpoints.search, { params });
      
      return {
        videos: response.data.items,
        nextToken: response.data.nextPageToken
      };
      
    } catch (error: any) {
      if (error.response?.status === 403) {
        logger.error('YouTube API quota exceeded or API key invalid');
      } else {
        logger.error(`Error searching YouTube videos for "${searchTerm}":`, error);
      }
      return null;
    }
  }

  private static async getVideoDetails(videoId: string): Promise<YouTubeVideoItem | null> {
    try {
      const params = {
        part: 'snippet,contentDetails,statistics',
        id: videoId,
        key: youtubeConfig.apiKey
      };

      incrementQuotaUsage(1); // Video details cost 1 quota unit

      const response = await axios.get<YouTubeVideoResponse>(youtubeEndpoints.videos, { params });
      
      return response.data.items[0] || null;
      
    } catch (error) {
      logger.error(`Error getting video details for ${videoId}:`, error);
      return null;
    }
  }

  private static async processYouTubeVideo(video: YouTubeSearchItem, searchTerm: string): Promise<boolean> {
    try {
      const videoId = video.id.videoId;
      
      // Check if video already exists
      const existingVideo = await Video.findOne({
        where: { 
          redditId: videoId,
          subreddit: 'youtube'
        }
      });

      if (existingVideo) {
        logger.debug(`YouTube video already exists: ${video.snippet.title}`);
        return false;
      }

      // Get detailed video information
      const videoDetails = await this.getVideoDetails(videoId);
      if (!videoDetails) {
        logger.warn(`Could not get details for video: ${videoId}`);
        return false;
      }

      // Check if content is AI-related
      if (!this.isAIContent(video.snippet.title, video.snippet.description)) {
        logger.debug(`Skipping non-AI YouTube video: ${video.snippet.title}`);
        return false;
      }

      // Extract thumbnail URL (prefer maxres, fallback to high)
      const thumbnailUrl = video.snippet.thumbnails.maxres?.url || 
                          video.snippet.thumbnails.high?.url || 
                          video.snippet.thumbnails.medium?.url ||
                          video.snippet.thumbnails.default?.url;

      // Extract tags from title, description, and search term
      const tags = this.extractTags(video.snippet.title, video.snippet.description, searchTerm, video.snippet.tags);

      // Parse duration
      const duration = this.parseDuration(videoDetails.contentDetails.duration);
      const likeCount = parseInt(videoDetails.statistics.likeCount) || 0;
      if (likeCount < this.MIN_LIKE_COUNT) {
        logger.info(`Skipping video with likes below ${this.MIN_LIKE_COUNT}: ${video.snippet.title} (${likeCount})`);
        return false;
      }

      // Create video data
      const videoData = {
        title: video.snippet.title,
        description: video.snippet.description,
        videoUrl: `https://www.youtube.com/watch?v=${videoId}`,
        thumbnailUrl,
        redditId: videoId,
        subreddit: 'youtube',
        tags,
        nsfw: false,
        likes: likeCount,
        platform: 'youtube',
        metadata: {
          platform: 'youtube',
          youtubeId: videoId,
          youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
          publishedAt: video.snippet.publishedAt,
          duration: duration,
          width: parseInt(videoDetails.contentDetails.dimension.width) || 1920,
          height: parseInt(videoDetails.contentDetails.dimension.height) || 1080,
          format: 'mp4',
          searchTerm: searchTerm,
          channelTitle: video.snippet.channelTitle,
          viewCount: parseInt(videoDetails.statistics.viewCount) || 0,
          commentCount: parseInt(videoDetails.statistics.commentCount) || 0
        }
      };

      // Save to database
      await Video.create({
        ...videoData,
        createdAt: new Date(video.snippet.publishedAt),
        views: parseInt(videoDetails.statistics.viewCount) || 0,
        blacklisted: false
      });

      logger.info(`Successfully saved YouTube video from search "${searchTerm}": ${video.snippet.title}`);
      return true;

    } catch (error) {
      logger.error(`Error processing YouTube video ${video.id.videoId}:`, error);
      return false;
    }
  }

  private static extractTags(title: string, description: string, searchTerm: string, videoTags?: string[]): string[] {
    const tagSet = new Set<string>();
    
    // Add platform tag
    tagSet.add('youtube');
    tagSet.add('youtube-shorts');
    
    // Add search term as tags
    const searchWords = searchTerm.toLowerCase().split(/\s+/);
    searchWords.forEach(word => {
      if (word.length > 2) {
        tagSet.add(word);
      }
    });
    
    // Add video tags from YouTube
    if (videoTags) {
      videoTags.forEach(tag => tagSet.add(tag.toLowerCase()));
    }
    
    // Add AI-related tags
    const aiTags = ['ai', 'artificial intelligence', 'generated', 'ai-generated', 'aivideo', 'aishorts'];
    aiTags.forEach(tag => tagSet.add(tag));
    
    // Add simple word-based tags from title and description
    const text = `${title} ${description}`.toLowerCase();
    const words = text
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !['with', 'this', 'that', 'from', 'what', 'when', 'where'].includes(word));
    
    words.forEach(word => tagSet.add(word));
    
    return Array.from(tagSet).slice(0, 15); // Limit to 15 tags
  }

  private static isAIContent(title: string, description: string): boolean {
    const text = `${title} ${description}`.toLowerCase();
    
    const aiTerms = [
      'ai', 'artificial intelligence', 'generated', 'ai-generated', 'aivideo', 
      'aishorts', 'ai art', 'stable diffusion', 'midjourney', 'dall-e', 
      'machine learning', 'neural network', 'deep learning', 'algorithm',
      'sora', 'gpt', 'chatgpt', 'automated', 'synthetic'
    ];
    
    return aiTerms.some(term => text.includes(term));
  }

  private static parseDuration(duration: string): string {
    // Parse ISO 8601 duration format (PT1M30S -> 1:30)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return '0:00';
    
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
  }

  // Helper function to delay execution for rate limiting
  private static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Method to process a single YouTube video (for manual submissions)
  static async processSingleYouTubeVideo(youtubeUrl: string): Promise<{ success: boolean; video?: any; error?: string }> {
    try {
      const videoId = this.extractVideoId(youtubeUrl);
      if (!videoId) {
        return { success: false, error: 'Invalid YouTube URL format' };
      }

      // Check if video already exists
      const existingVideo = await Video.findOne({
        where: { 
          redditId: videoId,
          subreddit: 'youtube'
        }
      });

      if (existingVideo) {
        return { success: false, error: 'Video already exists in our collection' };
      }

      // Get video details from YouTube API
      const videoDetails = await this.getVideoDetails(videoId);
      if (!videoDetails) {
        return { success: false, error: 'Could not fetch video details from YouTube' };
      }

      // Check if content is AI-related
      if (!this.isAIContent(videoDetails.snippet.title, videoDetails.snippet.description)) {
        return { success: false, error: 'Video does not appear to be AI-related content' };
      }

      // Extract thumbnail URL
      const thumbnailUrl = videoDetails.snippet.thumbnails.maxres?.url || 
                          videoDetails.snippet.thumbnails.high?.url || 
                          videoDetails.snippet.thumbnails.medium?.url ||
                          videoDetails.snippet.thumbnails.default?.url;

      // Extract tags
      const tags = this.extractTags(videoDetails.snippet.title, videoDetails.snippet.description, 'user-submitted', videoDetails.snippet.tags);

      // Parse duration
      const duration = this.parseDuration(videoDetails.contentDetails.duration);
      const likeCount = parseInt(videoDetails.statistics.likeCount) || 0;
      if (likeCount < this.MIN_LIKE_COUNT) {
        return {
          success: false,
          error: `Video has only ${likeCount} likes (minimum required: ${this.MIN_LIKE_COUNT})`
        };
      }

      const videoData = {
        title: videoDetails.snippet.title,
        description: videoDetails.snippet.description,
        videoUrl: youtubeUrl,
        thumbnailUrl,
        redditId: videoId,
        subreddit: 'youtube',
        tags,
        nsfw: false,
        likes: likeCount,
        platform: 'youtube',
        metadata: {
          platform: 'youtube',
          youtubeId: videoId,
          youtubeUrl: youtubeUrl,
          publishedAt: videoDetails.snippet.publishedAt,
          duration: duration,
          width: parseInt(videoDetails.contentDetails.dimension.width) || 1920,
          height: parseInt(videoDetails.contentDetails.dimension.height) || 1080,
          format: 'mp4',
          searchTerm: 'user-submitted',
          channelTitle: videoDetails.snippet.channelTitle,
          viewCount: parseInt(videoDetails.statistics.viewCount) || 0,
          commentCount: parseInt(videoDetails.statistics.commentCount) || 0
        }
      };

      const newVideo = await Video.create({
        ...videoData,
        createdAt: new Date(videoDetails.snippet.publishedAt),
        views: parseInt(videoDetails.statistics.viewCount) || 0,
        blacklisted: false
      });

      return { success: true, video: newVideo.toJSON() };

    } catch (error) {
      logger.error('Error processing single YouTube video:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error occurred' 
      };
    }
  }

  private static extractVideoId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }
}
