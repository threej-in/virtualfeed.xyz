import axios from 'axios';
import { Video } from '../types/Video';

const API_URL = process.env.REACT_APP_API_URL || '/api';

export const getRedditAudioProxyUrl = (audioUrl: string): string => {
    const params = new URLSearchParams();
    params.append('url', audioUrl);
    return `${API_URL}/videos/reddit-audio?${params.toString()}`;
};

export interface VideoResponse {
    videos: Video[];
    total: number;
    pages: number;
    currentPage: number;
    trending?: {
        period: string;
        hours: number;
    };
}

export interface VideoFilters {
    page?: number;
    limit?: number;
    search?: string;
    subreddit?: string;
    platform?: string;
    sortBy?: 'createdAt' | 'views' | 'likes';
    order?: 'asc' | 'desc';
    showNsfw?: boolean;
    trending?: '24h' | '48h' | '1w';
    language?: string;
}

export const getVideos = async (filters: VideoFilters): Promise<VideoResponse> => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            params.append(key, value.toString());
        }
    });
    
    try {
        const response = await axios.get(`${API_URL}/videos?${params.toString()}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching videos:', error);
        throw error;
    }
};

export const updateVideoStats = async (videoId: string, type: 'view' | 'like'): Promise<Video> => {
    try {
        const response = await axios.post(`${API_URL}/videos/${videoId}/stats`, { type });
        return response.data;
    } catch (error) {
        console.error(`Error updating video stats (${type}) for video ${videoId}:`, error);
        throw error;
    }
};

export const likeVideoInternal = async (videoId: string): Promise<{ success: boolean; engagement: { likes: number } }> => {
    try {
        const response = await axios.post(`${API_URL}/videos/${videoId}/engagement`, { action: 'like' });
        return response.data;
    } catch (error) {
        console.error(`Error recording internal like for video ${videoId}:`, error);
        throw error;
    }
};

export const updateUpvotes = async (videoId: string, upvotes: number): Promise<Video> => {
    try {
        const response = await axios.post(`${API_URL}/videos/${videoId}/upvotes`, { upvotes });
        return response.data;
    } catch (error) {
        console.error(`Error updating upvotes for video ${videoId}:`, error);
        throw error;
    }
};

export const fetchRedditUpvotes = async (videoId: string): Promise<number> => {
    try {
        const response = await axios.get(`${API_URL}/videos/${videoId}/reddit-upvotes`);
        return response.data.upvotes;
    } catch (error) {
        console.error(`Error fetching Reddit upvotes for video ${videoId}:`, error);
        throw error;
    }
};

export const submitVideo = async (redditUrl: string, isNsfw: boolean = false): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/videos/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ redditUrl, isNsfw }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.message || 'Failed to submit video');
    }

    return await response.json();
  } catch (error) {
    console.error('Error submitting video:', error);
    throw error;
  }
};
