import React, { useEffect, useRef, useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    Typography,
    Box,
    Button,
    Chip,
    Stack,
    Fade
} from '@mui/material';
import { 
    Close as CloseIcon, 
    ThumbUp as ThumbUpIcon,
    PlayArrow as PlayIcon,
    Pause as PauseIcon,
    VolumeUp as VolumeIcon,
    VolumeOff as MuteIcon,
    Fullscreen as FullscreenIcon
} from '@mui/icons-material';
import { Video } from '../../types/Video';
import { updateVideoStats } from '../../services/api';

interface VideoModalProps {
    video: Video | null;
    open: boolean;
    onClose: () => void;
}

const VideoModal: React.FC<VideoModalProps> = ({ video, open, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        if (video && open) {
            updateVideoStats(video.id.toString(), 'view');
        }
    }, [video, open]);
    
    useEffect(() => {
        // Hide controls after 3 seconds of inactivity
        const hideControls = () => {
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
            setShowControls(true);
            controlsTimeoutRef.current = setTimeout(() => {
                if (isPlaying) {
                    setShowControls(false);
                }
            }, 3000);
        };
        
        hideControls();
        
        return () => {
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
        };
    }, [isPlaying]);
    
    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const currentTime = videoRef.current.currentTime;
            const duration = videoRef.current.duration || 0;
            setProgress((currentTime / duration) * 100);
            setCurrentTime(currentTime);
            setDuration(duration);
        }
    };
    
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const handleLike = async () => {
        if (video) {
            await updateVideoStats(video.id.toString(), 'like');
        }
    };
    
    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play().catch(err => console.error('Playback error:', err));
            }
            setIsPlaying(!isPlaying);
            setShowControls(true);
        }
    };
    
    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };
    
    const handleFullscreen = () => {
        if (videoRef.current) {
            if (videoRef.current.requestFullscreen) {
                videoRef.current.requestFullscreen();
            }
        }
    };
    
    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (videoRef.current && duration > 0) {
            const progressBar = e.currentTarget;
            const rect = progressBar.getBoundingClientRect();
            const clickPosition = (e.clientX - rect.left) / rect.width;
            const newTime = clickPosition * duration;
            videoRef.current.currentTime = newTime;
        }
    };

    const getVideoUrl = (url: string) => {
        // Handle Reddit videos
        if (url.includes('v.redd.it')) {
            // Handle DASH playlist URLs
            if (url.includes('DASHPlaylist.mpd')) {
                // For DASH playlists, we need to use the fallback direct MP4 URL
                // Extract the video ID
                const match = url.match(/v\.redd\.it\/([^/]+)\//i);
                if (match && match[1]) {
                    const videoId = match[1];
                    // Use the fallback URL format
                    return `https://v.redd.it/${videoId}/DASH_720.mp4`;
                }
            }
            // Handle direct DASH video URLs
            else if (url.includes('DASH_')) {
                // Replace quality suffix with desired quality
                return url.replace(/DASH_\d+\.mp4/, 'DASH_720.mp4');
            }
            // Handle HLS playlist URLs
            else if (url.includes('HLSPlaylist')) {
                // For HLS playlists, we need to use the fallback direct MP4 URL
                const match = url.match(/v\.redd\.it\/([^/]+)\//i);
                if (match && match[1]) {
                    const videoId = match[1];
                    // Use the fallback URL format
                    return `https://v.redd.it/${videoId}/DASH_720.mp4`;
                }
            }
        }
        return url;
    };

    if (!video) return null;

    return (
        <Dialog
            open={open}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
        >
            <DialogTitle>
                <Box display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        {video.title}
                    </Typography>
                    <IconButton onClick={onClose}>
                        <CloseIcon />
                    </IconButton>
                </Box>
            </DialogTitle>
            <DialogContent>
                <Box 
                    sx={{ 
                        position: 'relative', 
                        paddingTop: '56.25%', 
                        backgroundColor: '#000',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        boxShadow: '0 10px 30px rgba(0, 0, 0, 0.3)'
                    }}
                    onMouseMove={() => setShowControls(true)}
                    onClick={togglePlay}
                >
                    <video
                        ref={videoRef}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                        }}
                        src={getVideoUrl(video.videoUrl)}
                        playsInline
                        preload="auto"
                        autoPlay
                        muted
                        onTimeUpdate={handleTimeUpdate}
                        onPlay={() => setIsPlaying(true)}
                        onPause={() => setIsPlaying(false)}
                        onError={(e) => {
                            console.error('Video playback error:', e);
                            // If video fails to load, try with a different URL format
                            if (videoRef.current && video.videoUrl.includes('v.redd.it')) {
                                const videoId = video.videoUrl.match(/v\.redd\.it\/([^/?]+)/i)?.[1];
                                if (videoId) {
                                    console.log('Trying fallback URL for video ID:', videoId);
                                    videoRef.current.src = `https://v.redd.it/${videoId}/DASH_480.mp4`;
                                    videoRef.current.load();
                                    videoRef.current.play().catch(err => console.error('Playback error:', err));
                                }
                            }
                        }}
                    />
                    
                    {/* Custom video controls */}
                    <Fade in={showControls}>
                        <Box 
                            sx={{
                                position: 'absolute',
                                bottom: 0,
                                left: 0,
                                right: 0,
                                background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                                padding: '20px 16px 12px',
                                transition: 'opacity 0.3s ease'
                            }}
                        >
                            <Box 
                                sx={{ 
                                    width: '100%', 
                                    height: '4px', 
                                    backgroundColor: 'rgba(255,255,255,0.3)',
                                    borderRadius: '2px',
                                    cursor: 'pointer',
                                    mb: 1
                                }}
                                onClick={handleProgressClick}
                            >
                                <Box 
                                    sx={{ 
                                        width: `${progress}%`, 
                                        height: '100%', 
                                        backgroundColor: '#f50057',
                                        borderRadius: '2px',
                                        position: 'relative'
                                    }}
                                >
                                    <Box 
                                        sx={{ 
                                            position: 'absolute',
                                            right: '-6px',
                                            top: '-4px',
                                            width: '12px',
                                            height: '12px',
                                            borderRadius: '50%',
                                            backgroundColor: '#f50057'
                                        }}
                                    />
                                </Box>
                            </Box>
                            
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                    <IconButton 
                                        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                                        sx={{ color: 'white', padding: '8px' }}
                                    >
                                        {isPlaying ? <PauseIcon /> : <PlayIcon />}
                                    </IconButton>
                                    
                                    <IconButton 
                                        onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                                        sx={{ color: 'white', padding: '8px' }}
                                    >
                                        {isMuted ? <MuteIcon /> : <VolumeIcon />}
                                    </IconButton>
                                    
                                    <Typography variant="body2" sx={{ color: 'white', ml: 1 }}>
                                        {formatTime(currentTime)} / {formatTime(duration)}
                                    </Typography>
                                </Box>
                                
                                <IconButton 
                                    onClick={(e) => { e.stopPropagation(); handleFullscreen(); }}
                                    sx={{ color: 'white', padding: '8px' }}
                                >
                                    <FullscreenIcon />
                                </IconButton>
                            </Box>
                        </Box>
                    </Fade>
                </Box>
                <Box sx={{ mt: 2 }}>
                    <Typography variant="body1" gutterBottom>
                        {video.description}
                    </Typography>
                    <Box sx={{ mt: 2, mb: 1 }}>
                        <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                            <Chip label={`👁️ ${video.views} views`} variant="outlined" />
                            <Chip label={`❤️ ${video.likes} likes`} variant="outlined" />
                            <Chip label={`⬆️ ${video.metadata.redditScore} score`} variant="outlined" />
                            <Chip label={video.subreddit} color="primary" />
                        </Stack>
                        <Stack direction="row" spacing={1}>
                            {(Array.isArray(video.tags) ? video.tags : JSON.parse(video.tags as string)).map((tag: string, index: number) => (
                                <Chip key={index} label={tag} size="small" />
                            ))}
                        </Stack>
                    </Box>
                    <Button
                        variant="contained"
                        color="primary"
                        startIcon={<ThumbUpIcon />}
                        onClick={handleLike}
                        sx={{ mt: 2 }}
                    >
                        Like
                    </Button>
                </Box>
            </DialogContent>
        </Dialog>
    );
};

export default VideoModal;
