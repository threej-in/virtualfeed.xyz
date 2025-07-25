export interface YouTubeSearchConfig {
  searchTerm: string;
  description: string;
  maxPages?: number;
  enabled?: boolean;
}

export const youtubeSearchTerms: YouTubeSearchConfig[] = [
  {
    searchTerm: 'aivideo',
    description: 'AI generated videos',
    maxPages: 3,
    enabled: true
  },
  {
    searchTerm: 'ai shorts',
    description: 'AI generated short videos',
    maxPages: 2,
    enabled: true
  },
  {
    searchTerm: 'stable diffusion video',
    description: 'Stable Diffusion generated videos',
    maxPages: 2,
    enabled: true
  },
  {
    searchTerm: 'midjourney video',
    description: 'Midjourney generated videos',
    maxPages: 2,
    enabled: true
  },
  {
    searchTerm: 'ai generated animation',
    description: 'AI generated animations',
    maxPages: 2,
    enabled: true
  },
  {
    searchTerm: 'machine learning video',
    description: 'Machine learning related videos',
    maxPages: 1,
    enabled: true
  },
  {
    searchTerm: 'neural network video',
    description: 'Neural network related videos',
    maxPages: 1,
    enabled: true
  },
  {
    searchTerm: 'deep learning video',
    description: 'Deep learning related videos',
    maxPages: 1,
    enabled: true
  },
  {
    searchTerm: 'artificial intelligence video',
    description: 'General AI videos',
    maxPages: 2,
    enabled: true
  },
  {
    searchTerm: 'ai art video',
    description: 'AI art videos',
    maxPages: 2,
    enabled: true
  },
  {
    searchTerm: 'ai girl',
    description: 'AI girl videos',
    maxPages: 2,
    enabled: true
  },
  {
    searchTerm: 'dall-e video',
    description: 'DALL-E generated videos',
    maxPages: 1,
    enabled: true
  },
  {
    searchTerm: 'sora ai',
    description: 'OpenAI Sora videos',
    maxPages: 2,
    enabled: true
  },
  {
    searchTerm: 'ai generated content',
    description: 'General AI generated content',
    maxPages: 2,
    enabled: true
  },
  {
    searchTerm: 'chatgpt video',
    description: 'ChatGPT related videos',
    maxPages: 1,
    enabled: true
  },
  {
    searchTerm: 'ai music video',
    description: 'AI generated music videos',
    maxPages: 1,
    enabled: true
  }
];

// Helper function to get enabled search terms
export function getEnabledSearchTerms(): YouTubeSearchConfig[] {
  return youtubeSearchTerms.filter(config => config.enabled !== false);
}

// Helper function to get enabled search terms with a limit (for rate limiting)
export function getEnabledSearchTermsWithLimit(limit?: number): YouTubeSearchConfig[] {
  const enabledTerms = getEnabledSearchTerms();
  return limit ? enabledTerms.slice(0, limit) : enabledTerms;
}

// Helper function to get total max pages across all enabled search terms
export function getTotalMaxPages(): number {
  return getEnabledSearchTerms().reduce((total, config) => total + (config.maxPages || 1), 0);
} 