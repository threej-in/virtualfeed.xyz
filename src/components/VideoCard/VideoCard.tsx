import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardContent, CardMedia, Typography, CardActionArea, Box, Stack, Chip, Skeleton, styled } from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import MovieIcon from '@mui/icons-material/Movie';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import { Video } from '../../types/Video';

interface VideoCardProps {
    video: Video;
    onClick: () => void;
}

// Simple styled components for VideoCard
const StyledCard = styled(Card)(({ theme }) => ({
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'rgba(18, 18, 18, 0.6)',
    borderRadius: '4px',
    overflow: 'hidden',
}));

const PlayOverlay = styled(Box)(({ theme }) => ({
    position: 'absolute',
    top: '-1rem',
    left: 0,
    right: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0,
    transition: 'opacity 0.2s ease',
    '&:hover': {
        opacity: 1,
    },
}));

const VideoCard: React.FC<VideoCardProps> = ({ video, onClick }) => {
    const [imageLoading, setImageLoading] = useState(true);
    const [thumbnailUrl, setThumbnailUrl] = useState<string>(video.thumbnailUrl);
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 3;
    const imageRef = useRef<HTMLImageElement>(null);
    // Initialize with null to fix the TypeScript error
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Ensure tags is always an array
    const tags = Array.isArray(video.tags) ? video.tags : 
                typeof video.tags === 'string' ? JSON.parse(video.tags as string) : 
                [];
    
    const createFallbackThumbnail = useCallback(() => {
        // Create a custom thumbnail with the video title
        const title = video.title.substring(0, 30) + (video.title.length > 30 ? '...' : '');
        // Create a data URL for an SVG with the title text instead of using placeholder.com
        const svgContent = `
            <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
                <rect width="100%" height="100%" fill="#121212"/>
                <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="24" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')}</text>
            </svg>
        `;
        const fallbackUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgContent.trim())}`;
        setThumbnailUrl(fallbackUrl);
        setImageLoading(false);
    }, [video.title]);
    
    const tryNextThumbnail = useCallback((urls: string[], index: number) => {
        if (index >= urls.length) {
            // If all alternatives fail, create a custom thumbnail
            createFallbackThumbnail();
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
        img.src = urls[index];
    }, [createFallbackThumbnail]);
    
    const tryAlternativeThumbnails = useCallback(() => {
        // Extract the video ID from the URL
        let videoId = '';
        if (video.videoUrl.includes('/DASH_')) {
            const match = video.videoUrl.match(/v\.redd\.it\/([^/]+)\//i);
            if (match && match[1]) videoId = match[1];
        } else {
            const match = video.videoUrl.match(/v\.redd\.it\/([^/?]+)/i);
            if (match && match[1]) videoId = match[1];
        }
        
        if (videoId) {
            // Try alternative thumbnail formats
            const alternativeUrls = [
                `https://preview.redd.it/${videoId}.jpg`,
                `https://external-preview.redd.it/${videoId}.jpg`,
                `https://i.redd.it/${videoId}.png`,
                `https://preview.redd.it/${videoId}.png`
            ];
            
            // Try each URL in sequence
            tryNextThumbnail(alternativeUrls, 0);
        } else {
            // If we can't extract ID, use a custom placeholder
            createFallbackThumbnail();
        }
    }, [video.videoUrl, tryNextThumbnail, createFallbackThumbnail]);
    
    // Clean up any effects when component unmounts
    useEffect(() => {
        return () => {
            // Clear any pending retry timeouts
            if (retryTimeoutRef.current !== null) {
                clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }
        };
    }, []);

    // Handle thumbnail URLs, which could be a single URL or a JSON string with multiple URLs
    useEffect(() => {
        // Check if the thumbnailUrl is a path to a local thumbnail
        if (video.thumbnailUrl.startsWith('/thumbnails/')) {
            // For locally generated thumbnails, construct the full URL
            const apiBaseUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000';
            const fullThumbnailUrl = `${apiBaseUrl}${video.thumbnailUrl}`;
            
            // Preload the image to check if it exists
            const img = new Image();
            img.onload = () => {
                setThumbnailUrl(fullThumbnailUrl);
                setImageLoading(false);
            };
            img.onerror = () => {
                // If local thumbnail fails, fall back to placeholder
                createFallbackThumbnail();
            };
            img.src = fullThumbnailUrl;
            return;
        }
        
        // Check if the thumbnailUrl is a JSON array of URLs
        try {
            if (video.thumbnailUrl.startsWith('[') && video.thumbnailUrl.endsWith(']')) {
                const thumbnailUrls = JSON.parse(video.thumbnailUrl) as string[];
                if (Array.isArray(thumbnailUrls) && thumbnailUrls.length > 0) {
                    // Try each URL in sequence
                    tryNextThumbnail(thumbnailUrls, 0);
                    return;
                }
            }
        } catch (error) {
            console.error('Error parsing thumbnail URLs:', error);
        }
        
        // If not a JSON array or parsing failed, handle as a single URL
        if (video.videoUrl.includes('v.redd.it')) {
            // Preload the image to check if it exists
            const img = new Image();
            img.onload = () => {
                setThumbnailUrl(video.thumbnailUrl);
                setImageLoading(false);
            };
            img.onerror = () => {
                // Try alternative thumbnail formats
                tryAlternativeThumbnails();
            };
            img.src = video.thumbnailUrl;
        } else {
            // For non-Reddit videos, still check if the thumbnail loads
            const img = new Image();
            img.onload = () => {
                setImageLoading(false);
            };
            img.onerror = () => {
                createFallbackThumbnail();
            };
            img.src = video.thumbnailUrl;
        }
    }, [video.thumbnailUrl, video.videoUrl, tryAlternativeThumbnails, tryNextThumbnail, createFallbackThumbnail]);

    const handleImageLoad = () => {
        setImageLoading(false);
    };

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
            // If we've reached max retries, use fallback
            setImageLoading(false);
            createFallbackThumbnail();
        }
    };

    return (
        <StyledCard>
            <CardActionArea onClick={onClick} sx={{ position: 'relative' }}>
                {imageLoading && (
                    <Skeleton 
                        variant="rectangular" 
                        height={180}
                        animation="wave"
                        sx={{ bgcolor: 'grey.800' }}
                    />
                )}
                {imageLoading && (
                    <Box 
                        sx={{ 
                            height: 180, 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center',
                            backgroundColor: 'rgba(18, 18, 18, 0.8)'
                        }}
                    >
                        <MovieIcon sx={{ fontSize: 40, opacity: 0.7 }} />
                    </Box>
                )}
                <CardMedia
                    component="img"
                    height="260"
                    image={thumbnailUrl}
                    alt={video.title}
                    onLoad={handleImageLoad}
                    onError={handleImageError}
                    ref={imageRef}
                    loading="lazy"
                    sx={{ 
                        display: imageLoading ? 'none' : 'block',
                        objectFit: 'cover',
                        filter: video.nsfw ? 'blur(10px)' : 'none',
                        transition: 'filter 0.3s ease'
                    }}
                />
                <PlayOverlay>
                    <PlayArrowIcon sx={{ fontSize: 40, color: 'white', opacity: 0.9 }} />
                </PlayOverlay>
                <CardContent sx={{ pt: 1, pb: 0.5, px: 1 }}>
                    <Typography 
                        variant="body1" 
                        component="div" 
                        noWrap
                        sx={{ 
                            fontSize: '0.85rem', 
                            fontWeight: 500,
                            lineHeight: 1.2
                        }}
                    >
                        {video.title}
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', mt: 0.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                            <VisibilityIcon sx={{ mr: 0.5, fontSize: 12, opacity: 0.7 }} />
                            <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>{video.views || 0}</Typography>
                        </Box>
                        <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                            <ThumbUpIcon sx={{ mr: 0.5, fontSize: 12, opacity: 0.7 }} />
                            <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>{video.likes || 0}</Typography>
                        </Box>
                        {video.nsfw ? (
                            <Typography 
                                variant="caption" 
                                sx={{ 
                                    fontSize: '0.65rem', 
                                    ml: 1, 
                                    color: '#ff6584',
                                    fontWeight: 'bold'
                                }}
                            >
                                NSFW
                            </Typography>
                        ) : null}
                    </Box>
                </CardContent>
            </CardActionArea>
        </StyledCard>
    );
};

export default VideoCard;
