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
}
