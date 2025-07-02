import React from 'react';
import { Grid } from '@mui/material';
import VideoCard from '../VideoCard/VideoCard';
import { Video } from '../../types/Video';

interface VideoGridProps {
    videos: Video[];
    onVideoClick: (video: Video) => void;
    lastVideoRef?: (node: HTMLDivElement | null) => void;
}

const VideoGrid: React.FC<VideoGridProps> = ({ videos, onVideoClick, lastVideoRef }) => {
    return (
        <Grid 
            container 
            spacing={1.5} 
            sx={{ 
                py: 1,
                maxWidth: '1100px',
                mx: 'auto'
            }}
        >
            {videos.map((video, index) => (
                <Grid 
                    item 
                    xs={6} 
                    sm={4} 
                    md={3} 
                    lg={2.4}
                    key={video.id}
                    // Apply ref to the last video item for infinite scrolling
                    ref={index === videos.length - 1 ? lastVideoRef : undefined}
                >
                    <VideoCard video={video} onClick={() => onVideoClick(video)} />
                </Grid>
            ))}
        </Grid>
    );
};

export default VideoGrid;
