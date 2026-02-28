import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, Typography, CardActionArea, Box, Skeleton, styled } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import MovieIcon from '@mui/icons-material/Movie';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { Video } from '../../types/Video';

interface VideoCardProps {
    video: Video;
    onClick: () => void;
    isFocused?: boolean;
    isPlaying?: boolean;
    isLargeDevice?: boolean;
    onHoverStart?: () => void;
    onHoverEnd?: () => void;
}

// Simple styled components for VideoCard
const StyledCard = styled(Card)(({ theme }) => ({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'rgba(18, 18, 18, 0.6)',
    borderRadius: '8px',
    overflow: 'hidden',
    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
    '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: '0 6px 12px rgba(0, 0, 0, 0.3)'
    },
    // Mobile TikTok-like styling
    [theme.breakpoints.down('sm')]: {
        borderRadius: 0,
        height: 'auto',
        minHeight: '100vh', // Full viewport height minus header
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

const ThumbnailOverlay = styled(Box)(({ theme }) => ({
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.spacing(0.75, 1),
    background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, rgba(0,0,0,0) 100%)',
    [theme.breakpoints.down('sm')]: {
        padding: theme.spacing(0.5, 0.75),
    },
}));

const VideoCard: React.FC<VideoCardProps> = ({ video, onClick, isFocused = false, isPlaying = false, isLargeDevice = false, onHoverStart, onHoverEnd }) => {
    const [imageLoading, setImageLoading] = useState(true);
    const [thumbnailUrl, setThumbnailUrl] = useState<string>(video.thumbnailUrl || '');
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 3;
    const imageRef = useRef<HTMLImageElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    
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
                
                // Remove control characters (ES5 compatible)
                shortened = shortened.replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
                
                // Remove non-ASCII characters (ES5 compatible approach)
                sanitizedTitle = shortened.replace(/[^\x00-\x7F]/g, '');
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
    }, []);
    
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
                    const apiBaseUrl = process.env.REACT_APP_API_BASE_URL || '';
                    
                    // Only use thumbnails from our own server
                    if (video.thumbnailUrl && video.thumbnailUrl.startsWith('/thumbnails/')) {
                        // Make sure the thumbnail path has the .jpg extension
                        const thumbnailPath = video.thumbnailUrl.endsWith('.jpg') 
                            ? video.thumbnailUrl 
                            : `${video.thumbnailUrl}.jpg`;
                        
                        // Direct path to the thumbnail in the public directory
                        // The server is configured to serve files from the public directory directly
                        const thumbnailUrl = `${thumbnailPath}`;
                        
                        const img = new Image();
                        img.onload = () => {
                            setThumbnailUrl(thumbnailUrl);
                            setImageLoading(false);
                        };
                        img.onerror = (e) => {
                            // Try one more time with apiBaseUrl prefix
                            const fallbackUrl = `${apiBaseUrl}${thumbnailPath}`;
                            
                            const fallbackImg = new Image();
                            fallbackImg.onload = () => {
                                setThumbnailUrl(fallbackUrl);
                                setImageLoading(false);
                            };
                            fallbackImg.onerror = () => {
                                // Create fallback with title as last resort
                                console.error(`Both thumbnail URLs failed to load for: ${video.title}`);
                                const svgFallback = createFallbackThumbnail(video.title);
                                setThumbnailUrl(svgFallback);
                                setImageLoading(false);
                            };
                            fallbackImg.crossOrigin = 'anonymous';
                            fallbackImg.src = fallbackUrl;
                        };
                        img.crossOrigin = 'anonymous';
                        img.src = thumbnailUrl;
                    } else {
                        // If no local thumbnail is available, use SVG fallback
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
    }, [video.thumbnailUrl, video.title, video.redditId, video.metadata, tryNextThumbnail, createFallbackThumbnail]);
    
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

    return (
        <StyledCard ref={cardRef} title={video.id + ""}>
            <CardActionArea
                onClick={onClick}
                onMouseEnter={() => {
                    if (isLargeDevice) onHoverStart?.();
                }}
                onMouseLeave={() => {
                    if (isLargeDevice) onHoverEnd?.();
                }}
                sx={{ position: 'relative' }}
            >
                {/* Single container for both skeleton and image to ensure consistent sizing */}
                <Box sx={{
                    position: 'relative',
                    paddingTop: { xs: '177.78%', sm: '177.78%' }, // 9:16 aspect ratio like YouTube Shorts
                    overflow: 'hidden',
                    // Mobile: full height
                    '@media (max-width: 600px)': {
                        paddingTop: '100vh',
                        height: '100vh',
                    },
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
                            src={video.videoUrl}
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
                                filter: video.nsfw ? 'blur(10px)' : 'none',
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
                                filter: video.nsfw ? 'blur(10px)' : 'none',
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
                        <ArrowUpwardIcon sx={{ 
                            fontSize: { xs: 14, sm: 16 }, 
                            color: 'white',
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
                                textDecoration: 'underline',
                                textUnderlineOffset: '2px'
                            }}
                        >
                            r/{video.subreddit}
                        </Typography>
                    </Box>
                </ThumbnailOverlay>
            </CardActionArea>
            
            <CardContent sx={{ 
                p: 1, 
                '&:last-child': { pb: 1 },
                // Mobile: minimal content area
                '@media (max-width: 600px)': {
                    p: 0,
                    '&:last-child': { pb: 0 },
                    display: 'none', // Hide content area on mobile for TikTok-like experience
                }
            }}>
                <Typography 
                    variant="body2" 
                    component="div" 
                    sx={{ 
                        fontSize: { xs: '0.7rem', sm: '0.8rem' }, 
                        fontWeight: 500,
                        lineHeight: 1.2,
                        m: 0,
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        height: { xs: '1.2em', sm: '1.2em' },
                        color: 'white'
                    }}
                >
                    {video.title}
                </Typography>
                {/* Content area now only shows title since stats are on thumbnail overlay */}
            </CardContent>
        </StyledCard>
    );
}

export default VideoCard;
