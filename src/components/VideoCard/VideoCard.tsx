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
    borderRadius: '8px',
    overflow: 'hidden',
    transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
    '&:hover': {
        transform: 'translateY(-4px)',
        boxShadow: '0 6px 12px rgba(0, 0, 0, 0.3)'
    },
    [theme.breakpoints.down('sm')]: {
        borderRadius: '6px',
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

const VideoCard: React.FC<VideoCardProps> = ({ video, onClick }) => {
    const [imageLoading, setImageLoading] = useState(true);
    const [thumbnailUrl, setThumbnailUrl] = useState<string>(video.thumbnailUrl);
    const [retryCount, setRetryCount] = useState(0);
    const maxRetries = 3;
    const imageRef = useRef<HTMLImageElement>(null);
    // Initialize with null to fix the TypeScript error
    const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const tryNextThumbnail = useCallback((urls: string[], index: number) => {
        if (index >= urls.length) {
            // If all alternatives fail, just set loading to false
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
        img.src = urls[index];
    }, []);

    
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
            // and keep displaying the skeleton loader
            setImageLoading(false);
        }
    };

    return (
        <StyledCard title={video.id + ""}>
            <CardActionArea onClick={onClick} sx={{ position: 'relative' }}>
                {imageLoading && (
                    <Skeleton 
                        variant="rectangular" 
                        height={180}
                        animation="wave"
                        sx={{ 
                            bgcolor: 'grey.800',
                            '@media (max-width: 600px)': {
                                height: '160px'
                            }
                        }}
                    />
                )}
                {imageLoading && (
                    <Box 
                        sx={{ 
                            position: 'relative',
                            paddingTop: '56.25%', // 16:9 aspect ratio
                            overflow: 'hidden',
                            backgroundColor: 'rgba(18, 18, 18, 0.8)',
                        }}
                    >
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
                    </Box>
                )}
                <Box sx={{
                    position: 'relative',
                    paddingTop: '56.25%', // 16:9 aspect ratio
                    overflow: 'hidden',
                    '@media (min-width: 960px)': {
                        paddingTop: '62%' // Slightly taller on desktop for better visibility
                    },
                }}>
                    <CardMedia
                        component="img"
                        image={thumbnailUrl}
                        alt={video.title}
                        ref={imageRef}
                        sx={{
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
                    />
                </Box>
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
                
                <ThumbnailOverlay>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
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
                                {video.likes || 0}
                            </Typography>
                        </Box>
                    </Box>
                    
                    {video.nsfw ? (
                        <Box sx={{
                            border: '1px solid red',
                            borderRadius: '4px',
                            padding: '2px 6px',
                        }}>
                            <Typography 
                                variant="caption" 
                                sx={{
                                    fontSize: { xs: '0.65rem', sm: '0.7rem' },
                                    color: 'tomato',
                                    fontWeight: 'bold',
                                    lineHeight: 1
                                }}
                            >
                                NSFW
                            </Typography>
                        </Box>
                    ) : null}
                </ThumbnailOverlay>
            </CardActionArea>
            
            <CardContent sx={{ 
                pt: 0.75, 
                pb: 0.25, 
                px: { xs: 0.75, sm: 1 },
                backgroundColor: 'rgba(18, 18, 18, 0.8)',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                transition: 'background-color 0.2s ease',
                '&:hover': {
                    backgroundColor: 'rgba(25, 25, 25, 0.9)'
                },
                minHeight: 'unset',
                '&:last-child': { pb: 1 } 
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
};

export default VideoCard;
