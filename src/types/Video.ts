export interface Video {
    id: number;
    title: string;
    description: string;
    videoUrl: string;
    thumbnailUrl: string;
    redditId: string;
    subreddit: string;
    createdAt: string;
    tags: string[];
    views: number;
    likes: number;
    nsfw: boolean;
    metadata: {
        width: number;
        height: number;
        format: string;
        duration: number;
        redditScore: number;
        redditUrl: string;
        upvotes?: number;
        audioUrl?: string; // Added for Reddit videos with separate audio tracks
    };
    // Trending information (optional)
    trending?: {
        period: string;
        hours: number;
        score: number;
        viewsPerHour: number;
        hoursSincePosted: number;
        isFallback?: boolean;
    };
    // Reddit-specific media fields
    secure_media?: {
        reddit_video?: {
            fallback_url: string;
            dash_url?: string;
            hls_url?: string;
            height?: number;
            width?: number;
            duration?: number;
        }
    };
}
