import axios from 'axios';
import { Video } from '../types/Video';

const API_URL = 'http://localhost:5000/api';

export interface VideoResponse {
    videos: Video[];
    total: number;
    pages: number;
    currentPage: number;
}

export interface VideoFilters {
    page?: number;
    limit?: number;
    search?: string;
    sortBy?: 'createdAt' | 'views' | 'likes';
    order?: 'asc' | 'desc';
    subreddit?: string;
    showNsfw?: boolean;
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
