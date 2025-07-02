export interface SubredditConfig {
    name: string;
    minScore: number;
    excludeTerms: string[];
    searchTerms: string[];
}

export const subreddits: SubredditConfig[] = [
    {
        name: 'StableDiffusion',
        minScore: 10,
        excludeTerms: [],
        searchTerms: []  // No search terms required for AI-focused subreddits
    },
    {
        name: 'midjourney',
        minScore: 10,
        excludeTerms: [],
        searchTerms: []  // No search terms required for AI-focused subreddits
    },
    {
        name: 'sdforall',
        minScore: 10,
        excludeTerms: [],
        searchTerms: []  // No search terms required for AI-focused subreddits
    },
    {
        name: 'aivideo',
        minScore: 10,
        excludeTerms: [],
        searchTerms: []  // No search terms required for AI-focused subreddits
    },
    {
        name: 'AIGeneratedContent',  // Added new AI-focused subreddit
        minScore: 5,
        excludeTerms: [],
        searchTerms: []
    },
    {
        name: 'aiArt',  // Added new AI-focused subreddit
        minScore: 5,
        excludeTerms: [],
        searchTerms: []
    },
    {
        name: 'chatGPT',
        minScore: 10,  // Reduced minimum score
        excludeTerms: [],
        searchTerms: []
    },
    {
        name: 'nextfuckinglevel',
        minScore: 10,  // Reduced minimum score
        excludeTerms: [],
        searchTerms: []
    },
    {
        name: 'damnthatsinteresting',
        minScore: 10,  // Reduced minimum score
        excludeTerms: [],
        searchTerms: []
    },
    {
        name: 'interestingasfuck',
        minScore: 10,  // Reduced minimum score
        excludeTerms: [],
        searchTerms: []
    },
    {
        name: 'singularity',
        minScore: 10,  // Reduced minimum score
        excludeTerms: [],
        searchTerms: []
    },
    {
        name: 'crazyfuckingvideos',
        minScore: 10,  // Reduced minimum score
        excludeTerms: [],
        searchTerms: []
    }
];
