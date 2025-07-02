import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    Dialog,
    IconButton,
    Typography,
    Box,
    Button,
    Chip,
    Stack,
    Fade,
    useMediaQuery,
    useTheme
} from '@mui/material';
import { 
    Close as CloseIcon, 
    ThumbUp as ThumbUpIcon,
    PlayArrow as PlayIcon,
    Pause as PauseIcon,
    VolumeUp as VolumeIcon,
    VolumeOff as MuteIcon,
    Fullscreen as FullscreenIcon,
    KeyboardArrowLeft as ArrowLeftIcon,
    KeyboardArrowRight as ArrowRightIcon,
    Share as ShareIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    Favorite as FavoriteIcon,
    ArrowUpward as ArrowUpwardIcon,
    Link as LinkIcon,
    Loop as LoopIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { Video } from '../../types/Video';
import { updateVideoStats } from '../../services/api';

interface VideoPlayerProps {
    videos: Video[];
    initialVideoIndex: number;
    open: boolean;
    onClose: () => void;
    onTagClick?: (tag: string) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videos, initialVideoIndex, open, onClose, onTagClick }) => {
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
    
    const [currentIndex, setCurrentIndex] = useState(initialVideoIndex);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [isLooping, setIsLooping] = useState(true);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const [showDetails, setShowDetails] = useState(false);
    const [videoQuality, setVideoQuality] = useState<string>('auto');
    const [isBuffering, setIsBuffering] = useState(false);
    const [networkSpeed, setNetworkSpeed] = useState<number | null>(null);
    const [showNsfw, setShowNsfw] = useState(false);
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const loadStartTimeRef = useRef<number>(0);
    const nextVideoRef = useRef<HTMLVideoElement | null>(null);
    
    // Update currentIndex when initialVideoIndex changes
    useEffect(() => {
        if (initialVideoIndex >= 0 && initialVideoIndex < videos.length) {
            setCurrentIndex(initialVideoIndex);
            console.log('Video player updated to index:', initialVideoIndex);
        }
    }, [initialVideoIndex, videos]);
    
    const currentVideo = videos[currentIndex];

    useEffect(() => {
        if (open && currentVideo) {
            updateVideoStats(currentVideo.id.toString(), 'view');
        }
    }, [currentVideo, open]);
    
    // Measure network speed when loading video
    const measureNetworkSpeed = useCallback(() => {
        if (videoRef.current) {
            const loadEndTime = performance.now();
            const loadStartTime = loadStartTimeRef.current;
            const loadTimeMs = loadEndTime - loadStartTime;
            
            if (loadTimeMs > 0 && videoRef.current.videoWidth > 0) {
                // Estimate video size based on resolution and duration
                // This is a rough estimate - 0.1 MB per second for SD, scaled by resolution
                const videoDuration = videoRef.current.duration || 30; // Default to 30s if unknown
                const videoHeight = videoRef.current.videoHeight || 480;
                const estimatedSizeMB = (videoDuration * 0.1) * (videoHeight / 480);
                
                // Calculate speed in Mbps (megabits per second)
                const speedMbps = (estimatedSizeMB * 8) / (loadTimeMs / 1000);
                console.log(`Estimated network speed: ${speedMbps.toFixed(2)} Mbps`);
                setNetworkSpeed(speedMbps);
            }
        }
    }, []);

        // Get appropriate video quality based on network conditions
    const getVideoQuality = useCallback((videoId: string): string => {
        // If user has manually selected a quality, use that
        if (videoQuality !== 'auto') {
            return videoQuality;
        }
        
        // Auto quality selection based on network speed
        if (networkSpeed !== null) {
            // Network speed is in Mbps
            if (networkSpeed < 1.5) {
                return '240';
            } else if (networkSpeed < 3) {
                return '360';
            } else if (networkSpeed < 5) {
                return '480';
            } else if (networkSpeed < 8) {
                return '720';
            } else {
                return '1080';
            }
        }
        
        // Default to 480p if we don't have network info yet
        // This is a good balance between quality and initial load time
        return '480';
    }, [networkSpeed, videoQuality]);

    // Get video URL for Reddit videos with multiple formats
    const getVideoUrl = useCallback((url: string) => {
        if (url) {
            // Handle Reddit video URLs
            if (url.includes('v.redd.it')) {
                // Extract the video ID
                let videoId = '';
                if (url.includes('/DASH_')) {
                    const match = url.match(/v\.redd\.it\/([^/]+)\//i);
                    if (match && match[1]) videoId = match[1];
                } else {
                    const match = url.match(/v\.redd\.it\/([^/?]+)/i);
                    if (match && match[1]) videoId = match[1];
                }
                
                if (videoId) {
                    // For Reddit videos, we need to handle audio separately
                    // Reddit stores audio and video separately
                    const quality = getVideoQuality(videoId);
                    return `https://v.redd.it/${videoId}/DASH_${quality}.mp4`;
                }
            }
        }
        return url;
    }, [getVideoQuality]);
    

        // Preload the next video to improve playback experience
    const preloadNextVideo = useCallback(() => {
        // Check if there's a next video to preload
        if (currentIndex < videos.length - 1) {
            const nextVideo = videos[currentIndex + 1];
            if (nextVideo && nextVideo.videoUrl) {
                // Create a video element for preloading
                if (!nextVideoRef.current) {
                    nextVideoRef.current = document.createElement('video');
                }
                
                // Set preload attribute and src
                nextVideoRef.current.preload = 'metadata';
                nextVideoRef.current.src = getVideoUrl(nextVideo.videoUrl);
                
                console.log('Preloading next video:', nextVideo.title);
            }
        }
    }, [currentIndex, videos, getVideoUrl]);
    

    useEffect(() => {
        // Reset state when changing videos
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
        setIsBuffering(true);
        
        // Record start time for network speed measurement
        loadStartTimeRef.current = performance.now();
        
        // Auto-play the video immediately
        const timer = setTimeout(() => {
            if (videoRef.current) {
                videoRef.current.muted = true; // Temporarily mute to ensure autoplay works
                
                // Add buffer management
                videoRef.current.onwaiting = () => {
                    console.log('Video is buffering...');
                    setIsBuffering(true);
                };
                
                videoRef.current.oncanplay = () => {
                    console.log('Video can play now');
                    setIsBuffering(false);
                    measureNetworkSpeed();
                    
                    // Preload next video after current one is ready
                    preloadNextVideo();
                };
                
                // Use a variable to track if we're currently attempting to play
                const playPromise = videoRef.current.play();
                
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        setIsPlaying(true);
                        setIsBuffering(false);
                        
                        // Unmute after playback starts if it wasn't muted before
                        if (!isMuted) {
                            videoRef.current!.muted = false;
                        }
                    }).catch(err => {
                        console.error('Error playing video:', err);
                        setIsBuffering(false);
                    });
                }
            }
        }, 300); // Increased delay to ensure DOM is ready
        
        return () => clearTimeout(timer);
    }, [currentIndex, isMuted, measureNetworkSpeed, preloadNextVideo]);

    useEffect(() => {
        // Hide controls after 3 seconds of inactivity
        const hideControls = () => {
            if (isPlaying) {
                setShowControls(false);
            }
        };

        if (showControls && isPlaying) {
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
            controlsTimeoutRef.current = setTimeout(hideControls, 3000);
        }

        return () => {
            if (controlsTimeoutRef.current) {
                clearTimeout(controlsTimeoutRef.current);
            }
        };
    }, [showControls, isPlaying]);

    const handleTimeUpdate = () => {
        if (videoRef.current) {
            const current = videoRef.current.currentTime;
            const videoDuration = videoRef.current.duration;
            setCurrentTime(current);
            setDuration(videoDuration);
            setProgress((current / videoDuration) * 100);
        }
    };

    const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.stopPropagation();
        const progressBar = e.currentTarget;
        const rect = progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        
        if (videoRef.current) {
            const newTime = pos * videoRef.current.duration;
            videoRef.current.currentTime = newTime;
            
            setProgress(pos * 100);
            setCurrentTime(newTime);
        }
    };

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                const playPromise = videoRef.current.play();
                
                // Handle play promise
                if (playPromise !== undefined) {
                    playPromise.catch(e => console.error('Error playing video:', e));
                }
            }
            setIsPlaying(!isPlaying);
        }
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
        }
    };
    
    const toggleLoop = () => {
        setIsLooping(!isLooping);
        if (videoRef.current) {
            videoRef.current.loop = !isLooping;
        }
    };
    
    // Format time for display (e.g., 1:23)
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };
    
    // Audio functionality has been removed
    
    // Handle fullscreen toggle
    const handleFullscreen = () => {
        if (videoRef.current) {
            if (videoRef.current.requestFullscreen) {
                videoRef.current.requestFullscreen();
            }
        }
    };

    const handleLike = () => {
        if (currentVideo) {
            // Call API to update like count
            updateVideoStats(currentVideo.id.toString(), 'like');
            
            // Since we can't modify the videos prop directly, we'll just update the UI locally
            // This is just a visual update - the actual data won't be modified
            // On next render or page refresh, the data will revert to server state
            const likeChip = document.querySelector('.video-likes-chip .MuiChip-label');
            if (likeChip) {
                const newLikeCount = currentVideo.likes + 1;
                likeChip.textContent = newLikeCount.toLocaleString();
            }
        }
    };

    const goToNextVideo = useCallback(() => {
        if (currentIndex < videos.length - 1) {
            setCurrentIndex(currentIndex + 1);
        }
    }, [currentIndex, videos.length]);

    const goToPrevVideo = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    }, [currentIndex]);

    const swipeHandlers = useSwipeable({
        onSwipedLeft: () => goToNextVideo(),
        onSwipedRight: () => goToPrevVideo(),
        preventScrollOnSwipe: true,
        trackMouse: false
    });

    const toggleDetails = () => {
        setShowDetails(!showDetails);
    };

    if (!currentVideo || !open) return null;

    // Parse tags
    const tags = Array.isArray(currentVideo.tags) 
        ? currentVideo.tags 
        : typeof currentVideo.tags === 'string' 
            ? JSON.parse(currentVideo.tags as string) 
            : [];

    // Clean up function to properly handle audio and video elements before closing
    const handleClose = () => {
        // Stop video playback
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.src = '';
            videoRef.current.load();
        }
        // Call the parent onClose function
        onClose();
    };
    
    return (
        <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="xl"
            fullWidth
            PaperProps={{
                sx: {
                    backgroundColor: '#000',
                    height: '100%',
                    maxHeight: '100vh',
                    margin: 0,
                    borderRadius: 0,
                    overflow: 'hidden'
                }
            }}
            sx={{ 
                '& .MuiDialog-paper': { 
                    m: 0,
                    width: '100%',
                    maxWidth: '100%',
                    height: '100%'
                }
            }}
        >
            <Box 
                sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', md: 'row' },
                    height: '100%',
                    position: 'relative'
                }}
            >
                {/* Video Section */}
                <Box 
                    {...swipeHandlers}
                    sx={{ 
                        flex: { xs: '1', md: '0.65' },
                        position: 'relative',
                        backgroundColor: '#000',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden'
                    }}
                    onMouseMove={() => setShowControls(true)}
                    onClick={togglePlay}
                >
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={currentIndex}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.3 }}
                            style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center' }}
                        >
                            <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
                                <video
                                    ref={videoRef}
                                    style={{
                                        width: '100%',
                                        height: '100%',
                                        objectFit: 'contain',
                                        maxHeight: '100vh',
                                        transition: 'filter 0.3s ease'
                                    }}
                                    src={getVideoUrl(currentVideo.videoUrl)}
                                    playsInline
                                    preload="auto"
                                    autoPlay
                                    loop={isLooping}
                                    onTimeUpdate={handleTimeUpdate}
                                    onPlay={() => setIsPlaying(true)}
                                    onPause={() => setIsPlaying(false)}
                                    onWaiting={() => setIsBuffering(true)}
                                    onPlaying={() => setIsBuffering(false)}
                                    onStalled={() => {
                                        console.warn('Video playback stalled');
                                        // If stalled for too long, try a lower quality
                                        if (videoRef.current && currentVideo.videoUrl.includes('v.redd.it')) {
                                            const videoId = currentVideo.videoUrl.match(/v\.redd\.it\/([^/?]+)/i)?.[1];
                                            if (videoId) {
                                                // Try a lower quality
                                                const currentQuality = parseInt(getVideoQuality(videoId));
                                                if (currentQuality > 240) {
                                                    const lowerQuality = Math.max(240, currentQuality - 240);
                                                    console.log(`Reducing quality to ${lowerQuality}p due to stalling`);
                                                    setVideoQuality(lowerQuality.toString());
                                                    
                                                    // Save current time before changing source
                                                    const currentTime = videoRef.current.currentTime;
                                                    videoRef.current.src = `https://v.redd.it/${videoId}/DASH_${lowerQuality}.mp4`;
                                                    videoRef.current.load();
                                                    
                                                    // After loading, restore time and play
                                                    videoRef.current.onloadedmetadata = () => {
                                                        videoRef.current!.currentTime = currentTime;
                                                        videoRef.current!.play().catch(err => console.error('Playback error after quality reduction:', err));
                                                    };
                                                }
                                            }
                                        }
                                    }}
                                    onError={(e) => {
                                        console.error('Video playback error:', e);
                                        setIsBuffering(false);
                                        // If video fails to load, try with a different URL format
                                        if (videoRef.current && currentVideo.videoUrl.includes('v.redd.it')) {
                                            const videoId = currentVideo.videoUrl.match(/v\.redd\.it\/([^/?]+)/i)?.[1];
                                            if (videoId) {
                                                console.log('Trying fallback URL for video ID:', videoId);
                                                // Try a lower quality first
                                                videoRef.current.src = `https://v.redd.it/${videoId}/DASH_480.mp4`;
                                                videoRef.current.load();
                                                videoRef.current.play().catch(err => {
                                                    console.error('Playback error:', err);
                                                    // If still failing, try an even lower quality
                                                    videoRef.current!.src = `https://v.redd.it/${videoId}/DASH_240.mp4`;
                                                    videoRef.current!.load();
                                                    videoRef.current!.play().catch(finalErr => console.error('Final playback attempt failed:', finalErr));
                                                });
                                            }
                                        }
                                    }}
                                />
                                
                                {/* Audio functionality has been removed */}
                            </Box>
                        </motion.div>
                    </AnimatePresence>

                    {/* Navigation indicators */}
                    {currentIndex > 0 && (
                        <Box 
                            sx={{ 
                                position: 'absolute', 
                                top: '50%', 
                                left: 16, 
                                transform: 'translateY(-50%)',
                                display: { xs: 'none', md: 'block' }
                            }}
                        >
                            <IconButton 
                                onClick={(e) => { e.stopPropagation(); goToPrevVideo(); }}
                                sx={{ color: 'white', backgroundColor: 'rgba(0,0,0,0.5)' }}
                            >
                                <ArrowLeftIcon />
                            </IconButton>
                        </Box>
                    )}
                    
                    {currentIndex < videos.length - 1 && (
                        <Box 
                            sx={{ 
                                position: 'absolute', 
                                top: '50%', 
                                right: 16, 
                                transform: 'translateY(-50%)',
                                display: { xs: 'none', md: 'block' }
                            }}
                        >
                            <IconButton 
                                onClick={(e) => { e.stopPropagation(); goToNextVideo(); }}
                                sx={{ color: 'white', backgroundColor: 'rgba(0,0,0,0.5)' }}
                            >
                                <ArrowRightIcon />
                            </IconButton>
                        </Box>
                    )}
                    
                    {/* Close button */}
                    <IconButton 
                        onClick={(e) => { e.stopPropagation(); handleClose(); }}
                        sx={{ 
                            position: 'absolute', 
                            top: 16, 
                            left: 16, 
                            color: 'white',
                            backgroundColor: 'rgba(0,0,0,0.5)'
                        }}
                    >
                        <CloseIcon />
                    </IconButton>
                    
                    {/* Buffering indicator */}
                    {isBuffering && (
                        <Box
                            sx={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                backgroundColor: 'rgba(0,0,0,0.5)',
                                borderRadius: '8px',
                                padding: '10px 20px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                zIndex: 5
                            }}
                        >
                            <Typography variant="body2" sx={{ color: 'white' }}>
                                Buffering...
                            </Typography>
                        </Box>
                    )}
                    
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
                                    
                                    <IconButton 
                                        onClick={(e) => { e.stopPropagation(); toggleLoop(); }}
                                        sx={{ 
                                            color: isLooping ? '#f50057' : 'white',
                                            padding: '8px'
                                        }}
                                        title="Toggle loop"
                                    >
                                        <LoopIcon />
                                    </IconButton>
                                    
                                    {/* NSFW toggle button - only show if video is marked as NSFW */}
                                    {currentVideo.nsfw && (
                                        <IconButton 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setShowNsfw(!showNsfw); 
                                            }}
                                            sx={{ 
                                                color: showNsfw ? '#f50057' : 'white', 
                                                padding: '8px',
                                                backgroundColor: showNsfw ? 'rgba(245, 0, 87, 0.1)' : 'transparent'
                                            }}
                                            title={showNsfw ? "Blur NSFW content" : "Show NSFW content"}
                                        >
                                            {showNsfw ? <VisibilityIcon /> : <VisibilityOffIcon />}
                                        </IconButton>
                                    )}
                                    
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
                
                {/* Details Section - For mobile, this is a swipeable panel */}
                <Box 
                    sx={{ 
                        flex: { xs: 'auto', md: '0.35' },
                        backgroundColor: '#121212',
                        borderLeft: { xs: 'none', md: '1px solid rgba(255,255,255,0.1)' },
                        overflow: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        maxHeight: { xs: showDetails ? '50%' : '80px', md: '100%' },
                        transition: 'max-height 0.3s ease',
                        position: { xs: 'absolute', md: 'relative' },
                        bottom: 0,
                        left: 0,
                        right: 0,
                        zIndex: 10
                    }}
                >
                    {/* Mobile handle for swipe */}
                    <Box 
                        sx={{ 
                            display: { xs: 'flex', md: 'none' },
                            justifyContent: 'center',
                            padding: '8px 0',
                            cursor: 'pointer',
                            borderBottom: '1px solid rgba(255,255,255,0.1)'
                        }}
                        onClick={toggleDetails}
                    >
                        <Box 
                            sx={{ 
                                width: '40px', 
                                height: '4px', 
                                backgroundColor: 'rgba(255,255,255,0.3)',
                                borderRadius: '2px'
                            }}
                        />
                    </Box>
                    
                    <Box sx={{ p: 3, overflow: 'auto' }}>
                        <Typography 
                            variant="h6" 
                            gutterBottom 
                            sx={{ 
                                fontWeight: 700,
                                lineHeight: 1.3,
                                mb: 2,
                                color: '#fff',
                                textShadow: '0 1px 2px rgba(0,0,0,0.3)'
                            }}
                        >
                            {currentVideo.title}
                        </Typography>
                        
                        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                            <Chip 
                                label={`r/${currentVideo.subreddit}`} 
                                color="primary" 
                                size="small" 
                                sx={{ 
                                    mr: 1.5,
                                    fontWeight: 500,
                                    borderRadius: '4px',
                                    '& .MuiChip-label': { px: 1 }
                                }}
                            />
                            <Typography 
                                variant="caption" 
                                sx={{ 
                                    color: 'rgba(255,255,255,0.7)',
                                    fontSize: '0.85rem',
                                    fontWeight: 400
                                }}
                            >
                                {new Date(currentVideo.createdAt).toLocaleDateString(undefined, { 
                                    year: 'numeric', 
                                    month: 'short', 
                                    day: 'numeric' 
                                })}
                            </Typography>
                        </Box>
                        
                        {currentVideo.description && (
                            <Box 
                                sx={{ 
                                    mb: 3, 
                                    p: 2, 
                                    borderRadius: '8px',
                                    backgroundColor: 'rgba(255,255,255,0.05)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    position: 'relative',
                                    '&:before': {
                                        content: '""',
                                        position: 'absolute',
                                        left: 0,
                                        top: 0,
                                        bottom: 0,
                                        width: '4px',
                                        backgroundColor: theme.palette.primary.main,
                                        borderTopLeftRadius: '8px',
                                        borderBottomLeftRadius: '8px'
                                    }
                                }}
                            >
                                <Typography 
                                    variant="body1" 
                                    sx={{ 
                                        color: 'rgba(255,255,255,0.9)',
                                        lineHeight: 1.6,
                                        fontWeight: 400,
                                        whiteSpace: 'pre-line'
                                    }}
                                >
                                    {currentVideo.description}
                                </Typography>
                            </Box>
                        )}
                        
                        <Box 
                            sx={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                mb: 3,
                                p: 1.5,
                                backgroundColor: 'rgba(0,0,0,0.2)',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}
                        >
                            <Chip 
                                icon={<VisibilityIcon fontSize="small" sx={{ color: '#64B5F6' }} />} 
                                label={(currentVideo.views || 0).toLocaleString()} 
                                variant="filled" 
                                size="small"
                                sx={{ 
                                    backgroundColor: 'rgba(25, 118, 210, 0.15)',
                                    color: '#90CAF9',
                                    fontWeight: 500,
                                    '& .MuiChip-icon': { color: '#64B5F6' }
                                }}
                            />
                            <Chip 
                                className="video-likes-chip"
                                icon={<FavoriteIcon fontSize="small" sx={{ color: '#F06292' }} />} 
                                label={(currentVideo.likes || 0).toLocaleString()} 
                                variant="filled" 
                                size="small"
                                onClick={(e) => { e.stopPropagation(); handleLike(); }}
                                sx={{ 
                                    backgroundColor: 'rgba(233, 30, 99, 0.15)',
                                    color: '#F48FB1',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: 'rgba(233, 30, 99, 0.25)' },
                                    '& .MuiChip-icon': { color: '#F06292' }
                                }}
                            />
                            <Chip 
                                icon={<ArrowUpwardIcon fontSize="small" sx={{ color: '#81C784' }} />} 
                                label={(currentVideo.metadata?.redditScore || 0).toLocaleString()} 
                                variant="filled" 
                                size="small"
                                sx={{ 
                                    backgroundColor: 'rgba(76, 175, 80, 0.15)',
                                    color: '#A5D6A7',
                                    fontWeight: 500,
                                    '& .MuiChip-icon': { color: '#81C784' }
                                }}
                            />
                            <Chip 
                                icon={<LinkIcon fontSize="small" sx={{ color: '#FF8A65' }} />} 
                                label="Reddit" 
                                variant="filled" 
                                size="small" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(currentVideo.metadata.redditUrl, '_blank');
                                }}
                                clickable
                                sx={{ 
                                    backgroundColor: 'rgba(255, 87, 34, 0.15)',
                                    color: '#FFAB91',
                                    fontWeight: 500,
                                    cursor: 'pointer',
                                    '&:hover': {
                                        backgroundColor: 'rgba(255, 87, 34, 0.25)',
                                    },
                                    '& .MuiChip-icon': { color: '#FF8A65' }
                                }}
                            />
                        </Box>
                        
                        <Box 
                            sx={{ 
                                mb: 2,
                                p: 2,
                                backgroundColor: 'rgba(255,255,255,0.03)',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.05)'
                            }}
                        >
                            <Typography 
                                variant="subtitle2" 
                                gutterBottom 
                                sx={{ 
                                    fontWeight: 600, 
                                    color: 'rgba(255,255,255,0.9)',
                                    mb: 1.5,
                                    display: 'flex',
                                    alignItems: 'center',
                                    '&:before': {
                                        content: '""',
                                        display: 'inline-block',
                                        width: '6px',
                                        height: '6px',
                                        borderRadius: '50%',
                                        backgroundColor: theme.palette.primary.main,
                                        marginRight: '8px'
                                    }
                                }}
                            >
                                Tags
                            </Typography>
                            <Stack 
                                direction="row" 
                                spacing={0.8} 
                                flexWrap="wrap" 
                                gap={0.8}
                                sx={{ ml: 0.5 }}
                            >
                                {tags.map((tag: string, index: number) => (
                                    <Chip 
                                        key={index} 
                                        label={tag} 
                                        size="small" 
                                        onClick={() => onTagClick && onTagClick(tag)}
                                        clickable
                                        sx={{ 
                                            cursor: 'pointer',
                                            backgroundColor: 'rgba(103, 58, 183, 0.15)',
                                            color: '#B39DDB',
                                            fontWeight: 500,
                                            borderRadius: '4px',
                                            transition: 'all 0.2s ease',
                                            '&:hover': {
                                                backgroundColor: 'rgba(103, 58, 183, 0.25)',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                            }
                                        }}
                                    />
                                ))}
                            </Stack>
                        </Box>
                        
                        <Box sx={{ display: 'flex', gap: 1 }}>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<ThumbUpIcon />}
                                onClick={handleLike}
                                fullWidth
                            >
                                Like
                            </Button>
                            <Button
                                variant="outlined"
                                startIcon={<ShareIcon />}
                                fullWidth
                            >
                                Share
                            </Button>
                        </Box>
                    </Box>
                </Box>
            </Box>
        </Dialog>
    );
};

export default VideoPlayer;
