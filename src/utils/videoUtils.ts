import { Video } from '../types/Video';

/**
 * Safely get video tags as an array
 * Handles cases where tags might be stored as JSON string in database
 */
export const getVideoTags = (video: Video): string[] => {
  if (!video.tags) {
    return [];
  }
  
  // If tags is already an array, return it
  if (Array.isArray(video.tags)) {
    return video.tags;
  }
  
  // If tags is a string, try to parse it as JSON
  if (typeof video.tags === 'string') {
    try {
      const parsed = JSON.parse(video.tags);
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('Failed to parse video tags as JSON:', error);
      return [];
    }
  }
  
  // If tags is an object or other type, return empty array
  return [];
};

/**
 * Safely get a slice of video tags
 */
export const getVideoTagsSlice = (video: Video, start: number, end?: number): string[] => {
  const tags = getVideoTags(video);
  return end ? tags.slice(start, end) : tags.slice(start);
};

/**
 * Get the number of video tags
 */
export const getVideoTagsCount = (video: Video): number => {
  return getVideoTags(video).length;
}; 