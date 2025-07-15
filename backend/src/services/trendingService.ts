import Video from '../models/Video';
import { logger } from './logger';

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
      search?: string;
      showNsfw?: boolean;
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
      
      // Add NSFW filter
      if (!filters.showNsfw) {
        whereConditions.push('(nsfw = 0 OR nsfw IS NULL)');
      }
      
      // Always exclude blacklisted videos
      whereConditions.push('(blacklisted = 0 OR blacklisted IS NULL)');
      
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
        return { videos: [], total: 0 };
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
            hoursSincePosted: Math.round(hoursSincePosted * 100) / 100
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
} 