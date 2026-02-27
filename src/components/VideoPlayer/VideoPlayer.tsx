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
    useTheme,
    useMediaQuery
} from '@mui/material';
import { 
    Close as CloseIcon, 
    PlayArrow as PlayIcon,
    Pause as PauseIcon,
    Fullscreen as FullscreenIcon,
    KeyboardArrowLeft as ArrowLeftIcon,
    KeyboardArrowRight as ArrowRightIcon,
    Visibility as VisibilityIcon,
    Favorite as FavoriteIcon,
    ArrowUpward as ArrowUpwardIcon,
    Loop as LoopIcon,
    Reddit as RedditIcon,
    Settings as SettingsIcon,
    Download as DownloadIcon,
    VolumeUp as VolumeUpIcon,
    VolumeOff as VolumeOffIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { useSwipeable } from 'react-swipeable';
import { Video } from '../../types/Video';
import { updateVideoStats, getRedditAudioProxyUrl, likeVideoInternal } from '../../services/api';

interface VideoPlayerProps {
    videos: Video[];
    initialVideoIndex: number;
    open: boolean;
    onClose: () => void;
    onTagClick?: (tag: string) => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({ videos, initialVideoIndex, open, onClose, onTagClick }) => {
    const theme = useTheme();
    const isSmallDevice = useMediaQuery(theme.breakpoints.down('sm'));
    // const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    // const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
    
    const [currentIndex, setCurrentIndex] = useState(initialVideoIndex);
    const [isPlaying, setIsPlaying] = useState(false);
    // Keep mobile muted for autoplay policy, but allow desktop YouTube playback with sound.
    const [isMuted, setIsMuted] = useState(isSmallDevice);
    const [isLooping, setIsLooping] = useState(true);
    const [progress, setProgress] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [showControls, setShowControls] = useState(true);
    const [showDetails, setShowDetails] = useState(false);
    const [videoQuality, setVideoQuality] = useState<string>('480'); // Default to 480p for stability
    const [isBuffering, setIsBuffering] = useState(false);
    const [showQualityMenu, setShowQualityMenu] = useState(false);
    const [youtubeLoading, setYoutubeLoading] = useState(false);
    const [hasAudioTrack, setHasAudioTrack] = useState(false);
    const [isAudioReady, setIsAudioReady] = useState(false);
    const [internalLikeCount, setInternalLikeCount] = useState(0);
    const [hasLikedCurrent, setHasLikedCurrent] = useState(false);
    // const [isInitialLoading, setIsInitialLoading] = useState(true);
    // const [networkSpeed, setNetworkSpeed] = useState<number | null>(null); // Kept for compatibility
    
    const videoRef = useRef<HTMLVideoElement>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const youtubeIframeRef = useRef<HTMLIFrameElement>(null);
    const nextVideoPreloadRef = useRef<HTMLVideoElement>(null);
    const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const loadStartTimeRef = useRef<number>(0);
    const [nextYouTubeEmbedUrl, setNextYouTubeEmbedUrl] = useState('');
    // const nextVideoRef = useRef<HTMLVideoElement | null>(null);
    
    // Update currentIndex when initialVideoIndex changes
    useEffect(() => {
        if (initialVideoIndex >= 0 && initialVideoIndex < videos.length) {
            setCurrentIndex(initialVideoIndex);
            // Reset loading states when video changes
            const currentVideo = videos[initialVideoIndex];
            if (currentVideo?.platform === 'youtube') {
                setYoutubeLoading(true);
            } else {
                setIsBuffering(true);
            }
        }
    }, [initialVideoIndex, videos]);
    
    const currentVideo = videos[currentIndex];

    useEffect(() => {
        if (open && currentVideo) {
            updateVideoStats(currentVideo.id.toString(), 'view');
        }
    }, [currentVideo, open]);

    useEffect(() => {
        if (!currentVideo) {
            setInternalLikeCount(0);
            setHasLikedCurrent(false);
            return;
        }

        let metadata: any = currentVideo.metadata;
        if (typeof metadata === 'string') {
            try {
                metadata = JSON.parse(metadata);
            } catch {
                metadata = {};
            }
        }

        const internalLikes = Number(metadata?.internalLikes || metadata?.internalEngagement?.likes || 0);
        setInternalLikeCount(Number.isFinite(internalLikes) ? internalLikes : 0);

        try {
            setHasLikedCurrent(localStorage.getItem(`vf:liked:${currentVideo.id}`) === '1');
        } catch {
            setHasLikedCurrent(false);
        }
    }, [currentVideo]);

    useEffect(() => {
        if (!currentVideo) {
            return;
        }

        if (currentVideo.platform === 'youtube') {
            setHasAudioTrack(true);
            setIsAudioReady(true);
        }
    }, [currentVideo]);
    
    // Measure network speed when loading video (simplified)
    const measureNetworkSpeed = useCallback(() => {
        // Simplified network speed measurement to avoid quality switching
    }, []);

        // Get appropriate video quality based on network conditions
    const getVideoQuality = useCallback((videoId: string): string => {
        // Use the selected quality directly for stability
        return videoQuality;
    }, [videoQuality]);

    // Get YouTube embed URL
    const getYouTubeEmbedUrl = useCallback((video: Video) => {
        const youtubeId = video.metadata?.youtubeId;
        const muteParam = isSmallDevice ? '1' : '0';
        const params = `autoplay=1&mute=${muteParam}&controls=0&rel=0&modestbranding=1&disablekb=1&fs=0&iv_load_policy=3&playsinline=1&loop=1&enablejsapi=1`;
        
        if (youtubeId) {
            const embedUrl = `https://www.youtube-nocookie.com/embed/${youtubeId}?${params}&playlist=${youtubeId}`;
            return embedUrl;
        }
        
        // Fallback to videoUrl if youtubeId is not available
        if (video.videoUrl && video.videoUrl.includes('youtube.com')) {
            const videoId = video.videoUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)?.[1];
            if (videoId) {
                const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}?${params}&playlist=${videoId}`;
                return embedUrl;
            }
        }
        
        return '';
    }, [isSmallDevice]);

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
                    return `https://v.redd.it/${videoId}/DASH_${quality}.mp4?source=fallback`;
                }
            }
        }
        return url;
    }, [getVideoQuality]);
    

        // Preload function is now disabled to reduce network usage
    const preloadNextVideo = useCallback(() => {
        if (!open || !videos.length) {
            return;
        }

        const nextIndex = currentIndex + 1;
        if (nextIndex >= videos.length) {
            setNextYouTubeEmbedUrl('');
            if (nextVideoPreloadRef.current) {
                nextVideoPreloadRef.current.removeAttribute('src');
                nextVideoPreloadRef.current.load();
            }
            return;
        }

        const nextVideo = videos[nextIndex];
        if (nextVideo.platform === 'youtube') {
            setNextYouTubeEmbedUrl(getYouTubeEmbedUrl(nextVideo));
            if (nextVideoPreloadRef.current) {
                nextVideoPreloadRef.current.removeAttribute('src');
                nextVideoPreloadRef.current.load();
            }
        } else {
            setNextYouTubeEmbedUrl('');
            if (nextVideoPreloadRef.current) {
                nextVideoPreloadRef.current.src = getVideoUrl(nextVideo.videoUrl);
                nextVideoPreloadRef.current.preload = 'auto';
                nextVideoPreloadRef.current.load();
            }
        }
    }, [open, videos, currentIndex, getYouTubeEmbedUrl, getVideoUrl]);

    const syncMedia = useCallback((force = false) => {
        const videoElement = videoRef.current;
        const audioElement = audioRef.current;

        if (!videoElement || !audioElement) {
            return;
        }

        const timeDifference = Math.abs(audioElement.currentTime - videoElement.currentTime);

        if (!force && timeDifference <= 0.3) {
            return;
        }

        try {
            audioElement.currentTime = videoElement.currentTime;
        } catch (error) {
            console.error('Error syncing Reddit audio track:', error);
        }
    }, []);
    
    
    useEffect(() => {
        // Reset state when changing videos
        setProgress(0);
        setCurrentTime(0);
        setDuration(0);
        setIsPlaying(false);
        setIsBuffering(true);
        setHasAudioTrack(false);
        setIsAudioReady(false);
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
            audioRef.current.removeAttribute('src');
        }
        // setIsInitialLoading(true); // Set initial loading to true when changing videos
        
        // Record start time for network speed measurement
        loadStartTimeRef.current = performance.now();
        
        // Auto-play the video immediately
        const timer = setTimeout(() => {
            if (videoRef.current) {
                // Ensure video is muted for autoplay to work on mobile
                videoRef.current.muted = true;
                videoRef.current.playsInline = true;
                
                // Add buffer management
                videoRef.current.onwaiting = () => {
                    setIsBuffering(true);
                    // Don't reset isInitialLoading here - we want to keep track of initial load vs. subsequent buffering
                };
                
                videoRef.current.oncanplay = () => {
                    setIsBuffering(false);
                    // setIsInitialLoading(false); // Mark initial loading as complete once video can play
                    measureNetworkSpeed();
                    
                    preloadNextVideo();
                };
                
                // Use a variable to track if we're currently attempting to play
                const playPromise = videoRef.current.play();
                
                if (playPromise !== undefined) {
                    playPromise.then(() => {
                        setIsPlaying(true);
                        setIsBuffering(false);
                        
                        // Keep muted for mobile autoplay compatibility
                        // Unmute after playback starts if it wasn't muted before
                        if (!isMuted) {
                            videoRef.current!.muted = false;
                        }
                    }).catch(err => {
                        console.error('Error playing video:', err);
                        setIsBuffering(false);
                        // On mobile, if autoplay fails, we might need to handle it differently
                        // For now, keep it muted and let user interaction trigger play
                    });
                }
            }
        }, 300); // Increased delay to ensure DOM is ready
        
        return () => clearTimeout(timer);
    }, [currentIndex, isMuted, measureNetworkSpeed, preloadNextVideo]);

    useEffect(() => {
        preloadNextVideo();
    }, [preloadNextVideo]);

    useEffect(() => {
        if (!currentVideo || !audioRef.current) {
            setHasAudioTrack(false);
            setIsAudioReady(false);
            return;
        }

        if (currentVideo.platform === 'youtube') {
            // YouTube audio is handled by the iframe player itself.
            setHasAudioTrack(true);
            setIsAudioReady(true);
            audioRef.current.pause();
            audioRef.current.removeAttribute('src');
            audioRef.current.load();
            return;
        }

        const audioElement = audioRef.current;
        let metadata: any = currentVideo.metadata;

        if (typeof metadata === 'string') {
            try {
                metadata = JSON.parse(metadata);
            } catch (error) {
                console.error('Failed to parse video metadata for audio track:', error);
                metadata = null;
            }
        }

        const isRedditVideo =
            currentVideo.platform === 'reddit' ||
            (currentVideo.videoUrl && currentVideo.videoUrl.includes('v.redd.it'));
        let rawAudioUrl = metadata?.audioUrl;

        if ((!rawAudioUrl || typeof rawAudioUrl !== 'string') && isRedditVideo && currentVideo.videoUrl) {
            const match = currentVideo.videoUrl.match(/v\.redd\.it\/([^/?]+)/i);
            const videoId = match?.[1];
            if (videoId) {
                rawAudioUrl = `https://v.redd.it/${videoId}/DASH_AUDIO_128.mp4`;
            }
        }

        if (!isRedditVideo || !rawAudioUrl || typeof rawAudioUrl !== 'string') {
            audioElement.pause();
            audioElement.removeAttribute('src');
            audioElement.load();
            setHasAudioTrack(false);
            setIsAudioReady(false);
            return;
        }

        const proxiedUrl = getRedditAudioProxyUrl(rawAudioUrl);

        audioElement.src = proxiedUrl;
        audioElement.load();

        audioElement.preload = 'auto';
        audioElement.crossOrigin = 'anonymous';
        audioElement.muted = isMuted;
        audioElement.loop = isLooping;

        setHasAudioTrack(true);
        setIsAudioReady(false);

        const handleCanPlay = () => {
            setIsAudioReady(true);
            if (!isMuted && isPlaying) {
                syncMedia(true);
                const playPromise = audioElement.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(err => {
                        console.error('Error starting Reddit audio playback:', err);
                    });
                }
            }
        };

        const handleError = (event: Event) => {
            console.error('Error loading Reddit audio track:', event);
            setHasAudioTrack(false);
        };

        audioElement.addEventListener('canplay', handleCanPlay);
        audioElement.addEventListener('error', handleError);

        return () => {
            audioElement.removeEventListener('canplay', handleCanPlay);
            audioElement.removeEventListener('error', handleError);
        };
    }, [currentVideo, isMuted, isPlaying, isLooping, syncMedia]);

    useEffect(() => {
        const videoElement = videoRef.current;
        const audioElement = audioRef.current;

        if (!videoElement || !audioElement || !hasAudioTrack) {
            return;
        }

        const handlePlay = () => {
            syncMedia(true);
            if (!isMuted && isAudioReady) {
                const playPromise = audioElement.play();
                if (playPromise && typeof playPromise.catch === 'function') {
                    playPromise.catch(err => {
                        console.error('Error playing synced Reddit audio:', err);
                    });
                }
            }
        };

        const handlePause = () => {
            audioElement.pause();
        };

        const handleSeek = () => {
            syncMedia(true);
        };

        const handleTimeUpdate = () => {
            syncMedia(false);
        };

        videoElement.addEventListener('play', handlePlay);
        videoElement.addEventListener('pause', handlePause);
        videoElement.addEventListener('seeking', handleSeek);
        videoElement.addEventListener('seeked', handleSeek);
        videoElement.addEventListener('timeupdate', handleTimeUpdate);

        return () => {
            videoElement.removeEventListener('play', handlePlay);
            videoElement.removeEventListener('pause', handlePause);
            videoElement.removeEventListener('seeking', handleSeek);
            videoElement.removeEventListener('seeked', handleSeek);
            videoElement.removeEventListener('timeupdate', handleTimeUpdate);
        };
    }, [hasAudioTrack, isMuted, isAudioReady, syncMedia]);

    useEffect(() => {
        const videoElement = videoRef.current;
        const audioElement = audioRef.current;

        if (videoElement) {
            videoElement.muted = isMuted;
        }

        if (!audioElement) {
            return;
        }

        audioElement.muted = isMuted;

        if (isMuted) {
            audioElement.pause();
            return;
        }

        if (hasAudioTrack && isAudioReady && isPlaying) {
            syncMedia(true);
            const playPromise = audioElement.play();
            if (playPromise && typeof playPromise.catch === 'function') {
                playPromise.catch(err => {
                    console.error('Error resuming Reddit audio:', err);
                });
            }
        }
    }, [isMuted, hasAudioTrack, isAudioReady, isPlaying, syncMedia]);






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
            // Check if the video data is already loaded for this position
            const newTime = pos * videoRef.current.duration;
            const buffered = videoRef.current.buffered;
            let isBuffered = false;
            
            // Check if the requested time is already in a buffered range
            for (let i = 0; i < buffered.length; i++) {
                if (newTime >= buffered.start(i) && newTime <= buffered.end(i)) {
                    isBuffered = true;
                    break;
                }
            }
            
            // Update UI immediately to feel more responsive
            setProgress(pos * 100);
            setCurrentTime(newTime);
            
            // If the segment is already buffered, don't show buffering indicator
            if (isBuffered) {
                setIsBuffering(false);
            }
            
            // Set the new time
            videoRef.current.currentTime = newTime;
            if (audioRef.current && hasAudioTrack) {
                audioRef.current.currentTime = newTime;
            }
        }
    };

    const togglePlay = useCallback(() => {
        const videoElement = videoRef.current;
        const audioElement = audioRef.current;

        if (!videoElement) {
            return;
        }

        if (isPlaying) {
            videoElement.pause();
            if (audioElement) {
                audioElement.pause();
            }
            setIsPlaying(false);
            return;
        }

        const currentTime = videoElement.currentTime;
        const buffered = videoElement.buffered;
        let isBuffered = false;

        for (let i = 0; i < buffered.length; i++) {
            if (currentTime >= buffered.start(i) && currentTime <= buffered.end(i)) {
                isBuffered = true;
                break;
            }
        }

        if (isBuffered) {
            setIsBuffering(false);
        }

        const playPromise = videoElement.play();

        if (playPromise !== undefined) {
            playPromise
                .then(() => {
                    setIsPlaying(true);
                    if (isBuffered) {
                        setIsBuffering(false);
                    }

                    if (hasAudioTrack && audioElement) {
                        if (isMuted) {
                            audioElement.pause();
                        } else if (isAudioReady) {
                            syncMedia(true);
                            const audioPromise = audioElement.play();
                            if (audioPromise && typeof audioPromise.catch === 'function') {
                                audioPromise.catch(err => {
                                    console.error('Error playing Reddit audio track:', err);
                                });
                            }
                        }
                    }
                })
                .catch(e => {
                    console.error('Error playing video:', e);
                    setIsPlaying(false);
                });
        }
    }, [hasAudioTrack, isAudioReady, isMuted, isPlaying, syncMedia]);
    
    const toggleMute = useCallback(() => {
        setIsMuted((prevMuted) => {
            const nextMuted = !prevMuted;

            if (currentVideo?.platform === 'youtube' && youtubeIframeRef.current?.contentWindow) {
                try {
                    youtubeIframeRef.current.contentWindow.postMessage(
                        JSON.stringify({
                            event: 'command',
                            func: nextMuted ? 'mute' : 'unMute',
                            args: []
                        }),
                        '*'
                    );
                } catch (error) {
                    console.error('Error toggling YouTube mute state:', error);
                }
            }

            if (videoRef.current) {
                videoRef.current.muted = nextMuted;
            }

            if (audioRef.current) {
                audioRef.current.muted = nextMuted;
                if (nextMuted) {
                    audioRef.current.pause();
                } else if (hasAudioTrack && isAudioReady) {
                    syncMedia(true);
                    const playPromise = audioRef.current.play();
                    if (playPromise && typeof playPromise.catch === 'function') {
                        playPromise.catch(err => {
                            console.error('Error enabling Reddit audio playback:', err);
                        });
                    }
                }
            }

            return nextMuted;
        });
    }, [currentVideo, hasAudioTrack, isAudioReady, syncMedia]);

    // Format time for display (e.g., 1:23)
    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };
    
    // Reddit audio playback is managed via a secondary audio element
    
    // Handle fullscreen toggle
    const handleFullscreen = () => {
        if (videoRef.current) {
            if (videoRef.current.requestFullscreen) {
                videoRef.current.requestFullscreen();
            }
        }
    };

    const handleLike = async () => {
        if (!currentVideo || hasLikedCurrent) {
            return;
        }

        try {
            const result = await likeVideoInternal(currentVideo.id.toString());
            const serverLikes = Number(result?.engagement?.likes);
            setInternalLikeCount(prev => (Number.isFinite(serverLikes) ? serverLikes : prev + 1));
        } catch (error) {
            console.error('Error sending internal like:', error);
            setInternalLikeCount(prev => prev + 1);
        }

        setHasLikedCurrent(true);
        try {
            localStorage.setItem(`vf:liked:${currentVideo.id}`, '1');
        } catch {
            // Ignore local storage failures.
        }
    };

    const handleDownload = () => {
        if (currentVideo) {
            try {
                // Create a temporary anchor element
                const link = document.createElement('a');
                link.href = getVideoUrl(currentVideo.videoUrl);
                link.download = `${currentVideo.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.mp4`;
                link.target = '_blank';
                
                // Append to body, click, and remove
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } catch (error) {
                console.error('Error downloading video:', error);
                // Fallback: open in new tab
                window.open(getVideoUrl(currentVideo.videoUrl), '_blank');
            }
        }
    };

    const goToNextVideo = useCallback(() => {
        if (currentIndex < videos.length - 1) {
            // Reset video timer and state
            setProgress(0);
            setCurrentTime(0);
            setDuration(0);
            
            // Navigate to next video
            setCurrentIndex(currentIndex + 1);
        }
    }, [currentIndex, videos.length]);

    const goToPrevVideo = useCallback(() => {
        if (currentIndex > 0) {
            // Reset video timer and state
            setProgress(0);
            setCurrentTime(0);
            setDuration(0);
            
            // Navigate to previous video
            setCurrentIndex(currentIndex - 1);
        }
    }, [currentIndex]);

    // Track swipe direction state for visual feedback
    const [swipeDirection, setSwipeDirection] = useState<string | null>(null);
    const [swipeProgress, setSwipeProgress] = useState(0);
    
    
    // Loading spinner SVG for buffering indicator
    const loadingSpinnerSvg = `
        <svg xmlns="http://www.w3.org/2000/svg" width="80" height="80" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid">
            <circle cx="50" cy="50" r="32" stroke-width="8" stroke="#64B5F6" stroke-dasharray="50.26548245743669 50.26548245743669" fill="none" stroke-linecap="round">
                <animateTransform attributeName="transform" type="rotate" dur="1s" repeatCount="indefinite" keyTimes="0;1" values="0 50 50;360 50 50"></animateTransform>
            </circle>
        </svg>
    `;
    const loadingSpinnerUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(loadingSpinnerSvg.trim())}`;
    
    const swipeHandlers = useSwipeable({
        onSwipedLeft: () => {
            goToNextVideo();
            // Reset swipe state
            setSwipeDirection(null);
            setSwipeProgress(0);
        },
        onSwipedRight: () => {
            goToPrevVideo();
            // Reset swipe state
            setSwipeDirection(null);
            setSwipeProgress(0);
        },
        onSwiping: (event) => {
            // Update swipe direction and progress for visual feedback
            if (event.dir === 'Left' || event.dir === 'Right') {
                setSwipeDirection(event.dir);
                // Calculate swipe progress as percentage (0-100)
                // Adjust divisor to control sensitivity (lower = more sensitive)
                const progress = Math.min(Math.abs(event.deltaX) / 150, 1) * 100;
                setSwipeProgress(progress);
            }
        },
        preventScrollOnSwipe: true,
        trackMouse: true, // Enable mouse tracking for desktop swipes
        delta: 10, // Minimum distance in pixels before a swipe starts (lower = more sensitive)
        swipeDuration: 500, // Maximum time in ms to detect a swipe
        touchEventOptions: { passive: false }
    });

    const toggleDetails = () => {
        setShowDetails(!showDetails);
    };
    
    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!open) return;
            
            switch (e.key) {
                case 'ArrowRight':
                case 'Right': // For IE/Edge compatibility
                    goToNextVideo();
                    break;
                case 'ArrowLeft':
                case 'Left': // For IE/Edge compatibility
                    goToPrevVideo();
                    break;
                // Optional: Add space bar for play/pause
                case ' ':
                    togglePlay();
                    e.preventDefault(); // Prevent page scrolling
                    break;
                case 'Escape':
                    setShowQualityMenu(false);
                    break;
            }
        };
        
        // Add event listener
        window.addEventListener('keydown', handleKeyDown);
        
        // Clean up
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [open, goToNextVideo, goToPrevVideo, togglePlay]);

    // Close quality menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (showQualityMenu) {
                setShowQualityMenu(false);
            }
        };

        if (showQualityMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showQualityMenu]);

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

        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.removeAttribute('src');
            audioRef.current.load();
        }

        setHasAudioTrack(false);
        setIsAudioReady(false);

        // Call the parent onClose function
        onClose();
    };
    
    return (
        <>
            <audio ref={audioRef} preload="auto" style={{ display: 'none' }} />
            <video ref={nextVideoPreloadRef} muted playsInline preload="auto" style={{ display: 'none' }} />
            {nextYouTubeEmbedUrl && (
                <iframe
                    src={nextYouTubeEmbedUrl}
                    title="preload-next-youtube"
                    style={{ display: 'none' }}
                    aria-hidden="true"
                />
            )}
            <Dialog
            open={open}
            onClose={handleClose}
            maxWidth="xl"
            fullWidth
            PaperProps={{
                sx: {
                    backgroundColor: '#000',
                    height: { xs: '100dvh', md: '100vh' },
                    maxHeight: { xs: '100dvh', md: '100vh' },
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
                    height: { xs: '100dvh', md: '100vh' },
                    maxHeight: { xs: '100dvh', md: '100vh' }
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
                        overflow: 'hidden',
                        height: { xs: '100dvh', md: '100%' },
                        maxHeight: { xs: '100dvh', md: '100vh' },
                        cursor: swipeDirection ? (swipeDirection === 'Left' ? 'e-resize' : 'w-resize') : 'default'
                    }}
                    onMouseMove={() => setShowControls(true)}
                    onClick={(e) => {
                        // Only toggle play if we're not in the middle of a swipe
                        if (!swipeDirection) {
                            togglePlay();
                        }
                    }}
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
                                {/* Swipe direction indicators */}
                                {swipeDirection === 'Left' && (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            top: 0,
                                            right: 0,
                                            height: '100%',
                                            width: `${swipeProgress}%`,
                                            maxWidth: '30%',
                                            backgroundColor: 'rgba(255,255,255,0.15)',
                                            zIndex: 2,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <ArrowRightIcon sx={{ fontSize: 40, color: 'white', opacity: swipeProgress / 100 }} />
                                    </Box>
                                )}
                                {swipeDirection === 'Right' && (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            height: '100%',
                                            width: `${swipeProgress}%`,
                                            maxWidth: '30%',
                                            backgroundColor: 'rgba(255,255,255,0.15)',
                                            zIndex: 2,
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                    >
                                        <ArrowLeftIcon sx={{ fontSize: 40, color: 'white', opacity: swipeProgress / 100 }} />
                                    </Box>
                                )}
                                {/* Loading animation displayed while video is buffering */}
                                {isBuffering && (
                                    <Box
                                        sx={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: '100%',
                                            zIndex: 1,
                                            display: 'flex',
                                            flexDirection: 'column',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            backgroundColor: 'rgba(0,0,0,0.7)',
                                        }}
                                    >
                                        {/* Animated loading spinner */}
                                        <img
                                            src={loadingSpinnerUrl}
                                            alt="Loading..."
                                            style={{
                                                width: '80px',
                                                height: '80px',
                                            }}
                                        />
                                        
                                        {/* Thumbnail display removed as requested */}
                                    </Box>
                                )}
                                {currentVideo.platform === 'youtube' ? (
                                    // YouTube video - use iframe
                                    <>
                                        {youtubeLoading && (
                                            <Box
                                                sx={{
                                                    position: 'absolute',
                                                    top: 0,
                                                    left: 0,
                                                    width: '100%',
                                                    height: '100%',
                                                    zIndex: 1,
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: 'rgba(0,0,0,0.7)',
                                                }}
                                            >
                                                <img
                                                    src={loadingSpinnerUrl}
                                                    alt="Loading..."
                                                    style={{
                                                        width: '80px',
                                                        height: '80px',
                                                    }}
                                                />
                                            </Box>
                                        )}
                                        {getYouTubeEmbedUrl(currentVideo) ? (
                                            <iframe
                                                ref={youtubeIframeRef}
                                                src={getYouTubeEmbedUrl(currentVideo)}
                                                style={{
                                                    width: isSmallDevice ? '100vw' : '100%',
                                                    height: isSmallDevice ? '100dvh' : '100%',
                                                    border: 'none',
                                                    maxHeight: isSmallDevice ? '100dvh' : '100vh',
                                                    transition: 'filter 0.3s ease',
                                                    pointerEvents: isSmallDevice ? 'none' : 'auto'
                                                }}
                                                allow="autoplay; encrypted-media; picture-in-picture"
                                                allowFullScreen
                                                onLoad={() => {
                                                    setYoutubeLoading(false);
                                                    setIsBuffering(false);
                                                    setIsPlaying(true);
                                                }}
                                                onError={(e) => {
                                                    console.error('YouTube iframe failed to load:', e);
                                                    setYoutubeLoading(false);
                                                    setIsBuffering(false);
                                                }}
                                            />
                                        ) : (
                                            <Box
                                                sx={{
                                                    width: '100%',
                                                    height: '100%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    backgroundColor: 'rgba(0,0,0,0.8)',
                                                    color: 'white'
                                                }}
                                            >
                                                <Typography>Unable to load YouTube video</Typography>
                                            </Box>
                                        )}
                                    </>
                                ) : (
                                    // Reddit video - use video element
                                    <video
                                        ref={videoRef}
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: isSmallDevice ? 'cover' : 'contain',
                                            maxHeight: isSmallDevice ? '100dvh' : '100vh',
                                            maxWidth: '100%',
                                            transition: 'filter 0.3s ease'
                                        }}
                                        src={getVideoUrl(currentVideo.videoUrl)}
                                        playsInline
                                        preload="auto"
                                        autoPlay
                                        muted={isMuted}
                                        loop={isLooping}
                                        onTimeUpdate={handleTimeUpdate}
                                        onPlay={() => setIsPlaying(true)}
                                        onPause={() => setIsPlaying(false)}
                                        onWaiting={() => {
                                            setIsBuffering(true);
                                        }}
                                        onPlaying={() => {
                                            setIsBuffering(false);
                                        }}
                                        onCanPlayThrough={() => {
                                            setIsBuffering(false);
                                        }}
                                        onStalled={() => {
                                            // Don't automatically switch quality on stall
                                            // This prevents constant quality switching that causes poor UX
                                            console.log('Video stalled - maintaining current quality for stability');
                                        }}
                                        onError={(e) => {
                                            setIsBuffering(false);
                                            console.error('Video playback error:', e);
                                            // Only try one fallback quality to prevent constant switching
                                            if (videoRef.current && currentVideo.videoUrl.includes('v.redd.it')) {
                                                const videoId = currentVideo.videoUrl.match(/v\.redd\.it\/([^/?]+)/i)?.[1];
                                                if (videoId && videoQuality !== '360') {
                                                    // Try 360p as a single fallback
                                                    setVideoQuality('360');
                                                    videoRef.current.src = `https://v.redd.it/${videoId}/DASH_360.mp4`;
                                                    videoRef.current.load();
                                                    videoRef.current.play().catch(err => {
                                                        console.error('Fallback quality also failed:', err);
                                                    });
                                                }
                                            }
                                        }}
                                        onClick={() => {
                                            // Ensure video can be played on user interaction
                                            if (videoRef.current && videoRef.current.paused) {
                                                videoRef.current.play().catch(err => {
                                                    console.error('Error playing video on click:', err);
                                                });
                                            }
                                        }}
                                    />
                                )}
                                
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
                            
                            <Box sx={{ 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center',
                                flexWrap: { xs: 'wrap', sm: 'nowrap' }
                            }}>
                                <Box sx={{ 
                                    display: 'flex', 
                                    alignItems: 'center',
                                    flexWrap: { xs: 'wrap', sm: 'nowrap' },
                                    width: { xs: '100%', sm: 'auto' },
                                    justifyContent: { xs: 'space-between', sm: 'flex-start' },
                                    mb: { xs: 1, sm: 0 }
                                }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        <IconButton 
                                            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
                                            sx={{ 
                                                color: 'white', 
                                                padding: { xs: '4px', sm: '8px' },
                                                '& .MuiSvgIcon-root': {
                                                    fontSize: { xs: '1.5rem', sm: '1.75rem' }
                                                }
                                            }}
                                        >
                                            {isPlaying ? <PauseIcon /> : <PlayIcon />}
                                        </IconButton>
                                        
                                        <IconButton
                                            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                                            disabled={!hasAudioTrack}
                                            sx={{
                                                color: isMuted ? 'white' : '#4caf50',
                                                opacity: hasAudioTrack ? 1 : 0.4,
                                                padding: { xs: '4px', sm: '8px' },
                                                '& .MuiSvgIcon-root': {
                                                    fontSize: { xs: '1.25rem', sm: '1.5rem' }
                                                }
                                            }}
                                            title={hasAudioTrack ? (isMuted ? 'Unmute audio' : 'Mute audio') : 'Audio unavailable'}
                                        >
                                            {isMuted ? <VolumeOffIcon /> : <VolumeUpIcon />}
                                        </IconButton>

                                        <IconButton 
                                            onClick={(e) => { e.stopPropagation(); setIsLooping(!isLooping); }}
                                            sx={{ 
                                                color: isLooping ? '#f50057' : 'white',
                                                padding: { xs: '4px', sm: '8px' },
                                                '& .MuiSvgIcon-root': {
                                                    fontSize: { xs: '1.25rem', sm: '1.5rem' }
                                                }
                                            }}
                                            title={isLooping ? "Disable loop" : "Enable loop"}
                                        >
                                            <LoopIcon />
                                        </IconButton>
                                    </Box>
                                    
                                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                                        {/* Quality selector */}
                                        <Box sx={{ position: 'relative' }}>
                                            <IconButton 
                                                onClick={(e) => { 
                                                    e.stopPropagation(); 
                                                    setShowQualityMenu(!showQualityMenu); 
                                                }}
                                                sx={{ 
                                                    color: 'white', 
                                                    padding: { xs: '4px', sm: '8px' },
                                                    '& .MuiSvgIcon-root': {
                                                        fontSize: { xs: '1.25rem', sm: '1.5rem' }
                                                    }
                                                }}
                                            >
                                                <SettingsIcon />
                                            </IconButton>
                                            {showQualityMenu && (
                                                <Box
                                                    sx={{
                                                        position: 'absolute',
                                                        bottom: '100%',
                                                        right: 0,
                                                        backgroundColor: 'rgba(0,0,0,0.9)',
                                                        borderRadius: '8px',
                                                        padding: '8px',
                                                        minWidth: '120px',
                                                        zIndex: 1000,
                                                        border: '1px solid rgba(255,255,255,0.2)'
                                                    }}
                                                >
                                                    <Typography variant="caption" sx={{ color: 'white', display: 'block', mb: 1 }}>
                                                        Quality
                                                    </Typography>
                                                    {['240', '360', '480', '720'].map((quality) => (
                                                        <Button
                                                            key={quality}
                                                            size="small"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setVideoQuality(quality);
                                                                setShowQualityMenu(false);
                                                            }}
                                                            sx={{
                                                                color: videoQuality === quality ? '#f50057' : 'white',
                                                                display: 'block',
                                                                width: '100%',
                                                                justifyContent: 'flex-start',
                                                                fontSize: '0.8rem',
                                                                py: 0.5,
                                                                '&:hover': {
                                                                    backgroundColor: 'rgba(255,255,255,0.1)'
                                                                }
                                                            }}
                                                        >
                                                            {quality}p
                                                        </Button>
                                                    ))}
                                                </Box>
                                            )}
                                        </Box>
                                        
                                        <IconButton 
                                            onClick={(e) => { e.stopPropagation(); handleDownload(); }}
                                            sx={{ 
                                                color: 'white', 
                                                padding: { xs: '4px', sm: '8px' },
                                                '& .MuiSvgIcon-root': {
                                                    fontSize: { xs: '1.25rem', sm: '1.5rem' }
                                                }
                                            }}
                                            title="Download video"
                                        >
                                            <DownloadIcon />
                                        </IconButton>
                                        
                                        <IconButton 
                                            onClick={(e) => { e.stopPropagation(); handleFullscreen(); }}
                                            sx={{ 
                                                color: 'white', 
                                                padding: { xs: '4px', sm: '8px' },
                                                '& .MuiSvgIcon-root': {
                                                    fontSize: { xs: '1.25rem', sm: '1.5rem' }
                                                }
                                            }}
                                        >
                                            <FullscreenIcon />
                                        </IconButton>
                                    </Box>
                                </Box>
                                
                                <Typography 
                                    variant="body2" 
                                    sx={{ 
                                        color: 'white', 
                                        ml: { xs: 0, sm: 1 },
                                        width: { xs: '100%', sm: 'auto' },
                                        textAlign: { xs: 'center', sm: 'right' },
                                        fontSize: { xs: '0.75rem', sm: '0.875rem' }
                                    }}
                                >
                                    {formatTime(currentTime)} / {formatTime(duration)}
                                </Typography>
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
                        borderTop: { xs: '1px solid rgba(255,255,255,0.1)', md: 'none' },
                        overflow: 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        maxHeight: { xs: showDetails ? '60%' : '80px', md: '100%' },
                        transition: 'max-height 0.3s ease',
                        // Add shadow to make the panel more distinct on mobile
                        boxShadow: { xs: '0px -2px 10px rgba(0,0,0,0.2)', md: 'none' },
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
                            alignItems: 'center',
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
                        <Typography 
                            variant="caption" 
                            sx={{ 
                                color: 'rgba(255,255,255,0.6)', 
                                ml: 1,
                                fontSize: '0.7rem',
                                display: { xs: showDetails ? 'none' : 'block', md: 'none' }
                            }}
                        >
                            {showDetails ? 'Hide details' : 'Show details'}
                        </Typography>
                    </Box>
                    
                    <Box sx={{ 
                        p: { xs: 2, sm: 3 }, 
                        overflow: 'auto',
                        '& .MuiTypography-root': {
                            fontSize: { xs: '0.9rem', sm: '1rem' }
                        }
                    }}>
                        <Typography 
                            variant="h6" 
                            gutterBottom 
                            sx={{ 
                                fontWeight: 700,
                                lineHeight: 1.3,
                                mb: 2,
                                color: '#fff',
                                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
                                fontSize: { xs: '1.1rem', sm: '1.25rem' }
                            }}
                        >
                            {currentVideo.title}
                        </Typography>
                        
                        <Box sx={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            mb: 3,
                            flexWrap: { xs: 'wrap', sm: 'nowrap' },
                            gap: { xs: 1, sm: 0 }
                        }}>
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
                                    p: { xs: 1.5, sm: 2 }, 
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
                                alignItems: 'center',
                                justifyContent: 'space-between', 
                                mb: 3,
                                p: { xs: 1, sm: 1.5 },
                                backgroundColor: 'rgba(0,0,0,0.2)',
                                borderRadius: '8px',
                                border: '1px solid rgba(255,255,255,0.05)',
                                flexWrap: { xs: 'wrap', sm: 'nowrap' },
                                gap: { xs: 1, sm: 0 }
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
                                label={`App ${internalLikeCount.toLocaleString()}`} 
                                variant="filled" 
                                size="small"
                                onClick={(e) => { e.stopPropagation(); handleLike(); }}
                                sx={{ 
                                    backgroundColor: 'rgba(233, 30, 99, 0.15)',
                                    color: '#F48FB1',
                                    fontWeight: 500,
                                    cursor: hasLikedCurrent ? 'default' : 'pointer',
                                    opacity: hasLikedCurrent ? 0.75 : 1,
                                    '&:hover': { backgroundColor: hasLikedCurrent ? 'rgba(233, 30, 99, 0.15)' : 'rgba(233, 30, 99, 0.25)' },
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
                            <Button
                                variant="outlined"
                                startIcon={<RedditIcon />}
                                onClick={() => {
                                    try {
                                        // Handle both string and object metadata formats
                                        const metadata = typeof currentVideo.metadata === 'string' 
                                            ? JSON.parse(currentVideo.metadata) 
                                            : currentVideo.metadata;
                                            
                                        // Open Reddit URL if available
                                        if (metadata?.redditUrl) {
                                            window.open(metadata.redditUrl, '_blank');
                                        }
                                    } catch (error) {
                                        console.error('Error opening Reddit URL:', error);
                                    }
                                }}
                                sx={{ 
                                    borderColor: 'rgba(255,255,255,0.3)',
                                    color: '#fff',
                                    flex: { xs: '1 1 auto', sm: 'initial' },
                                    fontSize: { xs: '0.8rem', sm: '0.875rem' },
                                    py: { xs: 0.75, sm: 1 }
                                }}
                                size="small"
                            >
                                {window.innerWidth < 500 ? 'Reddit' : 'View on Reddit'}
                            </Button>
                            

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
                    </Box>
                </Box>
            </Box>
        </Dialog>
        </>
    );
};

export default VideoPlayer;
