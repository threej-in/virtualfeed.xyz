import React from 'react';
import { Grid, Box, Typography, Button } from '@mui/material';
import { Home as HomeIcon } from '@mui/icons-material';
import VideoCard from '../VideoCard/VideoCard';
import { Video } from '../../types/Video';

interface VideoGridProps {
    videos: Video[];
    onVideoClick: (video: Video) => void;
    lastVideoRef?: (node: HTMLDivElement | null) => void;
    onResetFilters?: () => void;
}

const VideoGrid: React.FC<VideoGridProps> = ({ videos, onVideoClick, lastVideoRef, onResetFilters }) => {
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
    
    return (
        <Box 
            sx={{ 
                width: '100%',
                maxWidth: '1100px',
                margin: '0 auto',
                py: { xs: 0.5, sm: 1 },
                px: { xs: 0.5, sm: 1 },
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
                    sm={4} 
                    md={3} 
                    lg={3}
                    key={video.id}
                    // Apply ref to the last video item for infinite scrolling
                    ref={index === videos.length - 1 ? lastVideoRef : undefined}
                >
                    <VideoCard video={video} onClick={() => onVideoClick(video)} />
                </Grid>
            ))}
            </Grid>
        </Box>
    );
};

export default VideoGrid;
