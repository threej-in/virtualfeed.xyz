import axios from 'axios';
import { logger } from './logger';
import Video from '../models/Video';
import { VideoProcessor } from './videoProcessor';
import { getEnabledSearchTerms, getEnabledSearchTermsWithLimit, YouTubeSearchConfig } from '../config/youtubeSearchTerms';
import { LanguageDetector } from '../utils/languageDetection';
import dotenv from 'dotenv';

dotenv.config();

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

export class YouTubeScraper {
  private static readonly YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
  private static readonly YOUTUBE_API_BASE_URL = 'https://www.googleapis.com/youtube/v3';
  private static readonly MAX_RESULTS = 50; // YouTube API limit
  private static readonly MIN_VIEW_COUNT = Number(process.env.YOUTUBE_MIN_VIEW_COUNT || 200);
  private static readonly MIN_LIKE_COUNT = Number(process.env.YOUTUBE_MIN_LIKE_COUNT || 10);
  private static readonly MIN_DESCRIPTION_LENGTH = Number(process.env.YOUTUBE_MIN_DESCRIPTION_LENGTH || 40);
  private static readonly LOW_QUALITY_KEYWORDS = [
    'free fire',
    'pubg',
    'bgmi',
    'status video',
    'whatsapp status',
    'lyrics',
    'shayari',
    'fan edit',
    'template',
    'vs edit'
  ];

  static async scrapeYouTubeVideos(maxPages?: number, searchTermLimit?: number): Promise<number> {
    try {
      const searchTerms = searchTermLimit ? getEnabledSearchTermsWithLimit(searchTermLimit) : getEnabledSearchTerms();
      logger.info(`Starting YouTube video scraping for ${searchTerms.length} search terms${searchTermLimit ? ` (limited to ${searchTermLimit})` : ''}...`);
      
      let totalProcessedCount = 0;
      
      // Scrape for each search term
      for (const searchConfig of searchTerms) {
        try {
          const searchTermProcessedCount = await this.scrapeYouTubeForSearchTerm(searchConfig, maxPages);
          totalProcessedCount += searchTermProcessedCount;
          
          logger.info(`Search term "${searchConfig.searchTerm}": Processed ${searchTermProcessedCount} videos`);
          
          // Add delay between search terms to be respectful to the RSS bridge service
          if (searchTerms.indexOf(searchConfig) < searchTerms.length - 1) {
            await this.delay(5000); // 5 second delay between search terms to avoid rate limiting
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
      
      // Scrape multiple pages for this search term
      for (let page = 0; page < maxPages; page++) {
        try {
          const pageProcessedCount = await this.scrapeYouTubePage(searchConfig.searchTerm, page);
          totalProcessedCount += pageProcessedCount;
          
          logger.info(`Search "${searchConfig.searchTerm}" - Page ${page + 1}: Processed ${pageProcessedCount} videos`);
          
          // Add delay between pages to be respectful to the RSS bridge service
          if (page < maxPages - 1) {
            await this.delay(3000); // 3 second delay between pages to avoid rate limiting
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

  private static async scrapeYouTubePage(searchTerm: string, page: number): Promise<number> {
    try {
      // Check if API key is configured
      if (!this.YOUTUBE_API_KEY) {
        logger.error('YouTube API key is not configured. Please set YOUTUBE_API_KEY environment variable.');
        return 0;
      }

      // Search YouTube videos using API
      const searchParams = {
        part: 'snippet',
        q: searchTerm,
        type: 'video',
        videoDuration: 'short', // Focus on short videos (under 4 minutes)
        order: 'date', // Sort by date (newest first)
        maxResults: this.MAX_RESULTS,
        key: this.YOUTUBE_API_KEY
      };

      logger.info(`Searching YouTube API for "${searchTerm}" - page ${page + 1}`);
      
      const response = await axios.get<YouTubeSearchResponse>(`${this.YOUTUBE_API_BASE_URL}/search`, { params: searchParams });
      const videos = response.data.items;
      
      logger.info(`Found ${videos.length} YouTube videos for "${searchTerm}" on page ${page + 1}`);
      
      let processedCount = 0;
      
      for (const video of videos) {
        try {
          const processed = await this.processYouTubeVideo(video, searchTerm);
          if (processed) {
            processedCount++;
          }
        } catch (error) {
          logger.error(`Error processing YouTube video ${video.id.videoId}:`, error);
          // Continue with next video
        }
      }
      
      return processedCount;
      
    } catch (error: any) {
      // Handle API quota exceeded
      if (error.response?.status === 403) {
        logger.error('YouTube API quota exceeded or API key invalid');
        return 0;
      }
      
      logger.error(`Error searching YouTube for "${searchTerm}" - page ${page + 1}:`, error);
      return 0;
    }
  }

  // Helper function to delay execution for rate limiting
  private static async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private static async processYouTubeVideo(video: YouTubeSearchItem, searchTerm: string): Promise<boolean> {
    try {
      // Validate video data structure
      if (!video || !video.id || !video.id.videoId || !video.snippet) {
        logger.warn('Invalid video data structure received from YouTube API');
        return false;
      }

      const videoId = video.id.videoId;
      
      // Validate required fields
      if (!video.snippet.title || !video.snippet.description) {
        logger.warn(`Missing required fields for video ${videoId}`);
        return false;
      }
      
      // Check if video already exists
      const existingVideo = await Video.findOne({
        where: { 
          redditId: videoId,
          subreddit: 'youtube'
        }
      });

      if (existingVideo) {
        logger.info(`YouTube video already exists: ${video.snippet.title}`);
        return false;
      }

      // Check if content is AI-related
      if (!this.isAIContent(video.snippet.title, video.snippet.description)) {
        logger.info(`Skipping non-AI YouTube video: ${video.snippet.title}`);
        return false;
      }

      // Get video details to check duration
      const videoDetails = await this.getVideoDetails(videoId);
      if (!videoDetails) {
        logger.warn(`Could not get details for video: ${videoId}`);
        return false;
      }

      // Check video duration (must be less than 5 minutes)
      const durationInSeconds = this.parseDurationToSeconds(videoDetails.contentDetails.duration);
      if (durationInSeconds >= 300) { // 5 minutes = 300 seconds
        logger.info(`Skipping video longer than 5 minutes: ${video.snippet.title} (${durationInSeconds}s)`);
        return false;
      }

      const viewCount = parseInt(videoDetails.statistics.viewCount) || 0;
      const likeCount = parseInt(videoDetails.statistics.likeCount) || 0;
      if (this.isLowQualityVideo(video, viewCount, likeCount)) {
        logger.info(`Skipping low-quality YouTube video: ${video.snippet.title}`);
        return false;
      }

      logger.info(`Processing AI-related video under 5 minutes: ${video.snippet.title} (${durationInSeconds}s)`);

      // Extract thumbnail URL (prefer maxres, fallback to high)
      const thumbnailUrl = video.snippet.thumbnails.maxres?.url || 
                          video.snippet.thumbnails.high?.url || 
                          video.snippet.thumbnails.medium?.url ||
                          video.snippet.thumbnails.default?.url ||
                          `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`; // Fallback to standard YouTube thumbnail

      // Extract tags from title, description, and search term
      const tags = this.extractTags(video.snippet.title, video.snippet.description, searchTerm, video.snippet.tags);

      // Detect language from video content
      const languageDetection = await LanguageDetector.detectVideoLanguage({
        title: video.snippet.title,
        description: video.snippet.description,
        tags: video.snippet.tags || []
      });

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
        language: languageDetection.language,
        metadata: {
          platform: 'youtube',
          youtubeId: videoId,
          youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
          publishedAt: video.snippet.publishedAt,
          duration: this.formatDuration(durationInSeconds),
          durationSeconds: durationInSeconds,
          width: parseInt(videoDetails.contentDetails.dimension.width) || 1080,
          height: parseInt(videoDetails.contentDetails.dimension.height) || 1920,
          format: 'mp4',
          searchTerm: searchTerm,
          channelTitle: video.snippet.channelTitle || 'Unknown Channel',
          viewCount,
          commentCount: parseInt(videoDetails.statistics.commentCount) || 0,
          languageDetection: {
            language: languageDetection.language,
            confidence: languageDetection.confidence,
            detectedBy: languageDetection.detectedBy
          }
        }
      };

      // Validate metadata is serializable
      try {
        JSON.stringify(videoData.metadata);
      } catch (metadataError) {
        logger.error(`Metadata serialization error for video ${videoId}:`, metadataError);
        return false;
      }

      // Save to database
      logger.info(`Attempting to save video to database: ${video.snippet.title}`);
      
      try {
        await Video.create({
          ...videoData,
          createdAt: new Date(video.snippet.publishedAt),
          views: viewCount,
          blacklisted: false
        });

        logger.info(`Successfully saved YouTube video from search "${searchTerm}": ${video.snippet.title}`);
        return true;
      } catch (dbError: any) {
        // Handle specific database errors
        if (dbError.name === 'SequelizeUniqueConstraintError') {
          logger.warn(`Video ${videoId} already exists in database (unique constraint violation)`);
          return false;
        }
        
        logger.error(`Database error saving video ${videoId}:`, {
          error: dbError.message,
          code: dbError.code,
          name: dbError.name
        });
        return false;
      }

    } catch (error) {
      logger.error(`Error processing YouTube video ${video.id.videoId}:`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        videoId: video.id.videoId,
        title: video.snippet.title,
        searchTerm: searchTerm
      });
      return false;
    }
  }

  private static isLowQualityVideo(
    video: YouTubeSearchItem,
    viewCount: number,
    likeCount: number
  ): boolean {
    const title = (video.snippet.title || '').toLowerCase();
    const description = (video.snippet.description || '').trim();
    const tags = video.snippet.tags || [];

    const hasLowQualityKeyword = this.LOW_QUALITY_KEYWORDS.some((keyword) => title.includes(keyword));
    if (hasLowQualityKeyword) {
      return true;
    }

    const hasWeakEngagement =
      viewCount < this.MIN_VIEW_COUNT &&
      likeCount < this.MIN_LIKE_COUNT;

    const hasWeakContentSignals =
      description.length < this.MIN_DESCRIPTION_LENGTH &&
      tags.length < 3;

    return hasWeakEngagement && hasWeakContentSignals;
  }

  private static async getVideoDetails(videoId: string): Promise<YouTubeVideoItem | null> {
    try {
      // Check if API key is configured
      if (!this.YOUTUBE_API_KEY) {
        logger.error('YouTube API key is not configured');
        return null;
      }

      const params = {
        part: 'snippet,contentDetails,statistics',
        id: videoId,
        key: this.YOUTUBE_API_KEY
      };

      const response = await axios.get<YouTubeVideoResponse>(`${this.YOUTUBE_API_BASE_URL}/videos`, { params });
      
      return response.data.items[0] || null;
      
    } catch (error: any) {
      if (error.response?.status === 403) {
        logger.error('YouTube API quota exceeded or API key invalid');
      } else {
        logger.error(`Error getting video details for ${videoId}:`, error);
      }
      return null;
    }
  }

  private static parseDurationToSeconds(duration: string): number {
    // Parse ISO 8601 duration format (PT1M30S -> 90 seconds)
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1]) || 0;
    const minutes = parseInt(match[2]) || 0;
    const seconds = parseInt(match[3]) || 0;
    
    return hours * 3600 + minutes * 60 + seconds;
  }

  private static formatDuration(seconds: number): string {
    // Format seconds to MM:SS or HH:MM:SS format
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
  }

  private static extractVideoId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }

  private static extractTags(title: string, content: string, searchTerm: string, videoTags?: string[]): string[] {
    const tagSet = new Set<string>();
    
    // Add platform tag
    tagSet.add('youtube');
    tagSet.add('youtube-shorts');
    
    // Add search term as a tag
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
    
    // Extract hashtags from content
    const hashtagRegex = /#(\w+)/g;
    const hashtags = content.match(hashtagRegex) || [];
    hashtags.forEach(tag => tagSet.add(tag.slice(1).toLowerCase()));
    
    // Add AI-related tags
    const aiTags = ['ai', 'artificial intelligence', 'generated', 'ai-generated', 'aivideo', 'aishorts'];
    aiTags.forEach(tag => tagSet.add(tag));
    
    // Add simple word-based tags from title
    const words = title.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3 && !['with', 'this', 'that', 'from', 'what', 'when', 'where'].includes(word));
    
    words.forEach(word => tagSet.add(word));
    
    return Array.from(tagSet).slice(0, 15); // Limit to 15 tags
  }



  private static isAIContent(title: string, content: string): boolean {
    const text = `${title} ${content}`.toLowerCase();
    
    const aiTerms = [
      'ai', 'artificial intelligence', 'generated', 'ai-generated', 'aivideo', 
      'aishorts', 'ai art', 'stable diffusion', 'midjourney', 'dall-e', 
      'machine learning', 'neural network', 'deep learning', 'algorithm'
    ];
    
    return aiTerms.some(term => text.includes(term));
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

      // For manual submissions, we'll need to fetch video details
      // This is a simplified version - you might want to use YouTube Data API for more details
      const videoData = {
        title: `YouTube Video ${videoId}`, // Placeholder title
        description: 'YouTube video submitted by user',
        videoUrl: youtubeUrl,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
        redditId: videoId,
        subreddit: 'youtube',
        tags: ['youtube', 'youtube-shorts', 'ai', 'user-submitted'],
        nsfw: false,
        likes: 0,
        platform: 'youtube',
        metadata: {
          platform: 'youtube',
          youtubeId: videoId,
          youtubeUrl: youtubeUrl,
          publishedAt: new Date().toISOString(),
          duration: 'short',
          width: 1080,
          height: 1920,
          format: 'mp4'
        }
      };

      const newVideo = await Video.create({
        ...videoData,
        createdAt: new Date(),
        views: 0,
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
} 
