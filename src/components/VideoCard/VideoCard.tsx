import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, Typography, CardActionArea, Box, Skeleton, styled } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import MovieIcon from '@mui/icons-material/Movie';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RedditIcon from '@mui/icons-material/Reddit';
import { Video } from '../../types/Video';
import { getBackendAssetUrl, getRedditThumbnailProxyUrl, getRedditVideoProxyUrl } from '../../services/api';

interface VideoCardProps {
    video: Video;
    onClick: () => void;
    showNsfw?: boolean;
    isFocused?: boolean;
    isPlaying?: boolean;
    isLargeDevice?: boolean;
    onHoverStart?: () => void;
    onHoverEnd?: () => void;
}

// Simple styled components for VideoCard
const StyledCard = styled(Card)(({ theme }) => ({
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: '#181818',
    borderRadius: '12px',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    overflow: 'hidden',
    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
    '&:hover': {
        transform: 'translateY(-2px)',
        boxShadow: '0 10px 20px rgba(0, 0, 0, 0.35)'
    },
    // Mobile TikTok-like styling
    [theme.breakpoints.down('sm')]: {
        borderRadius: '10px',
        height: 'auto',
        minHeight: 'auto',
        '&:hover': {
            transform: 'none',
            boxShadow: 'none'
        },
    },
}));

const PlayOverlay = styled(Box)(({ theme }) => ({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    transition: 'opacity 0.3s ease',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    '&:hover': {
        opacity: 1,
    },
    [theme.breakpoints.down('sm')]: {
        '& .MuiSvgIcon-root': {
            fontSize: '2.5rem',
        },
    },
}));

const ThumbnailOverlay = styled(Box)(() => ({
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px',
    background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0) 100%)',
    '@media (max-width: 600px)': {
        padding: '8px',
    },
}));

const VideoCard: React.FC<VideoCardProps> = ({ video, onClick, showNsfw = false, isFocused = false, isPlaying = false, isLargeDevice = false, onHoverStart, onHoverEnd }) => {
    const [imageLoading, setImageLoading] = useState(true);
    const [thumbnailUrl, setThumbnailUrl] = useState<string>(video.thumbnailUrl || '');
    const [retryCount, setRetryCount] = useState(0);
    const [isNsfwHovered, setIsNsfwHovered] = useState(false);
    const maxRetries = 3;
    const imageRef = useRef<HTMLImageElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const stripControlChars = useCallback((value: string): string => {
        return Array.from(value)
            .filter((ch) => {
                const code = ch.charCodeAt(0);
                if (code === 9 || code === 10 || code === 13) return true;
                return code >= 32 && code !== 127;
            })
            .join('');
    }, []);
    
    // Create a fallback thumbnail with the video title
    const createFallbackThumbnail = useCallback((title: string) => {
        try {
            // Sanitize the title first to ensure it's safe for SVG and URI encoding
            let sanitizedTitle = 'No Title';
            if (title) {
                // Shorten the title
                let shortened = title.substring(0, 30) + (title.length > 30 ? '...' : '');
                
                // Replace special characters for XML safety
                shortened = shortened
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;');
                
                // Keep multilingual characters; only remove control chars that can break SVG.
                sanitizedTitle = stripControlChars(shortened).trim() || 'No Title';
            }
                
            // Create a data URL for an SVG with the title text
            const svgContent = `
                <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
                    <rect width="100%" height="100%" fill="#121212"/>
                    <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${sanitizedTitle}</text>
                </svg>
            `;
            
            // Ensure the SVG content is properly trimmed and encoded
            return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent.trim())}`;
        } catch (error) {
            console.error('Error creating fallback thumbnail:', error);
            // Return a simple colored rectangle if encoding fails
            return 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22640%22%20height%3D%22360%22%3E%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20fill%3D%22%23121212%22%2F%3E%3C%2Fsvg%3E';
        }
    }, [stripControlChars]);

    const getRedditHoverPreviewUrl = useCallback((): string => {
        if (video.platform !== 'reddit') return video.videoUrl;

        const parseMeta = (): any => {
            if (video.metadata && typeof video.metadata === 'object') return video.metadata;
            if (typeof video.metadata === 'string') {
                try {
                    return JSON.parse(video.metadata);
                } catch {
                    return {};
                }
            }
            return {};
        };

        const meta = parseMeta();
        const cleanup = (value: string) => value.replace(/&amp;/g, '&').trim();
        const isMp4 = (value: string) => /\.mp4(\?|$)/i.test(value);
        const extractVideoId = (value: string) => value.match(/v\.redd\.it\/([^/?]+)/i)?.[1] || '';

        const sourceCandidates = Array.isArray(meta?.redditVideoSources?.mp4Candidates)
            ? meta.redditVideoSources.mp4Candidates
                .filter((c: any) => typeof c === 'string' && c.trim().length > 0)
                .map((c: string) => cleanup(c))
            : [];

        const sourceFallback = typeof meta?.redditVideoSources?.fallbackUrl === 'string'
            ? cleanup(meta.redditVideoSources.fallbackUrl)
            : '';

        const explicitMp4 = [sourceFallback, ...sourceCandidates].find((c: string) => isMp4(c));
        if (explicitMp4) return getRedditVideoProxyUrl(explicitMp4);

        if (typeof video.videoUrl === 'string' && isMp4(video.videoUrl)) {
            return getRedditVideoProxyUrl(cleanup(video.videoUrl));
        }

        const seed = `${sourceFallback} ${video.videoUrl || ''}`;
        const videoId = extractVideoId(seed);
        if (videoId) {
            return getRedditVideoProxyUrl(`https://v.redd.it/${videoId}/CMAF_720.mp4`);
        }

        return video.videoUrl;
    }, [video]);
    
    const tryNextThumbnail = useCallback((urls: string[], index: number) => {
        if (index >= urls.length) {
            // If all alternatives fail, create a fallback thumbnail with the video title
            const fallbackThumbnail = createFallbackThumbnail(video.title);
            setThumbnailUrl(fallbackThumbnail);
            setImageLoading(false);
            return;
        }
        
        const img = new Image();
        img.onload = () => {
            setThumbnailUrl(urls[index]);
            setImageLoading(false);
        };
        img.onerror = () => {
            // Try the next URL
            tryNextThumbnail(urls, index + 1);
        };
        img.crossOrigin = 'anonymous'; // Add cross-origin handling
        img.src = urls[index];
    }, [video.title, createFallbackThumbnail]);
    
    // Use Intersection Observer for lazy loading
    useEffect(() => {
        // Create an observer for lazy loading
        const observer = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                // Only load the image when the card is visible
                if (video.thumbnailUrl) {
                    // Try to load the thumbnail from different sources
                    const extractRedditVideoId = (rawUrl?: string): string => {
                        if (!rawUrl || typeof rawUrl !== 'string') return '';
                        return rawUrl.match(/v\.redd\.it\/([^/?]+)/i)?.[1] || '';
                    };
                    
                    // Prefer local thumbnails, but allow absolute remote URLs (e.g. Reddit preview images).
                    if (video.thumbnailUrl && video.thumbnailUrl.startsWith('/thumbnails/')) {
                        // Make sure the thumbnail path has the .jpg extension
                        const thumbnailPath = video.thumbnailUrl.endsWith('.jpg') 
                            ? video.thumbnailUrl 
                            : `${video.thumbnailUrl}.jpg`;
                        const absoluteThumbnailUrl = getBackendAssetUrl(thumbnailPath);
                        const fallbackUrls = [absoluteThumbnailUrl, thumbnailPath];

                        if (video.platform === 'reddit') {
                            const redditVideoId = extractRedditVideoId(video.videoUrl);
                            if (redditVideoId) {
                                fallbackUrls.push(
                                    getRedditThumbnailProxyUrl(`https://i.redd.it/${redditVideoId}.jpg`)
                                );
                            }
                        }

                        tryNextThumbnail(Array.from(new Set(fallbackUrls)), 0);
                    } else if (/^https?:\/\//i.test(video.thumbnailUrl)) {
                        const remoteUrl = (video.thumbnailUrl || '').replace(/&amp;/g, '&');
                        if (video.platform === 'reddit') {
                            const proxiedThumbnailUrl = getRedditThumbnailProxyUrl(remoteUrl);
                            const proxiedImg = new Image();
                            proxiedImg.onload = () => {
                                setThumbnailUrl(proxiedThumbnailUrl);
                                setImageLoading(false);
                            };
                            proxiedImg.onerror = () => {
                                // Fallback to direct URL if proxy fails.
                                const directImg = new Image();
                                directImg.onload = () => {
                                    setThumbnailUrl(remoteUrl);
                                    setImageLoading(false);
                                };
                                directImg.onerror = () => {
                                    const fallbackThumbnail = createFallbackThumbnail(video.title);
                                    setThumbnailUrl(fallbackThumbnail);
                                    setImageLoading(false);
                                };
                                directImg.crossOrigin = 'anonymous';
                                directImg.src = remoteUrl;
                            };
                            proxiedImg.crossOrigin = 'anonymous';
                            proxiedImg.src = proxiedThumbnailUrl;
                        } else {
                            const img = new Image();
                            img.onload = () => {
                                setThumbnailUrl(remoteUrl);
                                setImageLoading(false);
                            };
                            img.onerror = () => {
                                const fallbackThumbnail = createFallbackThumbnail(video.title);
                                setThumbnailUrl(fallbackThumbnail);
                                setImageLoading(false);
                            };
                            img.crossOrigin = 'anonymous';
                            img.src = remoteUrl;
                        }
                    } else {
                        // If no valid thumbnail URL, use SVG fallback
                        const fallbackThumbnail = createFallbackThumbnail(video.title);
                        setThumbnailUrl(fallbackThumbnail);
                        setImageLoading(false);
                    }
                } else {
                    // If no thumbnail URL, create a fallback
                    const fallbackThumbnail = createFallbackThumbnail(video.title);
                    setThumbnailUrl(fallbackThumbnail);
                    setImageLoading(false);
                }
                
                // Disconnect the observer after loading
                observer.disconnect();
            }
        }, { rootMargin: '200px', threshold: 0.1 });
        
        // Start observing the card
        if (cardRef.current) {
            observer.observe(cardRef.current);
        }
        
        // Cleanup function
        return () => {
            observer.disconnect();
            // Clear any pending retry timeouts
            if (retryTimeoutRef.current !== null) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }
        };
    }, [video.thumbnailUrl, video.title, video.redditId, video.metadata, video.platform, video.videoUrl, tryNextThumbnail, createFallbackThumbnail]);
    
    const handleImageError = () => {
        // If we haven't reached max retries, try again
        if (retryCount < maxRetries) {
            setRetryCount(prevCount => prevCount + 1);
            
            // Clear any existing timeout
            if (retryTimeoutRef.current !== null) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }
            
            // Use exponential backoff for retries (1s, 2s, 4s)
            const delay = Math.pow(2, retryCount) * 1000;
            retryTimeoutRef.current = setTimeout(() => {
                // Force reload by appending a cache-busting parameter
                if (imageRef.current) {
                    const cacheBuster = `?retry=${Date.now()}`;
                    const urlWithoutCacheBuster = thumbnailUrl.split('?')[0];
                    imageRef.current.src = `${urlWithoutCacheBuster}${cacheBuster}`;
                }
                // Reset the timeout ref after it's executed
                retryTimeoutRef.current = null;
            }, delay);
        } else {
            // If we've reached max retries, just set loading to false
            setImageLoading(false);
        }
    };

    const handleOpenRedditPost = (e: React.MouseEvent) => {
        e.stopPropagation();
        const metadata: any = video.metadata && typeof video.metadata === 'object' ? video.metadata : {};
        const redditUrl = metadata?.redditUrl;
        if (typeof redditUrl === 'string' && redditUrl.trim()) {
            window.open(redditUrl, '_blank', 'noopener,noreferrer');
        }
    };

    useEffect(() => {
        setIsNsfwHovered(false);
    }, [video.id, showNsfw]);

    const canHoverUnblurNsfw = showNsfw && video.nsfw;
    const shouldBlurNsfw = video.nsfw && !(canHoverUnblurNsfw && isNsfwHovered);

    return (
        <StyledCard ref={cardRef} title={video.id + ""}>
            <CardActionArea
                onClick={onClick}
                onMouseEnter={() => {
                    if (canHoverUnblurNsfw) setIsNsfwHovered(true);
                    if (isLargeDevice) onHoverStart?.();
                }}
                onMouseLeave={() => {
                    if (canHoverUnblurNsfw) setIsNsfwHovered(false);
                    if (isLargeDevice) onHoverEnd?.();
                }}
                sx={{
                    position: 'relative',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'stretch',
                    justifyContent: 'flex-start'
                }}
            >
                {/* Single container for both skeleton and image to ensure consistent sizing */}
                <Box sx={{
                    position: 'relative',
                    width: '100%',
                    paddingTop: { xs: '125%', md: '56.25%' }, // mobile compact card, desktop 16:9 like YouTube
                    overflow: 'hidden',
                }}>
                    {/* Skeleton overlay */}
                    {imageLoading && (
                        <>
                            <Skeleton 
                                variant="rectangular" 
                                animation="wave"
                                sx={{ 
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    bgcolor: 'grey.800',
                                }}
                            />
                            <Box sx={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <MovieIcon sx={{ 
                                    fontSize: { xs: 32, sm: 40 }, 
                                    opacity: 0.7 
                                }} />
                            </Box>
                        </>
                    )}
                    
                    {/* Show video when playing, image when not */}
                    {isPlaying ? (
                        <video
                            src={getRedditHoverPreviewUrl()}
                            autoPlay
                            muted
                            loop
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                objectPosition: 'center',
                                filter: shouldBlurNsfw ? 'blur(10px)' : 'none',
                            }}
                        />
                    ) : (
                        <img
                            src={thumbnailUrl}
                            alt={video.title}
                            ref={imageRef}
                            style={{
                                display: imageLoading ? 'none' : 'block',
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                                objectPosition: 'center',
                                filter: shouldBlurNsfw ? 'blur(10px)' : 'none',
                                transition: 'filter 0.3s ease'
                            }}
                            onLoad={() => setImageLoading(false)}
                            onError={handleImageError}
                            loading="lazy"
                        />
                    )}
                </Box>
                {/* Play overlay - only show when not playing */}
                {!isPlaying && (
                    <PlayOverlay>
                        <Box sx={{
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            borderRadius: '50%',
                            width: { xs: '40px', sm: '50px' },
                            height: { xs: '40px', sm: '50px' },
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 0 15px rgba(0, 0, 0, 0.3)'
                        }}>
                            <PlayArrowIcon sx={{ fontSize: { xs: 28, sm: 36 }, color: 'white', opacity: 0.9 }} />
                        </Box>
                    </PlayOverlay>
                )}

                {/* Focus indicator - shows when video is in viewport center (only on mobile) */}
                {isFocused && !isLargeDevice && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: '10px',
                            right: '10px',
                            backgroundColor: 'rgba(0, 255, 0, 0.8)',
                            borderRadius: '50%',
                            width: 12,
                            height: 12,
                            animation: 'pulse 2s infinite',
                            '@keyframes pulse': {
                                '0%': {
                                    transform: 'scale(1)',
                                    opacity: 1,
                                },
                                '50%': {
                                    transform: 'scale(1.2)',
                                    opacity: 0.7,
                                },
                                '100%': {
                                    transform: 'scale(1)',
                                    opacity: 1,
                                },
                            },
                        }}
                    />
                )}
                
                <ThumbnailOverlay>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {/* Views count */}
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <VisibilityIcon sx={{ 
                                fontSize: { xs: 14, sm: 16 }, 
                                color: 'white',
                                mr: 0.5,
                                opacity: 0.9
                            }} />
                            <Typography 
                                variant="caption" 
                                sx={{ 
                                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                    color: 'white',
                                    fontWeight: 500
                                }}
                            >
                                {video.views || 0}
                            </Typography>
                        </Box>
                        
                        {/* Platform-specific engagement metrics */}
                        {/* Reddit upvotes */}
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <ThumbUpIcon sx={{ 
                                fontSize: { xs: 14, sm: 16 }, 
                                color: 'white',
                                mr: 0.5,
                                opacity: 0.9
                            }} />
                            <Typography 
                                variant="caption" 
                                sx={{ 
                                    fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                    color: 'white',
                                    fontWeight: 500
                                }}
                            >
                                {video.likes || video.metadata?.upvotes || video.metadata?.redditScore || 0}
                            </Typography>
                        </Box>
                    </Box>
                    
                        {/* Platform indicator */}
                        <Box sx={{ display: 'flex', alignItems: 'center' }}>
                        <RedditIcon sx={{ 
                            fontSize: 14, 
                            color: '#ff4500',
                            mr: 0.5,
                            opacity: 0.9
                        }} />
                        <Typography 
                            variant="caption" 
                            onClick={handleOpenRedditPost}
                            sx={{ 
                                fontSize: { xs: '0.7rem', sm: '0.75rem' },
                                color: 'white',
                                fontWeight: 500,
                                cursor: 'pointer',
                                textDecoration: 'none',
                            }}
                        >
                            Reddit
                        </Typography>
                    </Box>
                </ThumbnailOverlay>
            </CardActionArea>
            
            <CardContent sx={{ 
                p: 1,
                '&:last-child': { pb: 1 },
                // Mobile: keep compact content area visible
                '@media (max-width: 600px)': {
                    p: 1,
                    '&:last-child': { pb: 1 },
                }
            }}>
                <Typography 
                    variant="body2" 
                    sx={{ 
                        color: 'rgba(255, 255, 255, 0.7)',
                        fontSize: '0.875rem',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        lineHeight: 1.35,
                    }}
                >
                    {video.title}
                </Typography>
            </CardContent>
        </StyledCard>
    );
}

export default VideoCard;
