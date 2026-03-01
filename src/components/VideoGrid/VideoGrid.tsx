import React, { useEffect, useRef } from 'react';
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
    const desktopRailRef = useRef<HTMLDivElement | null>(null);
    const isDraggingRef = useRef(false);
    const dragStartXRef = useRef(0);
    const dragStartScrollLeftRef = useRef(0);

    // Cleanup observers when videos change
    useEffect(() => {
        return () => {
            if (videoFocusObserver?.current) {
                videoFocusObserver.current.disconnect();
            }
        };
    }, [videos, videoFocusObserver]);

    // Desktop only: convert mouse wheel vertical gesture into horizontal rail scroll.
    useEffect(() => {
        if (!isLargeDevice || !desktopRailRef.current) return;

        const rail = desktopRailRef.current;
        const onWheel = (event: WheelEvent) => {
            if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
            event.preventDefault();
            rail.scrollLeft += event.deltaY;
        };

        rail.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            rail.removeEventListener('wheel', onWheel as EventListener);
        };
    }, [isLargeDevice, videos.length]);

    useEffect(() => {
        if (!isLargeDevice || !desktopRailRef.current) return;
        const rail = desktopRailRef.current;

        const onMouseDown = (event: MouseEvent) => {
            if (event.button !== 0) return;
            isDraggingRef.current = true;
            dragStartXRef.current = event.clientX;
            dragStartScrollLeftRef.current = rail.scrollLeft;
            rail.style.cursor = 'grabbing';
        };

        const onMouseMove = (event: MouseEvent) => {
            if (!isDraggingRef.current) return;
            const deltaX = event.clientX - dragStartXRef.current;
            rail.scrollLeft = dragStartScrollLeftRef.current - deltaX;
        };

        const stopDragging = () => {
            isDraggingRef.current = false;
            rail.style.cursor = 'grab';
        };

        rail.addEventListener('mousedown', onMouseDown);
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', stopDragging);
        rail.addEventListener('mouseleave', stopDragging);

        return () => {
            rail.removeEventListener('mousedown', onMouseDown);
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', stopDragging);
            rail.removeEventListener('mouseleave', stopDragging);
        };
    }, [isLargeDevice, videos.length]);

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
    
    // Desktop: horizontal scroll with 2 rows.
    if (isLargeDevice) {
        return (
            <Box
                ref={desktopRailRef}
                sx={{
                    width: '100%',
                    maxWidth: '100%',
                    height: '100%',
                    overflowX: 'auto',
                    overflowY: 'hidden',
                    px: 1.5,
                    py: 1,
                    scrollBehavior: 'smooth',
                    cursor: 'grab',
                    userSelect: 'none',
                    '&::-webkit-scrollbar': {
                        height: '10px',
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
                        gridAutoFlow: 'column',
                        gridTemplateRows: 'repeat(2, minmax(0, 1fr))',
                        gridAutoColumns: '320px',
                        gap: 1.5,
                        height: '100%',
                        width: 'max-content',
                        alignContent: 'stretch',
                        alignItems: 'stretch',
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
                            sx={{ minWidth: 0, width: '100%', height: '100%', display: 'flex' }}
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
                py: 0,
                px: { xs: 0, sm: 1 },
                height: '100vh',
                overflowY: 'auto',
                scrollSnapType: 'y mandatory',
                scrollBehavior: 'smooth',
            }}
        >
            <Grid 
                container 
                spacing={{ xs: 0, sm: 1.5 }}
                justifyContent="center"
            >
                {videos.map((video, index) => (
                    <Grid 
                        item 
                        xs={12} 
                        sm={3.5} 
                        key={video.id}
                        ref={(node) => {
                            if (index === videos.length - 1) {
                                lastVideoRef?.(node);
                            }
                            if (videoFocusObserver?.current && node) {
                                node.setAttribute('data-video-id', video.id.toString());
                                videoFocusObserver.current.observe(node);
                            }
                        }}
                        sx={{
                            px: { xs: 0, sm: 1 },
                            pb: { xs: 0, sm: 1 },
                            scrollSnapAlign: 'start',
                            height: '100vh',
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
