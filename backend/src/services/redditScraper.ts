import { subreddits, SubredditConfig } from '../config/subreddits';
import { VideoProcessor } from './videoProcessor';
import { logger } from './logger';
import Video from '../models/Video';
import axios from 'axios';

export class RedditScraper {
    private static readonly RETRYABLE_STATUS_CODES = new Set([403, 429, 500, 502, 503, 504]);
    private static readonly DEFAULT_SEARCH_TERMS = [
        'ai video',
        'generated video',
        'stable diffusion video',
        'midjourney video',
        'sora video'
    ];

    private static decodeRedditUrl(url: string | undefined): string {
        if (!url || typeof url !== 'string') return '';
        return url.replace(/&amp;/g, '&').trim();
    }

    private static getPostSubredditName(post: any): string {
        const rawSubreddit = post?.subreddit;
        if (typeof rawSubreddit === 'string' && rawSubreddit.trim()) {
            return rawSubreddit.trim();
        }

        const displayName = rawSubreddit?.display_name;
        if (typeof displayName === 'string' && displayName.trim()) {
            return displayName.trim();
        }

        const subredditNamePrefixed = post?.subreddit_name_prefixed;
        if (typeof subredditNamePrefixed === 'string' && subredditNamePrefixed.trim()) {
            return subredditNamePrefixed.replace(/^r\//i, '').trim();
        }

        return 'unknown';
    }

    private static getPostRedditVideo(post: any): any | null {
        const asAny = post as any;

        const direct =
            asAny?.media?.reddit_video ||
            asAny?.secure_media?.reddit_video;
        if (direct) return direct;

        const crosspost = asAny?.crosspost_parent_list?.[0];
        const crosspostVideo =
            crosspost?.media?.reddit_video ||
            crosspost?.secure_media?.reddit_video;
        if (crosspostVideo) return crosspostVideo;

        return null;
    }

    private static getQuerySuffix(url: string): string {
        return url.includes('?') ? url.substring(url.indexOf('?')) : '';
    }

    private static getRedditVideoIdFromUrl(url: string | undefined): string {
        if (!url || typeof url !== 'string') return '';
        const match = url.match(/v\.redd\.it\/([^/?]+)/i);
        return match?.[1] || '';
    }

    private static normalizeSubmissionId(rawId: unknown): string | null {
        if (typeof rawId !== 'string') return null;
        const trimmed = rawId.trim();
        if (!trimmed) return null;

        // Accept permalink/full URL forms.
        const fromUrl = trimmed.match(/\/comments\/([a-z0-9]+)\//i)?.[1];
        const withoutPrefix = (fromUrl || trimmed).replace(/^t3_/i, '');

        if (!/^[a-z0-9]{5,10}$/i.test(withoutPrefix)) {
            return null;
        }
        return withoutPrefix;
    }

    private static buildRedditMp4Candidates(videoId: string, querySuffix: string): string[] {
        if (!videoId) return [];
        // Prefer unsigned candidates first; signed query params can expire.
        const suffixes = querySuffix ? ['', querySuffix] : [''];
        const candidates: string[] = [];
        for (const suffix of suffixes) {
            candidates.push(
                `https://v.redd.it/${videoId}/CMAF_720.mp4${suffix}`,
                `https://v.redd.it/${videoId}/CMAF_480.mp4${suffix}`,
                `https://v.redd.it/${videoId}/CMAF_360.mp4${suffix}`,
                `https://v.redd.it/${videoId}/DASH_1080.mp4${suffix}`,
                `https://v.redd.it/${videoId}/DASH_720.mp4${suffix}`,
                `https://v.redd.it/${videoId}/DASH_480.mp4${suffix}`,
                `https://v.redd.it/${videoId}/DASH_360.mp4${suffix}`,
                `https://v.redd.it/${videoId}/DASH_240.mp4${suffix}`,
                `https://v.redd.it/${videoId}/DASH_96.mp4${suffix}`
            );
        }
        return Array.from(new Set(candidates));
    }

    private static derivePlayableRedditVideoUrl(redditVideo: any): string {
        const fallbackUrl = this.decodeRedditUrl(redditVideo?.fallback_url as string | undefined);
        const dashUrl = this.decodeRedditUrl(redditVideo?.dash_url as string | undefined);
        const hlsUrl = this.decodeRedditUrl(redditVideo?.hls_url as string | undefined);
        const seedUrl = fallbackUrl || dashUrl || hlsUrl;
        const videoId = this.getRedditVideoIdFromUrl(seedUrl);
        const querySuffix = this.getQuerySuffix(seedUrl);
        const mp4Candidates = this.buildRedditMp4Candidates(videoId, querySuffix);

        // Prefer adaptive streams first (redditpx-style). DASH manifests usually
        // expose proper audio+video tracks where direct MP4 URLs can be silent.
        if (dashUrl) {
            return dashUrl;
        }
        if (hlsUrl) {
            return hlsUrl;
        }

        // Then try direct CMAF MP4 candidates.
        const cmafCandidate = mp4Candidates.find((candidate) => /\/CMAF_\d+\.mp4/i.test(candidate));
        if (cmafCandidate) {
            return cmafCandidate;
        }

        if (fallbackUrl && /\/DASH_\d+\.mp4/i.test(fallbackUrl)) {
            return fallbackUrl;
        }
        return mp4Candidates[0] || '';
    }

    private static getGallerySource(post: any): any | null {
        const asAny = post as any;
        if (asAny?.gallery_data?.items && asAny?.media_metadata) {
            return asAny;
        }

        const crosspost = asAny?.crosspost_parent_list?.[0];
        if (crosspost?.gallery_data?.items && crosspost?.media_metadata) {
            return crosspost;
        }

        return null;
    }

    private static getGalleryVideoUrl(post: any): string | null {
        const source = this.getGallerySource(post);
        if (!source) return null;

        const items = Array.isArray(source.gallery_data?.items) ? source.gallery_data.items : [];
        for (const item of items) {
            const mediaId = item?.media_id;
            if (!mediaId) continue;

            const mediaMeta = source.media_metadata?.[mediaId];
            const encodedMp4 = mediaMeta?.s?.mp4 || mediaMeta?.s?.u;
            const decodedUrl = this.decodeRedditUrl(encodedMp4);
            if (/^https?:\/\//i.test(decodedUrl) && /\.(mp4|webm)(\?|$)/i.test(decodedUrl)) {
                return decodedUrl;
            }
        }

        return null;
    }

    private static getRedditPreviewThumbnail(post: any): string | null {
        const asAny = post as any;
        const redditVideo = this.getPostRedditVideo(post);
        const redditVideoThumbnail = this.decodeRedditUrl(redditVideo?.thumbnail_url as string | undefined);
        if (typeof redditVideoThumbnail === 'string' && redditVideoThumbnail.startsWith('http')) {
            return redditVideoThumbnail;
        }

        const gallerySource = this.getGallerySource(post);
        if (gallerySource?.gallery_data?.items?.length) {
            const firstItem = gallerySource.gallery_data.items[0];
            const firstId = firstItem?.media_id;
            const galleryPreview =
                this.decodeRedditUrl(gallerySource?.media_metadata?.[firstId]?.s?.u) ||
                this.decodeRedditUrl(gallerySource?.media_metadata?.[firstId]?.s?.gif);
            if (typeof galleryPreview === 'string' && galleryPreview.startsWith('http')) {
                return galleryPreview;
            }
        }

        const previewUrl = asAny?.preview?.images?.[0]?.source?.url
            || asAny?.crosspost_parent_list?.[0]?.preview?.images?.[0]?.source?.url;
        if (typeof previewUrl === 'string' && previewUrl.startsWith('http')) {
            // Reddit returns escaped URLs like "&amp;"
            return this.decodeRedditUrl(previewUrl);
        }

        const thumb = asAny?.thumbnail || asAny?.crosspost_parent_list?.[0]?.thumbnail;
        if (typeof thumb === 'string' && thumb.startsWith('http')) {
            return this.decodeRedditUrl(thumb);
        }

        return null;
    }

    private static async fetchWithRetry<T>(label: string, fn: () => Promise<T>, maxAttempts: number = 3): Promise<T> {
        let lastError: any = null;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error: any) {
                lastError = error;
                const statusCode = Number(error?.statusCode || error?.response?.status || 0);
                const shouldRetry = this.RETRYABLE_STATUS_CODES.has(statusCode);
                if (!shouldRetry || attempt === maxAttempts) {
                    throw error;
                }

                const waitMs = Math.min(15000, 1000 * Math.pow(2, attempt));
                logger.warn(`Reddit API ${label} failed with status ${statusCode}. Retrying in ${waitMs}ms (attempt ${attempt}/${maxAttempts})`);
                await this.delay(waitMs);
            }
        }

        throw lastError;
    }

    private static async processPost(post: any, subredditConfig: SubredditConfig, isManualSubmission: boolean = false): Promise<boolean> {
        try {
            const postTitle = typeof post?.title === 'string' ? post.title : '';
            const subredditName = this.getPostSubredditName(post);

            // Log post details for debugging - only at debug level
            // 

            // Check if post has minimum score (more lenient now)
            if (post.score < subredditConfig.minScore) {
                // 
                return false;
            }
            
            // For AI-focused subreddits, we don't need strict keyword-gating.
            const isAIFocusedSubreddit = Boolean(subredditConfig.aiFocused);
            
            // Check for required search terms (only for non-AI-focused subreddits)
            if (!isAIFocusedSubreddit) {
                const postText = `${postTitle} ${post.selftext || ''} ${post.link_flair_text || ''}`.toLowerCase();
                
                // For manual submissions, use more lenient filtering
                if (isManualSubmission) {
                    // LENIENT FILTERING: Require at least one AI-related term
                    const aiTerms = ['ai', 'artificial intelligence', 'generated', 'stable diffusion', 'midjourney', 'dall-e', 'sora', 'gpt', 'chatgpt', 'machine learning', 'neural network', 'deep learning', 'algorithm', 'automated', 'synthetic', 'aigenerated', 'ai-generated', 'ai generated'];
                    
                    const hasAITerm = aiTerms.some(term => {
                        // Use word boundaries to prevent substring matches like "ai" in "rain"
                        const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                        return regex.test(postText);
                    });
                    
                    if (!hasAITerm) {
                        logger.info(`Manual submission rejected: No AI-related terms found in title/description`);
                        return false;
                    }
                } else {
                    // STRICT FILTERING: Require at least one primary AI term AND one secondary term
                    const primaryAITerms = ['ai', 'artificial intelligence', 'generated', 'stable diffusion', 'midjourney', 'dall-e', 'sora', 'gpt', 'chatgpt', 'machine learning', 'neural network', 'deep learning', 'algorithm', 'automated', 'synthetic'];
                    const secondaryTerms = ['video', 'created', 'made', 'produced', 'animation', 'render', 'generated', 'using', 'with', 'by', 'through'];
                    
                    // Check if post contains at least one primary AI term (using word boundaries)
                    const hasPrimaryTerm = primaryAITerms.some(term => {
                        // Use word boundaries to prevent substring matches like "ai" in "rain"
                        const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                        return regex.test(postText);
                    });
                    
                    // Check if post contains at least one secondary term (using word boundaries)
                    const hasSecondaryTerm = secondaryTerms.some(term => {
                        // Use word boundaries to prevent substring matches
                        const regex = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
                        return regex.test(postText);
                    });
                    
                    // Only accept posts that have both a primary AI term AND a secondary term
                    if (!(hasPrimaryTerm && hasSecondaryTerm)) {
                        logger.info(`Skipping post: Insufficient AI-related terms in title/description - Primary: ${hasPrimaryTerm}, Secondary: ${hasSecondaryTerm}`);
                        return false;
                    }
                    
                    // Additional check: Ensure the primary AI term is actually referring to AI generation, not just mentioning AI
                    const aiGenerationPatterns = [
                        /ai\s+(generated|created|made|produced|video|animation|render|using|with|by|through)/i,
                        /(generated|created|made|produced)\s+(by|with|using)\s+ai/i,
                        /(stable diffusion|midjourney|dall-e|sora)\s+(generated|created|made|produced|video|animation|render|using|with|by|through)/i,
                        /(generated|created|made|produced)\s+(by|with|using)\s+(stable diffusion|midjourney|dall-e|sora)/i,
                        /machine learning\s+(generated|created|made|produced)/i,
                        /neural network\s+(generated|created|made|produced)/i,
                        /deep learning\s+(generated|created|made|produced)/i,
                        /algorithm\s+(generated|created|made|produced)/i
                    ];
                    
                    const hasAIGenerationPattern = aiGenerationPatterns.some(pattern => pattern.test(postText));
                    
                    if (!hasAIGenerationPattern) {
                        logger.info(`Skipping post: No clear AI generation pattern found in title/description`);
                        return false;
                    }
                }
            }

            // Check for excluded terms
            if (subredditConfig.excludeTerms && subredditConfig.excludeTerms.length > 0) {
                const postText = `${postTitle} ${post.selftext || ''}`.toLowerCase();
                const hasExcludedTerm = subredditConfig.excludeTerms.some(term => postText.includes(term.toLowerCase()));
                if (hasExcludedTerm) {
                    // 
                    return false;
                }
            }

            // Process video URL
            let videoUrl = '';

            // Extract the video ID for better handling with Reddit videos
            let videoId = '';
            let redditVideo: any = null;
            let galleryVideoUrl = '';
            
            // Check for Reddit-hosted videos
            redditVideo = this.getPostRedditVideo(post);
            if (redditVideo) {
                videoUrl = this.derivePlayableRedditVideoUrl(redditVideo);
                videoId = this.getRedditVideoIdFromUrl(videoUrl);
            } else if ((galleryVideoUrl = this.getGalleryVideoUrl(post) || '')) {
                videoUrl = galleryVideoUrl;
            }
            // Check for direct video links
            else if (post.url?.match(/\.(mp4|webm)$/i)) {
                videoUrl = post.url;
            }
            // Check for external video platforms
            else if (post.media?.type === 'youtube.com' || post.url?.includes('youtube.com') || post.url?.includes('youtu.be')) {
                
                return false;
            }

            if (!videoId) {
                videoId = this.getRedditVideoIdFromUrl(videoUrl);
            }
            if (!videoUrl) {
                return false;
            }

            // Validate video URL
            const videoMetadata = await VideoProcessor.validateVideo(videoUrl);
            if (!videoMetadata) {
                return false;
            }

            // Prefer Reddit-provided preview thumbnails to avoid ffmpeg failures.
            let thumbnailUrl = '';
            const redditPreviewThumbnail = this.getRedditPreviewThumbnail(post);
            if (redditPreviewThumbnail) {
                thumbnailUrl = redditPreviewThumbnail;
            }

            if (videoMetadata.url.includes('v.redd.it') && videoId) {
                // Do not rely on ffmpeg for v.redd.it thumbnails; keep only Reddit-provided previews.
                if (!thumbnailUrl) return false;
            } else {
                // For non-Reddit videos, use the standard method
                if (!thumbnailUrl) {
                    thumbnailUrl = await VideoProcessor.generateThumbnail(videoMetadata.url);
                }
                
                // Ensure thumbnailUrl is never undefined for non-Reddit videos too
                if (!thumbnailUrl) {
                    thumbnailUrl = await VideoProcessor.generateThumbnail(videoMetadata.url);
                }
            }

            // Skip rows with no usable thumbnail.
            if (!thumbnailUrl || !(thumbnailUrl.startsWith('/thumbnails/') || /^https?:\/\//i.test(thumbnailUrl))) {
                return false;
            }

            // Extract tags - create simple tags from title and subreddit if extractTags not available
            let tags;
            try {
                // Use the VideoProcessor.extractTags method if available
                tags = VideoProcessor.extractTags(postTitle, subredditName);
            } catch (error) {
                // Fallback tag extraction if the method is not available
                const tagSet = new Set<string>();
                
                // Add subreddit as a tag
                tagSet.add(subredditName.toLowerCase());
                
                // Add simple word-based tags from title
                const words = postTitle.toLowerCase()
                    .replace(/[^\w\s]/g, ' ')
                    .split(/\s+/)
                    .filter((word: string) => word.length > 3 && !['with', 'this', 'that', 'from', 'what', 'when', 'where'].includes(word));
                
                words.forEach((word: string) => tagSet.add(word));
                
                tags = Array.from(tagSet).slice(0, 10);
            }
            
            // Check if post is NSFW
            const isNsfw = post.over_18 || false;
            
            // For Reddit videos, try to extract audio URL
            let audioUrl = '';
            let redditVideoSources: { fallbackUrl?: string; dashUrl?: string; hlsUrl?: string; mp4Candidates?: string[] } | undefined;
            if (videoMetadata.url.includes('v.redd.it')) {
                const fallbackUrl = this.decodeRedditUrl(redditVideo?.fallback_url as string | undefined) || undefined;
                const dashUrl = this.decodeRedditUrl(redditVideo?.dash_url as string | undefined) || undefined;
                const hlsUrl = this.decodeRedditUrl(redditVideo?.hls_url as string | undefined) || undefined;
                const querySeed = fallbackUrl || dashUrl || hlsUrl || videoMetadata.url;
                const videoIdFromSources = this.getRedditVideoIdFromUrl(querySeed);
                const querySuffix = this.getQuerySuffix(querySeed);
                const mp4Candidates = this.buildRedditMp4Candidates(videoIdFromSources, querySuffix);

                if (fallbackUrl || dashUrl || hlsUrl) {
                    redditVideoSources = {
                        fallbackUrl,
                        dashUrl,
                        hlsUrl,
                        mp4Candidates
                    };
                }
                if (videoIdFromSources) {
                    audioUrl = `https://v.redd.it/${videoIdFromSources}/CMAF_AUDIO_128.mp4${querySuffix}`;
                }
            }
            
            // Prepare video data
            const videoData = {
                title: postTitle,
                description: post.selftext || '',
                videoUrl: videoMetadata.url,
                thumbnailUrl,
                redditId: post.id,
                subreddit: subredditName,
                platform: 'reddit',
                tags,
                nsfw: isNsfw,
                likes: post.score, // Store upvotes in likes column for frontend display
                metadata: {
                    width: videoMetadata.width,
                    height: videoMetadata.height,
                    format: videoMetadata.format,
                    duration: videoMetadata.duration,
                    redditScore: post.score,
                    redditUrl: `https://reddit.com${post.permalink}`,
                    upvotes: post.score, // Store upvotes in metadata too for backward compatibility
                    audioUrl, // Store the audio URL in metadata
                    redditVideoSources,
                    author: post.author ? post.author.name : null // Store author name for duplicate detection
                }
            };
            
            try {
                // First, check if a video with this exact redditId already exists
                const existingVideo = await Video.findOne({ where: { redditId: post.id } });
                
                if (existingVideo) {
                    // Video with this redditId already exists, update it if the new one has more upvotes
                    if (post.score > existingVideo.likes) {
                        await existingVideo.update(videoData);
                        return true;
                    } else {
                        // Skip this video as we already have it with equal or higher upvotes
                        return false;
                    }
                }
                
                await Video.create({
                    ...videoData,
                    createdAt: new Date(post.created_utc * 1000),
                    views: 0,
                    blacklisted: false // Add the blacklisted field with default value
                });
                
                return true;
            } catch (error) {
                logger.error(`Failed to save video to database: ${post.title} (${post.id})`, error);
                return false; // Skip this video but continue processing others
            }
        } catch (error) {
            logger.error(`Error processing post: ${post.id}`, {
                error: error instanceof Error ? error.message : String(error),
                post: {
                    id: post.id,
                    title: post.title,
                    subreddit: post.subreddit,
                    is_video: post.is_video,
                    media: post.media,
                    url: post.url
                }
            });
            return false;
        }
    }

    // Helper function to delay execution for rate limiting
    private static async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    private static readonly REDDIT_PUBLIC_HEADERS = {
        // Reddit expects a descriptive UA. Keep env override, otherwise use policy-compliant default.
        'User-Agent': process.env.REDDIT_USER_AGENT || 'web:virtualfeed.xyz:v1.0.0 (by /u/virtualfeed)',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'application/json',
        // Helps access age-gated listings where allowed.
        'Cookie': 'over18=1'
    };

    private static async fetchRedditJson<T>(url: string): Promise<T> {
        const candidates = [url];
        if (url.includes('https://www.reddit.com/')) {
            candidates.push(url.replace('https://www.reddit.com/', 'https://old.reddit.com/'));
            candidates.push(url.replace('https://www.reddit.com/', 'https://reddit.com/'));
        }

        let lastError: any = null;

        for (const candidate of candidates) {
            try {
                const response = await axios.get<T>(candidate, {
                    timeout: 15000,
                    maxRedirects: 5,
                    headers: this.REDDIT_PUBLIC_HEADERS
                });
                return response.data;
            } catch (error: any) {
                lastError = error;
            }
        }

        throw lastError;
    }

    private static mapListingChildren(listing: any): any[] {
        const children = listing?.data?.children || [];
        if (!Array.isArray(children)) return [];
        return children
            .map((child: any) => child?.data)
            .filter((post: any) => post && typeof post.id === 'string');
    }

    private static async fetchSubmissionByIdJson(submissionId: string): Promise<any | null> {
        try {
            const normalized = this.normalizeSubmissionId(submissionId);
            if (!normalized) return null;
            const data = await this.fetchWithRetry<any>(
                `submission json ${normalized}`,
                () => this.fetchRedditJson<any>(`https://www.reddit.com/comments/${normalized}.json?raw_json=1`)
            );
            const post = data?.[0]?.data?.children?.[0]?.data;
            return post || null;
        } catch {
            return null;
        }
    }

    private static async fetchSubredditPostsFromJson(
        subredditName: string,
        searchTerms: string[],
        enableSearch: boolean
    ): Promise<any[]> {
        const collected: any[] = [];
        const seen = new Set<string>();
        const perRequestDelayMs = Number(process.env.REDDIT_REQUEST_DELAY_MS || 1200);

        const pushPosts = (items: any[]) => {
            for (const post of items) {
                if (!post?.id || seen.has(post.id)) continue;
                seen.add(post.id);
                collected.push(post);
            }
        };

        // Search-first by configured terms (like old behavior).
        if (enableSearch) {
            // Search-first by configured terms (like old behavior).
            for (const term of searchTerms) {
                const encoded = encodeURIComponent(term);
                const url = `https://www.reddit.com/r/${subredditName}/search.json?q=${encoded}&restrict_sr=1&sort=new&t=week&limit=40&raw_json=1`;
                try {
                    const searchJson = await this.fetchWithRetry<any>(
                        `r/${subredditName} search.json(${term})`,
                        () => this.fetchRedditJson<any>(url)
                    );
                    pushPosts(this.mapListingChildren(searchJson));
                } catch (error) {
                    const statusCode = Number((error as any)?.statusCode || (error as any)?.response?.status || 0);
                    const message = (error as any)?.message || 'unknown_error';
                    logger.warn(`Search JSON failed for r/${subredditName} term="${term}"`, { statusCode, message });
                }
                await this.delay(perRequestDelayMs);
            }
        }

        const listingUrls = [
            `https://www.reddit.com/r/${subredditName}/new.json?limit=60&raw_json=1`,
            `https://www.reddit.com/r/${subredditName}/rising.json?limit=40&raw_json=1`,
            `https://www.reddit.com/r/${subredditName}/hot.json?limit=40&raw_json=1`,
            `https://www.reddit.com/r/${subredditName}/top.json?t=week&limit=40&raw_json=1`
        ];

        for (const url of listingUrls) {
            try {
                const listing = await this.fetchWithRetry<any>(
                    `r/${subredditName} listing`,
                    () => this.fetchRedditJson<any>(url)
                );
                pushPosts(this.mapListingChildren(listing));
            } catch (error) {
                const statusCode = Number((error as any)?.statusCode || (error as any)?.response?.status || 0);
                const message = (error as any)?.message || 'unknown_error';
                logger.warn(`Listing JSON failed for r/${subredditName}: ${url}`, { statusCode, message });
            }
            await this.delay(perRequestDelayMs);
        }

        return collected;
    }

    private static getSearchTermsForSubreddit(subredditConfig: SubredditConfig): string[] {
        // AI-focused subreddits already contain relevant content by definition.
        // Skip keyword search to reduce request volume/failures and use listing feeds only.
        if (subredditConfig.aiFocused) {
            return [];
        }

        const envTerms = process.env.REDDIT_SEARCH_TERMS
            ?.split(',')
            .map(term => term.trim())
            .filter(Boolean) || [];
        const configTerms = (subredditConfig.searchTerms || []).map(term => term.trim()).filter(Boolean);

        if (configTerms.length > 0) {
            return configTerms;
        }

        if (envTerms.length > 0) {
            return envTerms;
        }

        return this.DEFAULT_SEARCH_TERMS;
    }

    private static async getSubredditPosts(subredditConfig: SubredditConfig): Promise<any[]> {
        const subredditName = subredditConfig.name;
        const posts: any[] = [];
        const seenIds = new Set<string>();
        const searchTerms = this.getSearchTermsForSubreddit(subredditConfig);
        
        // Get existing redditIds from the database to avoid processing posts we already have
        let existingRedditIds = new Set<string>();
        try {
            const existingVideos = await Video.findAll({
                attributes: ['redditId'],
                where: { subreddit: subredditName },
                raw: true
            });
            existingRedditIds = new Set(
                existingVideos
                    .map((video: any) => video.redditId)
                    .filter((redditId: any) => typeof redditId === 'string' && redditId.length > 0)
            );
        } catch (error) {
            logger.error(`Error fetching existing videos for subreddit ${subredditName}`, error);
            // Continue with empty array if there was an error
        }

        const pushIfNew = (post: any) => {
            if (!seenIds.has(post.id) && !existingRedditIds.has(post.id)) {
                posts.push(post);
                seenIds.add(post.id);
            }
        };

        try {
            const jsonPosts = await this.fetchSubredditPostsFromJson(
                subredditName,
                searchTerms,
                !subredditConfig.aiFocused
            );
            for (const post of jsonPosts) {
                pushIfNew(post);
            }
        } catch (error) {
            logger.error(`Error fetching JSON posts from subreddit: ${subredditName}`, error);
        }

        return posts;
    }

    private static async scrapeSubreddit(subredditConfig: SubredditConfig): Promise<number> {
        let processedCount = 0;
        try {
            const posts = await this.getSubredditPosts(subredditConfig);
            
            for (const post of posts) {
                try {
                    const processed = await this.processPost(post, subredditConfig);
                    if (processed) processedCount++;
                } catch (postError) {
                    logger.error(`Error processing post ${post.id} from r/${subredditConfig.name}`, postError);
                    // Continue with next post
                }
            }
        } catch (subredditError) {
            logger.error(`Error scraping subreddit: ${subredditConfig.name}`, subredditError);
            // Continue with next subreddit
        }
        return processedCount;
    }

    static async scrapeSubreddits(): Promise<void> {
        logger.info('Starting Reddit scraping...');
        
        for (const subredditConfig of subreddits) {
            try {
                logger.info(`Scraping subreddit: ${subredditConfig.name}`);
                const processedCount = await RedditScraper.scrapeSubreddit(subredditConfig);
                logger.info(`Processed ${processedCount} videos from r/${subredditConfig.name}`);
                
                // Add delay between subreddits to be respectful to Reddit's API
                await RedditScraper.delay(2000);
            } catch (error) {
                logger.error(`Error scraping subreddit ${subredditConfig.name}:`, error);
            }
        }
        
        logger.info('Reddit scraping completed.');
    }

    static async refreshRecentMediaSources(limit: number = 200): Promise<number> {
        logger.info(`Refreshing Reddit media sources for up to ${limit} videos...`);
        const refreshedWindowMs = 6 * 60 * 60 * 1000; // 6h
        let refreshedCount = 0;

        const videos = await Video.findAll({
            where: {
                platform: 'reddit',
                blacklisted: false
            },
            order: [['updatedAt', 'ASC']],
            limit
        });

        for (const video of videos) {
            try {
                const metadata: any = typeof video.metadata === 'object' && video.metadata ? { ...(video.metadata as any) } : {};
                const lastRefreshedAt = metadata?.mediaRefreshedAt ? new Date(metadata.mediaRefreshedAt).getTime() : 0;
                if (lastRefreshedAt && Date.now() - lastRefreshedAt < refreshedWindowMs) {
                    continue;
                }

                const submissionId = this.normalizeSubmissionId(video.redditId);
                if (!submissionId) {
                    await video.update({ blacklisted: true });
                    logger.warn(`Blacklisting reddit row with invalid redditId: ${video.redditId}`);
                    continue;
                }

                const post: any = await this.fetchSubmissionByIdJson(submissionId);

                const redditVideo = this.getPostRedditVideo(post);
                if (!post || !redditVideo) {
                    await video.update({ blacklisted: true });
                    continue;
                }

                const fallbackUrl = this.decodeRedditUrl(redditVideo?.fallback_url as string | undefined) || undefined;
                const dashUrl = this.decodeRedditUrl(redditVideo?.dash_url as string | undefined) || undefined;
                const hlsUrl = this.decodeRedditUrl(redditVideo?.hls_url as string | undefined) || undefined;
                const refreshedVideoUrl = this.derivePlayableRedditVideoUrl(redditVideo) || video.videoUrl;
                const refreshedThumbnailUrl = this.getRedditPreviewThumbnail(post) || video.thumbnailUrl;

                // If we still don't have any playable stream URL, blacklist to avoid dead cards.
                if (!refreshedVideoUrl) {
                    await video.update({ blacklisted: true });
                    continue;
                }

                const querySuffix = refreshedVideoUrl.includes('?')
                    ? refreshedVideoUrl.substring(refreshedVideoUrl.indexOf('?'))
                    : '';

                const match = refreshedVideoUrl.match(/v\.redd\.it\/([^/?]+)/i);
                const refreshedAudioUrl = match?.[1]
                    ? `https://v.redd.it/${match[1]}/CMAF_AUDIO_128.mp4${querySuffix}`
                    : metadata?.audioUrl || '';
                const refreshedCandidates = match?.[1]
                    ? this.buildRedditMp4Candidates(match[1], querySuffix)
                    : [];

                const refreshedMetadata = {
                    ...metadata,
                    redditUrl: `https://reddit.com${post.permalink}`,
                    redditScore: post.score,
                    upvotes: post.score,
                    audioUrl: refreshedAudioUrl,
                    redditVideoSources: {
                        fallbackUrl,
                        dashUrl,
                        hlsUrl,
                        mp4Candidates: refreshedCandidates
                    },
                    mediaRefreshedAt: new Date().toISOString()
                };

                await video.update({
                    videoUrl: refreshedVideoUrl,
                    thumbnailUrl: refreshedThumbnailUrl,
                    likes: post.score,
                    metadata: refreshedMetadata
                });

                refreshedCount++;
                await this.delay(400);
            } catch (error: any) {
                const statusCode = Number(error?.statusCode || error?.response?.status || 0);
                if (statusCode === 400 || statusCode === 403 || statusCode === 404) {
                    await video.update({ blacklisted: true });
                    continue;
                }
                logger.warn(`Failed to refresh media sources for redditId=${video.redditId}`, {
                    message: error?.message,
                    statusCode
                });
            }
        }

        logger.info(`Reddit media refresh completed. Updated ${refreshedCount} videos`);
        return refreshedCount;
    }

    static async processSinglePost(redditUrl: string, isNsfw: boolean = false): Promise<{ success: boolean; video?: any; error?: string }> {
        try {
            // Extract subreddit name and post ID from URL
            const urlMatch = redditUrl.match(/reddit\.com\/r\/([^\/]+)\/comments\/([^\/]+)\/([^\/]+)/);
            if (!urlMatch) {
                return { success: false, error: 'Invalid Reddit URL format' };
            }

            const [, subredditName, postId] = urlMatch;
            
            // Get the post using Reddit API
            const post: any = await this.fetchSubmissionByIdJson(postId);
            if (!post) {
                return { success: false, error: 'Could not fetch the Reddit post via public JSON endpoint' };
            }
            
            // Create a mock subreddit config for processing
            const subredditConfig: SubredditConfig = {
                name: subredditName,
                minScore: 1, // Lower threshold for manual submissions
                excludeTerms: [],
                searchTerms: [] // No search terms required for manual submissions
            };

            // Override NSFW check if user explicitly marked it as NSFW
            if (isNsfw) {
                post.over_18 = true;
            }

            // Check if video already exists
            const existingVideo = await Video.findOne({
                where: { redditId: post.id }
            });

            if (existingVideo) {
                return { success: false, error: 'Video already exists in our collection' };
            }

            // Process the post using existing logic
            const processed = await RedditScraper.processPost(post, subredditConfig, true); // true = manual submission
            
            if (processed) {
                // Find the newly created video
                const newVideo = await Video.findOne({
                    where: { redditId: post.id }
                });

                if (newVideo) {
                    return { success: true, video: newVideo.toJSON() };
                } else {
                    return { success: false, error: 'Video was processed but not found in database' };
                }
            } else {
                return { 
                    success: false, 
                    error: 'This video does not appear to be AI-generated content. Please submit videos that are clearly created using AI tools like Stable Diffusion, Midjourney, DALL-E, or other AI generation platforms.' 
                };
            }

        } catch (error) {
            logger.error('Error processing single post:', error);
            return { 
                success: false, 
                error: error instanceof Error ? error.message : 'Unknown error occurred' 
            };
        }
    }
}
