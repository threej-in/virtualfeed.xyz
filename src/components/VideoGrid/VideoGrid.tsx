import React, { useEffect } from 'react';
import { Grid, Box, Typography, Button } from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';
import VideoCard from '../VideoCard/VideoCard';
import YouTubeVideoCard from '../VideoCard/YouTubeVideoCard';
import { Video } from '../../types/Video';

interface VideoGridProps {
    videos: Video[];
    onVideoClick: (video: Video) => void;
    lastVideoRef?: (node: HTMLDivElement | null) => void;
    onResetFilters?: () => void;
    playingVideoId?: number | null;
    focusedVideoId?: number | null;
    videoFocusObserver?: React.RefObject<IntersectionObserver | null>;
    isLargeDevice?: boolean;
    onDesktopVideoHoverStart?: (videoId: number) => void;
    onDesktopVideoHoverEnd?: (videoId: number) => void;
}

const VideoGrid: React.FC<VideoGridProps> = ({ videos, onVideoClick, lastVideoRef, onResetFilters, playingVideoId, focusedVideoId, videoFocusObserver, isLargeDevice, onDesktopVideoHoverStart, onDesktopVideoHoverEnd }) => {
    // Cleanup observers when videos change
    useEffect(() => {
        const observer = videoFocusObserver?.current;
        return () => {
            if (observer) {
                observer.disconnect();
            }
        };
    }, [videos, videoFocusObserver]);

    // Show empty state when there are no videos
    if (!videos || videos.length === 0) {
        return (
            <Box 
                sx={{ 
                    display: 'flex', 
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: '50vh',
                    textAlign: 'center',
                    p: 3
                }}
            >
                <Typography variant="h5" sx={{ 
                    mb: 2, 
                    color: 'text.primary',
                    fontSize: { xs: '1.25rem', sm: '1.5rem' } 
                }}>
                    No videos found for the current filters
                </Typography>
                <Typography variant="body1" sx={{ 
                    mb: 3, 
                    color: 'text.secondary',
                    fontSize: { xs: '0.875rem', sm: '1rem' },
                    px: { xs: 1, sm: 2 }
                }}>
                    Try adjusting your search or filter settings
                </Typography>
                <Button 
                    variant="contained" 
                    color="primary" 
                    startIcon={<HomeIcon />}
                    onClick={() => {
                        // If onResetFilters is provided, use it
                        if (onResetFilters) {
                            onResetFilters();
                        } else {
                            // Fallback - reload the page as last resort
                            window.location.href = '/';
                        }
                    }}
                    sx={{ 
                        borderRadius: '20px',
                        px: 3,
                        py: 1,
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        background: 'linear-gradient(45deg, #6c63ff, #ff6584)',
                        '&:hover': {
                            background: 'linear-gradient(45deg, #5a52d5, #e55a75)',
                            transform: 'scale(1.05)',
                        },
                        transition: 'all 0.2s ease-in-out',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.25)'
                    }}
                >
                    Back to All Videos
                </Button>
            </Box>
        );
    }
    
    // Desktop: YouTube-like vertical feed grid.
    if (isLargeDevice) {
        return (
            <Box
                sx={{
                    width: '100%',
                    maxWidth: '100%',
                    height: '100%',
                    overflowX: 'hidden',
                    overflowY: 'auto',
                    px: 1.5,
                    py: 1,
                    scrollBehavior: 'smooth',
                    '&::-webkit-scrollbar': {
                        width: '10px',
                    },
                    '&::-webkit-scrollbar-thumb': {
                        backgroundColor: 'rgba(255,255,255,0.22)',
                        borderRadius: '999px',
                    },
                }}
            >
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: 2,
                        alignContent: 'start',
                        alignItems: 'start',
                    }}
                >
                    {videos.map((video, index) => (
                        <Box
                            key={video.id}
                            ref={(node) => {
                                if (index === videos.length - 1) {
                                    lastVideoRef?.(node as HTMLDivElement | null);
                                }
                            }}
                            sx={{ minWidth: 0, width: '100%', display: 'flex' }}
                        >
                            {video.platform === 'youtube' ? (
                                <YouTubeVideoCard
                                    video={video}
                                    onVideoClick={onVideoClick}
                                    isPlaying={playingVideoId === video.id}
                                    isFocused={focusedVideoId === video.id}
                                    isLargeDevice={true}
                                    onHoverStart={() => onDesktopVideoHoverStart?.(video.id)}
                                    onHoverEnd={() => onDesktopVideoHoverEnd?.(video.id)}
                                />
                            ) : (
                                <VideoCard
                                    video={video}
                                    onClick={() => onVideoClick(video)}
                                    isFocused={focusedVideoId === video.id}
                                    isPlaying={playingVideoId === video.id}
                                    isLargeDevice={true}
                                    onHoverStart={() => onDesktopVideoHoverStart?.(video.id)}
                                    onHoverEnd={() => onDesktopVideoHoverEnd?.(video.id)}
                                />
                            )}
                        </Box>
                    ))}
                </Box>
            </Box>
        );
    }

    // Mobile: keep vertical TikTok-like feed.
    return (
        <Box 
            sx={{ 
                width: '100%',
                maxWidth: { xs: '100%', sm: '1100px' },
                margin: '0 auto',
                py: { xs: 0.5, sm: 1 },
                px: { xs: 0.5, sm: 1 },
                height: '100%',
                overflowY: 'auto',
                scrollBehavior: 'smooth',
            }}
        >
            <Grid 
                container 
                spacing={{ xs: 1, sm: 1.5 }}
                justifyContent="center"
            >
                {videos.map((video, index) => (
                    <Grid 
                        item 
                        xs={6} 
                        sm={6} 
                        key={video.id}
                        ref={(node) => {
                            if (index === videos.length - 1) {
                                lastVideoRef?.(node);
                            }
                        }}
                        sx={{
                            px: { xs: 0.5, sm: 1 },
                            pb: { xs: 0.5, sm: 1 },
                        }}
                    >
                        {video.platform === 'youtube' ? (
                            <YouTubeVideoCard 
                                video={video} 
                                onVideoClick={onVideoClick}
                                isPlaying={playingVideoId === video.id}
                                isFocused={focusedVideoId === video.id}
                                isLargeDevice={false}
                                onHoverStart={() => onDesktopVideoHoverStart?.(video.id)}
                                onHoverEnd={() => onDesktopVideoHoverEnd?.(video.id)}
                            />
                        ) : (
                            <VideoCard 
                                video={video} 
                                onClick={() => onVideoClick(video)} 
                                isFocused={focusedVideoId === video.id} 
                                isPlaying={playingVideoId === video.id}
                                isLargeDevice={false}
                                onHoverStart={() => onDesktopVideoHoverStart?.(video.id)}
                                onHoverEnd={() => onDesktopVideoHoverEnd?.(video.id)}
                            />
                        )}
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
};

export default VideoGrid;
