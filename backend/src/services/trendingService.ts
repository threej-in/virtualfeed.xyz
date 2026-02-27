import Video from '../models/Video';
import { logger } from './logger';
import { LanguageDetector } from '../utils/languageDetection';

export interface TrendingPeriod {
  label: string;
  hours: number;
}

export const TRENDING_PERIODS: TrendingPeriod[] = [
  { label: '24h', hours: 24 },
  { label: '48h', hours: 48 },
  { label: '1w', hours: 168 }, // 7 days
];

export class TrendingService {
  private static getHomepageStage(pageIndex: number): {
    label: string;
    windows: Array<{ days: number | null; weight: number }>;
  } {
    if (pageIndex < 2) {
      // First screens: mostly this week's winners with some month/all-time variety.
      return {
        label: 'weekly_popular',
        windows: [
          { days: 7, weight: 0.7 },
          { days: 30, weight: 0.2 },
          { days: null, weight: 0.1 },
        ],
      };
    }

    if (pageIndex < 6) {
      // Mid scroll: shift towards monthly/popular archive.
      return {
        label: 'monthly_hits',
        windows: [
          { days: 30, weight: 0.5 },
          { days: 90, weight: 0.3 },
          { days: null, weight: 0.2 },
        ],
      };
    }

    // Deep scroll: longer tail and evergreen popular content.
    return {
      label: 'evergreen_mix',
      windows: [
        { days: 90, weight: 0.4 },
        { days: null, weight: 0.6 },
      ],
    };
  }

  private static getDiversifiedOrderClause(finalSortBy: string, finalOrder: 'ASC' | 'DESC'): string {
    // Keep popularity-first ordering but rotate ties day-by-day to reduce "same exact feed" fatigue.
    if (finalSortBy === 'views') {
      return `views ${finalOrder}, likes DESC, MOD(id + DAYOFYEAR(CURDATE()), 17) ASC, createdAt DESC`;
    }

    if (finalSortBy === 'likes') {
      return `likes ${finalOrder}, views DESC, MOD(id + DAYOFYEAR(CURDATE()), 17) ASC, createdAt DESC`;
    }

    return `${finalSortBy} ${finalOrder}, views DESC, likes DESC`;
  }

  private static splitLimit(limit: number, weights: number[]): number[] {
    if (limit <= 0 || weights.length === 0) return [];

    const raw = weights.map((w) => Math.max(0, Math.floor(limit * w)));
    let assigned = raw.reduce((sum, n) => sum + n, 0);

    // Ensure each bucket can contribute at least one item when possible.
    for (let i = 0; i < raw.length && assigned < limit; i++) {
      if (raw[i] === 0) {
        raw[i] = 1;
        assigned++;
      }
    }

    // Distribute remaining slots by weight order.
    let guard = 0;
    while (assigned < limit && guard < 500) {
      guard++;
      let bestIdx = 0;
      for (let i = 1; i < weights.length; i++) {
        if (weights[i] > weights[bestIdx]) bestIdx = i;
      }
      raw[bestIdx]++;
      assigned++;
    }

    // Trim overflow if any.
    guard = 0;
    while (assigned > limit && guard < 500) {
      guard++;
      let worstIdx = -1;
      for (let i = 0; i < raw.length; i++) {
        if (raw[i] > 1 && (worstIdx === -1 || weights[i] < weights[worstIdx])) {
          worstIdx = i;
        }
      }
      if (worstIdx === -1) break;
      raw[worstIdx]--;
      assigned--;
    }

    return raw;
  }

  /**
   * Calculate trending score based on views and time since posting
   * Higher score = more trending (more views in shorter time)
   */
  private static calculateTrendingScore(views: number, hoursSincePosted: number): number {
    if (hoursSincePosted <= 0) return 0;
    
    // Trending score = views per hour
    // This gives higher scores to videos with more views in less time
    const viewsPerHour = views / hoursSincePosted;
    
    // Apply a logarithmic scale to prevent extremely popular videos from dominating
    return Math.log(viewsPerHour + 1);
  }

  /**
   * Get trending videos based on views and posting time
   * @param period The time period to filter videos (only videos posted within this period)
   * @param limit Number of videos to return
   * @param offset Pagination offset
   * @param filters Additional filters (subreddit, search, etc.)
   * @returns Array of trending videos with trending scores
   */
  public static async getTrendingVideos(
    period: TrendingPeriod,
    limit: number = 12,
    offset: number = 0,
    filters: {
      subreddit?: string;
      platform?: string;
      search?: string;
      showNsfw?: boolean;
      language?: string;
      excludeVideoIds?: number[];
    } = {}
  ): Promise<{ videos: any[]; total: number }> {
    try {
      const cutoffDate = new Date(Date.now() - period.hours * 60 * 60 * 1000);
      
      // Build WHERE conditions
      const whereConditions: any[] = [];
      const queryParams: any[] = [];
      
      // Only include videos posted within the specified period
      whereConditions.push('createdAt >= ?');
      queryParams.push(cutoffDate);
      
      // Add subreddit filter
      if (filters.subreddit) {
        whereConditions.push('subreddit = ?');
        queryParams.push(filters.subreddit);
      }
      
      // Add search filter
      if (filters.search) {
        whereConditions.push('(title LIKE ? OR description LIKE ?)');
        queryParams.push(`%${filters.search}%`, `%${filters.search}%`);
      }
      
      // Add language filter
      const languageQueryValues = LanguageDetector.getLanguageQueryValues(filters.language);
      if (languageQueryValues.length === 1) {
        whereConditions.push('language = ?');
        queryParams.push(languageQueryValues[0]);
      } else if (languageQueryValues.length > 1) {
        whereConditions.push(`language IN (${new Array(languageQueryValues.length).fill('?').join(',')})`);
        queryParams.push(...languageQueryValues);
      }
      
      // Add NSFW filter
      if (!filters.showNsfw) {
        whereConditions.push('(nsfw = 0 OR nsfw IS NULL)');
      }
      
      // Always exclude blacklisted videos
      whereConditions.push('(blacklisted = 0 OR blacklisted IS NULL)');

      if (filters.excludeVideoIds && filters.excludeVideoIds.length > 0) {
        const placeholders = new Array(filters.excludeVideoIds.length).fill('?').join(',');
        whereConditions.push(`id NOT IN (${placeholders})`);
        queryParams.push(...filters.excludeVideoIds);
      }
      
      const whereClause = whereConditions.length > 0 
        ? `WHERE ${whereConditions.join(' AND ')}` 
        : '';
      
      // Get the database instance
      const db = require('../config/database').default;
      
      // Count total matching videos
      const countQuery = `SELECT COUNT(*) as count FROM videos ${whereClause}`;
      const [countResult] = await db.query(countQuery, { replacements: queryParams });
      const total = countResult[0].count;
      
      if (total === 0) {
        // If no videos found in the specified period, try to get recent videos instead
        logger.info(`No videos found for trending period ${period.label}, falling back to recent videos`);
        
        // Remove the time filter and get recent videos
        const fallbackWhereConditions = whereConditions.filter((_, index) => {
          // Remove the createdAt filter (first condition)
          return index !== 0;
        });
        const fallbackQueryParams = queryParams.slice(1); // Remove the cutoff date
        
        const fallbackWhereClause = fallbackWhereConditions.length > 0 
          ? `WHERE ${fallbackWhereConditions.join(' AND ')}` 
          : '';
        
        const fallbackCountQuery = `SELECT COUNT(*) as count FROM videos ${fallbackWhereClause}`;
        const [fallbackCountResult] = await db.query(fallbackCountQuery, { replacements: fallbackQueryParams });
        const fallbackTotal = fallbackCountResult[0].count;
        
        if (fallbackTotal === 0) {
          return { videos: [], total: 0 };
        }
        
        // Get recent videos instead
        const fallbackVideosQuery = `
          SELECT 
            *,
            TIMESTAMPDIFF(HOUR, createdAt, NOW()) as hours_since_posted,
            views as total_views
          FROM videos 
          ${fallbackWhereClause} 
          ORDER BY createdAt DESC
          LIMIT ${limit} OFFSET ${offset}
        `;
        
        const [fallbackVideos] = await db.query(fallbackVideosQuery, { replacements: fallbackQueryParams });
        
        const transformedFallbackVideos = fallbackVideos.map((video: any) => {
          const hoursSincePosted = video.hours_since_posted || 1;
          const trendingScore = this.calculateTrendingScore(video.total_views, hoursSincePosted);
          
          return {
            ...video,
            trending: {
              period: 'recent', // Indicate this is a fallback
              hours: period.hours,
              score: Math.round(trendingScore * 100) / 100,
              viewsPerHour: Math.round((video.total_views / hoursSincePosted) * 100) / 100,
              hoursSincePosted: Math.round(hoursSincePosted * 100) / 100,
              isFallback: true
            }
          };
        });
        
        return {
          videos: transformedFallbackVideos,
          total: fallbackTotal
        };
      }
      
      // Get videos with trending score calculation
      const videosQuery = `
        SELECT 
          *,
          TIMESTAMPDIFF(HOUR, createdAt, NOW()) as hours_since_posted,
          views as total_views
        FROM videos 
        ${whereClause} 
        ORDER BY views DESC, createdAt DESC
        LIMIT ${limit} OFFSET ${offset}
      `;
      
      const [videos] = await db.query(videosQuery, { replacements: queryParams });
      
      // Calculate trending scores and transform results
      const transformedVideos = videos.map((video: any) => {
        const hoursSincePosted = video.hours_since_posted || 1; // Avoid division by zero
        const trendingScore = this.calculateTrendingScore(video.total_views, hoursSincePosted);
        
        return {
          ...video,
          trending: {
            period: period.label,
            hours: period.hours,
            score: Math.round(trendingScore * 100) / 100,
            viewsPerHour: Math.round((video.total_views / hoursSincePosted) * 100) / 100,
            hoursSincePosted: Math.round(hoursSincePosted * 100) / 100,
            isFallback: false
          }
        };
      });
      
      // Sort by trending score (highest first)
      transformedVideos.sort((a: any, b: any) => b.trending.score - a.trending.score);
      
      return {
        videos: transformedVideos,
        total
      };
      
    } catch (error) {
      logger.error(`Error getting trending videos for period ${period.label}:`, error);
      throw error;
    }
  }
  
  /**
   * Get trending statistics for a specific video
   * @param videoId The video ID
   * @returns Trending statistics for different periods
   */
  public static async getVideoTrendingStats(videoId: number): Promise<any> {
    try {
      const video = await Video.findByPk(videoId);
      if (!video) {
        throw new Error('Video not found');
      }
      
      const stats: any = {};
      const now = new Date();
      const videoCreatedAt = new Date(video.createdAt);
      const totalHoursSincePosted = (now.getTime() - videoCreatedAt.getTime()) / (1000 * 60 * 60);
      
      for (const period of TRENDING_PERIODS) {
        const cutoffDate = new Date(now.getTime() - period.hours * 60 * 60 * 1000);
        
        // Check if video was posted within this period
        if (videoCreatedAt >= cutoffDate) {
          const hoursSincePosted = Math.max(totalHoursSincePosted, 1);
          const trendingScore = this.calculateTrendingScore(video.views, hoursSincePosted);
          
          stats[period.label] = {
            views: video.views,
            score: Math.round(trendingScore * 100) / 100,
            viewsPerHour: Math.round((video.views / hoursSincePosted) * 100) / 100,
            hoursSincePosted: Math.round(hoursSincePosted * 100) / 100,
            isTrending: true
          };
        } else {
          stats[period.label] = {
            views: video.views,
            score: 0,
            viewsPerHour: 0,
            hoursSincePosted: Math.round(totalHoursSincePosted * 100) / 100,
            isTrending: false
          };
        }
      }
      
      return stats;
      
    } catch (error) {
      logger.error(`Error getting trending stats for video ${videoId}:`, error);
      throw error;
    }
  }

  /**
   * Get homepage videos - simple recent videos first approach
   * @param limit Total number of videos to return
   * @param offset Pagination offset
   * @param filters Additional filters
   * @param sortBy Sort field (default: 'createdAt')
   * @param order Sort order (default: 'desc')
   * @returns Array of recent videos
   */
  public static async getHomepageVideos(
    limit: number = 12,
    offset: number = 0,
    filters: {
      subreddit?: string;
      platform?: string;
      search?: string;
      showNsfw?: boolean;
      language?: string;
      excludeVideoIds?: number[];
    } = {},
    sortBy: string = 'views',
    order: string = 'desc'
  ): Promise<{ videos: any[]; total: number }> {
    try {
      const db = require('../config/database').default;

      // Build base WHERE conditions
      const baseWhereConditions: any[] = [];
      const baseQueryParams: any[] = [];
      
      // Add subreddit filter
      if (filters.subreddit) {
        baseWhereConditions.push('subreddit = ?');
        baseQueryParams.push(filters.subreddit);
      }
      
      // Add platform filter
      if (filters.platform) {
        baseWhereConditions.push('platform = ?');
        baseQueryParams.push(filters.platform);
      }
      
      // Add search filter
      if (filters.search) {
        baseWhereConditions.push('(title LIKE ? OR description LIKE ?)');
        baseQueryParams.push(`%${filters.search}%`, `%${filters.search}%`);
      }
      
      // Add language filter
      const languageQueryValues = LanguageDetector.getLanguageQueryValues(filters.language);
      if (languageQueryValues.length === 1) {
        baseWhereConditions.push('language = ?');
        baseQueryParams.push(languageQueryValues[0]);
      } else if (languageQueryValues.length > 1) {
        baseWhereConditions.push(`language IN (${new Array(languageQueryValues.length).fill('?').join(',')})`);
        baseQueryParams.push(...languageQueryValues);
      }
      
      // Add NSFW filter
      if (!filters.showNsfw) {
        baseWhereConditions.push('(nsfw = 0 OR nsfw IS NULL)');
      }
      
      // Always exclude blacklisted videos
      baseWhereConditions.push('(blacklisted = 0 OR blacklisted IS NULL)');

      if (filters.excludeVideoIds && filters.excludeVideoIds.length > 0) {
        const placeholders = new Array(filters.excludeVideoIds.length).fill('?').join(',');
        baseWhereConditions.push(`id NOT IN (${placeholders})`);
        baseQueryParams.push(...filters.excludeVideoIds);
      }
      
      const baseWhereClause = baseWhereConditions.length > 0 
        ? `WHERE ${baseWhereConditions.join(' AND ')}` 
        : '';

      // Get total count for pagination
      const countQuery = `SELECT COUNT(*) as count FROM videos ${baseWhereClause}`;
      const [countResult] = await db.query(countQuery, { replacements: baseQueryParams });
      const total = countResult[0].count;

      // Validate sort field
      const validSortFields = ['id', 'title', 'createdAt', 'views', 'likes'];
      const finalSortBy = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
      const finalOrder = order === 'asc' ? 'ASC' : 'DESC';

      const pageIndex = Math.floor(offset / Math.max(limit, 1));
      const stage = this.getHomepageStage(pageIndex);
      const perBucketLimits = this.splitLimit(limit, stage.windows.map(w => w.weight));
      const orderClause = this.getDiversifiedOrderClause(finalSortBy, finalOrder);

      const selectedVideos: any[] = [];
      const selectedIds = new Set<number>();

      for (let i = 0; i < stage.windows.length; i++) {
        const bucket = stage.windows[i];
        const bucketLimit = perBucketLimits[i] || 0;
        if (bucketLimit <= 0) continue;

        const bucketWhereConditions = [...baseWhereConditions];
        const bucketQueryParams = [...baseQueryParams];

        if (bucket.days !== null) {
          bucketWhereConditions.push('createdAt >= ?');
          bucketQueryParams.push(new Date(Date.now() - bucket.days * 24 * 60 * 60 * 1000));
        }

        if (selectedIds.size > 0) {
          const placeholders = new Array(selectedIds.size).fill('?').join(',');
          bucketWhereConditions.push(`id NOT IN (${placeholders})`);
          bucketQueryParams.push(...Array.from(selectedIds));
        }

        const bucketWhereClause = bucketWhereConditions.length > 0
          ? `WHERE ${bucketWhereConditions.join(' AND ')}`
          : '';

        const bucketOffset = pageIndex * bucketLimit;
        const bucketQuery = `
          SELECT
            *,
            TIMESTAMPDIFF(HOUR, createdAt, NOW()) as hours_since_posted,
            views as total_views
          FROM videos
          ${bucketWhereClause}
          ORDER BY ${orderClause}
          LIMIT ${bucketLimit} OFFSET ${bucketOffset}
        `;

        const [bucketVideos] = await db.query(bucketQuery, { replacements: bucketQueryParams });
        for (const video of bucketVideos as any[]) {
          if (selectedIds.has(video.id)) continue;
          selectedIds.add(video.id);
          selectedVideos.push({
            ...video,
            homepageSource: {
              stage: stage.label,
              windowDays: bucket.days,
            },
          });
          if (selectedVideos.length >= limit) break;
        }

        if (selectedVideos.length >= limit) break;
      }

      // Backfill if a stage bucket doesn't have enough rows.
      if (selectedVideos.length < limit) {
        const remaining = limit - selectedVideos.length;
        const backfillWhereConditions = [...baseWhereConditions];
        const backfillQueryParams = [...baseQueryParams];

        if (selectedIds.size > 0) {
          const placeholders = new Array(selectedIds.size).fill('?').join(',');
          backfillWhereConditions.push(`id NOT IN (${placeholders})`);
          backfillQueryParams.push(...Array.from(selectedIds));
        }

        const backfillWhereClause = backfillWhereConditions.length > 0
          ? `WHERE ${backfillWhereConditions.join(' AND ')}`
          : '';

        const backfillQuery = `
          SELECT
            *,
            TIMESTAMPDIFF(HOUR, createdAt, NOW()) as hours_since_posted,
            views as total_views
          FROM videos
          ${backfillWhereClause}
          ORDER BY ${orderClause}
          LIMIT ${remaining} OFFSET ${pageIndex * remaining}
        `;

        const [backfillVideos] = await db.query(backfillQuery, { replacements: backfillQueryParams });
        for (const video of backfillVideos as any[]) {
          if (selectedIds.has(video.id)) continue;
          selectedIds.add(video.id);
          selectedVideos.push({
            ...video,
            homepageSource: {
              stage: stage.label,
              windowDays: null,
            },
          });
          if (selectedVideos.length >= limit) break;
        }
      }
      
      // Transform results with basic trending info
      const transformedVideos = selectedVideos.map((video: any) => {
        const hoursSincePosted = video.hours_since_posted || 1;
        const trendingScore = this.calculateTrendingScore(video.total_views, hoursSincePosted);
        
        return {
          ...video,
          trending: {
            period: 'recent',
            hours: hoursSincePosted,
            score: Math.round(trendingScore * 100) / 100,
            viewsPerHour: Math.round((video.total_views / hoursSincePosted) * 100) / 100,
            hoursSincePosted: Math.round(hoursSincePosted * 100) / 100,
            isFallback: false
          }
        };
      });

      return {
        videos: transformedVideos,
        total
      };

    } catch (error) {
      logger.error('Error getting homepage videos:', error);
      throw error;
    }
  }
} 
