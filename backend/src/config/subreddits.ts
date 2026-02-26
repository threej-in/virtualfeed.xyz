export interface SubredditConfig {
    name: string;
    minScore: number;
    excludeTerms: string[];
    searchTerms: string[];
}

export const subreddits: SubredditConfig[] = [
    {
        name: 'StableDiffusion',
        minScore: 1,
        excludeTerms: [],
        searchTerms: []  // No search terms required for AI-focused subreddits
    },
    {
        name: 'midjourney',
        minScore: 1,
        excludeTerms: [],
        searchTerms: []  // No search terms required for AI-focused subreddits
    },
    {
        name: 'sdforall',
        minScore: 1,
        excludeTerms: [],
        searchTerms: []  // No search terms required for AI-focused subreddits
    },
    {
        name: 'aivideo',
        minScore: 1,
        excludeTerms: [],
        searchTerms: []  // No search terms required for AI-focused subreddits
    },
    {
        name: 'AIGeneratedContent',  // Added new AI-focused subreddit
        minScore: 1,
        excludeTerms: [],
        searchTerms: []
    },
    {
        name: 'aiArt',  // Added new AI-focused subreddit
        minScore: 1,
        excludeTerms: [],
        searchTerms: []
    },
    {
        name: 'chatGPT',
        minScore: 3,  // Keep some quality gate for broad/non-video subs
        excludeTerms: [],
        searchTerms: []
    },
    {
        name: 'nextfuckinglevel',
        minScore: 5,  // Keep stronger quality gate for broad/non-AI subs
        excludeTerms: [],
        searchTerms: []
    },
    {
        name: 'damnthatsinteresting',
        minScore: 5,  // Keep stronger quality gate for broad/non-AI subs
        excludeTerms: [],
        searchTerms: []
    },
    {
        name: 'interestingasfuck',
        minScore: 5,  // Keep stronger quality gate for broad/non-AI subs
        excludeTerms: [],
        searchTerms: []
    },
    {
        name: 'singularity',
        minScore: 3,  // Keep some quality gate for broad/non-video subs
        excludeTerms: [],
        searchTerms: []
    },
    {
        name: 'crazyfuckingvideos',
        minScore: 5,  // Keep stronger quality gate for broad/non-AI subs
        excludeTerms: [],
        searchTerms: []
    }
];
