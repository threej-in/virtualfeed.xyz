import React, { useState, useEffect, useRef } from 'react';
import { Box, CircularProgress, styled, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { Video } from '../../types/Video';

// Import dashjs dynamically to avoid SSR issues
declare global {
  interface Window {
    dashjs?: {
      MediaPlayer: () => {
        create: () => DashPlayer;
      };
    };
  }
}

// Define types for dash.js player
interface DashPlayer {
  initialize: (videoElement: HTMLVideoElement, url: string, autoPlay: boolean) => void;
  destroy: () => void;
  play: () => void;
  pause: () => void;
  setMute: (muted: boolean) => void;
  on: (event: string, callback: (e?: any) => void) => void;
  updateSettings: (settings: any) => void;
}

interface VideoSources {
  video: string;
  dashUrl?: string;
}

interface RedditVideoEmbedProps {
  video: Video;
  onLoad?: () => void;
  onError?: () => void;
  autoplay?: boolean;
  muted?: boolean;
  controls?: boolean;
  loop?: boolean;
  onClick?: () => void;
}

// Available video resolutions to try in order (moderate to low quality)
// Start with a moderate resolution (480p) instead of highest (720p) to reduce initial load failures
const VIDEO_RESOLUTIONS = ['480', '360', '240', '144', '96'];

// Increased attempt limit to allow for more resolution options
const MAX_TOTAL_ATTEMPTS = 3;

// Delay in ms between resolution switch attempts to avoid rapid switching
const RESOLUTION_SWITCH_DELAY = 1500;


const VideoContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  width: '100%',
  height: '100%',
  overflow: 'hidden',
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
  borderRadius: '4px',
}));

const StyledVideo = styled('video')(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  objectPosition: 'center',
  zIndex: 1,
  backgroundColor: '#000', // Add black background
}));

const VideoOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.3)',
  opacity: 0,
  transition: 'opacity 0.3s ease',
  '&:hover': {
    opacity: 1,
  },
}));

const PlayButton = styled(Box)(({ theme }) => ({
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  borderRadius: '50%',
  width: '40px',
  height: '40px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  [theme.breakpoints.down('sm')]: {
    width: '30px',
    height: '30px',
  },
}));

const MutedIndicator = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: '8px',
  right: '8px',
  backgroundColor: 'rgba(0, 0, 0, 0.6)',
  borderRadius: '50%',
  width: '24px',
  height: '24px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  [theme.breakpoints.down('sm')]: {
    width: '20px',
    height: '20px',
  },
}));

const LoadingOverlay = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'rgba(0, 0, 0, 0.2)',
}));

const RedditVideoEmbed: React.FC<RedditVideoEmbedProps> = ({
  video,
  onLoad,
  onError,
  autoplay = false,
  muted = true,
  controls = false,
  loop = true,
  onClick,
}) => {
  // Core state
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(muted);
  const [errorMessage, setErrorMessage] = useState('');
  
  // Video resolution tracking
  const [currentResolutionIndex, setCurrentResolutionIndex] = useState(0);
  const [hasAttemptedAllResolutions, setHasAttemptedAllResolutions] = useState(false);
  const totalAttemptsRef = useRef(0);
  
  // Video sources state
  const [videoSources, setVideoSources] = useState<VideoSources | null>(null);
  const [dashInitialized, setDashInitialized] = useState(false);
  
  // DOM refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const dashPlayerRef = useRef<DashPlayer | null>(null);
  const dashScriptLoadedRef = useRef<boolean>(false);

  // Extract video sources from Reddit video data
  const getVideoSources = (video: Video): VideoSources | null => {
    try {
      if (!video.secure_media || !video.secure_media.reddit_video) {
        // Fallback to using videoUrl directly if secure_media is not available
        return { video: video.videoUrl };
      }

      const redditVideo = video.secure_media.reddit_video;
      const videoUrl = redditVideo.fallback_url || '';
      const dashUrl = redditVideo.dash_url || '';

      return {
        video: videoUrl,
        dashUrl: dashUrl || undefined
      };
    } catch (error) {
      console.error('Error extracting video sources:', error);
      // Fallback to using videoUrl directly on error
      return { video: video.videoUrl };
    }
  };

  // Extract Reddit video ID from URL
  const getRedditVideoId = (url: string): string | null => {
    if (!url) return null;
    
    // Try to extract Reddit video ID from URL
    // Handle multiple Reddit URL formats
    let videoId = null;
    
    // Format: https://v.redd.it/{id}/DASH_720.mp4
    let match = url.match(/v\.redd\.it\/([a-zA-Z0-9]+)(?:\/|$)/i);
    if (match && match[1]) {
      videoId = match[1];
      return videoId;
    }
    
    // Check if we have a redditId directly in the video object
    if (video.redditId) {
      return video.redditId;
    }
    
    return null;
  };

  // Get fallback video URL for different resolutions when dash.js fails
  const getFallbackVideoUrl = (videoUrl: string): string => {
    // If we've already tried all resolutions or exceeded max attempts, don't try again
    if (hasAttemptedAllResolutions || totalAttemptsRef.current >= MAX_TOTAL_ATTEMPTS) {
      return ''; // Empty URL will trigger error
    }
    
    const videoId = getRedditVideoId(videoUrl);
    
    if (videoId) {
      // Increment total attempts counter
      totalAttemptsRef.current += 1;
      
      // Get the current resolution to try based on index
      const resolution = VIDEO_RESOLUTIONS[currentResolutionIndex];
      
      // If this is the last resolution, mark that we've tried all
      if (currentResolutionIndex === VIDEO_RESOLUTIONS.length - 1) {
        setHasAttemptedAllResolutions(true);
      }
      
      return `https://v.redd.it/${videoId}/DASH_${resolution}.mp4`;
    }
    
    // For non-Reddit videos, just return the original URL
    return videoUrl;
  };

  // Setup intersection observer for lazy loading
  useEffect(() => {
    if (!containerRef.current) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        setIsInView(entry.isIntersecting);
      },
      // Reduced rootMargin to prevent preloading videos that are far from viewport
      { rootMargin: '50px', threshold: 0.1 }
    );

    observerRef.current.observe(containerRef.current);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, []);

  // Handle video loaded event
  const handleVideoLoaded = () => {
    setIsLoading(false);
    if (onLoad) onLoad();
  };
  
  // Load dash.js script dynamically
  const loadDashScript = () => {
    if (dashScriptLoadedRef.current || typeof window === 'undefined') return;
    
    const script = document.createElement('script');
    script.src = 'https://cdn.dashjs.org/v4.5.0/dash.all.min.js';
    script.async = true;
    script.onload = () => {
      dashScriptLoadedRef.current = true;
      initializeDashPlayer();
    };
    script.onerror = (error) => {
      console.error('Error loading dash.js script:', error);
      setIsError(true);
      setErrorMessage('Failed to load video player');
      setIsLoading(false);
    };
    
    document.body.appendChild(script);
  };
  
  // Initialize dash.js player
  const initializeDashPlayer = () => {
    if (!videoRef.current || !videoSources?.dashUrl || !window.dashjs) return;
    
    try {
      // Clean up existing player if it exists
      if (dashPlayerRef.current) {
        dashPlayerRef.current.destroy();
        dashPlayerRef.current = null;
      }
      
      // Create new player
      const player = window.dashjs.MediaPlayer().create();
      dashPlayerRef.current = player;
      
      // Set up player event listeners
      player.on('error', (e: any) => {
        console.error('dash.js player error:', e);
        setIsError(true);
        setErrorMessage('Video playback error');
        setIsLoading(false);
      });
      
      player.on('canPlay', () => {
        setIsLoading(false);
        if (onLoad) onLoad();
        
        if (autoplay && isInView) {
          player.play();
          setIsPlaying(true);
        }
      });
      
      // Initialize player with DASH manifest URL
      player.initialize(videoRef.current, videoSources.dashUrl, false);
      player.setMute(isMuted);
      
      // Update settings for better performance
      player.updateSettings({
        streaming: {
          fastSwitchEnabled: true,
          abr: {
            autoSwitchBitrate: {
              video: true,
              audio: true
            }
          }
        }
      });
      
      setDashInitialized(true);
    } catch (error) {
      console.error('Error initializing dash.js player:', error);
      setIsError(true);
      setErrorMessage('Failed to initialize video player');
      setIsLoading(false);
    }
  };

  const handleLoadedData = () => {
    setIsLoading(false);
    if (onLoad) onLoad();
  };

  const handleError = (e: React.SyntheticEvent<HTMLVideoElement, Event>) => {
    console.error('Video loading error for URL:', video.videoUrl);
    
    // If dash.js is initialized, let it handle errors
    if (dashInitialized) {
      setIsLoading(false);
      setIsError(true);
      setErrorMessage(`Unable to play video: dash.js player error`);
      if (onError) onError();
      return;
    }
    
    // If we've already tried all resolutions or reached max attempts, show error
    if (hasAttemptedAllResolutions || totalAttemptsRef.current >= MAX_TOTAL_ATTEMPTS) {
      setIsLoading(false);
      setIsError(true);
      setErrorMessage(`Unable to play video after trying all quality levels`);
      if (onError) onError();
      return;
    }
    
    // Try the next resolution with a delay to avoid aggressive switching
    const nextIndex = currentResolutionIndex + 1;
    
    // Check if we have more resolutions to try
    if (nextIndex < VIDEO_RESOLUTIONS.length) {
      // Set loading state during the delay
      setIsLoading(true);
      
      // Add a delay before trying the next resolution to avoid aggressive switching
      setTimeout(() => {
        setCurrentResolutionIndex(nextIndex);
        
        // Get fallback URL with the next resolution
        const fallbackUrl = getFallbackVideoUrl(video.videoUrl);
        
        // Only attempt to load if we have a valid source
        if (fallbackUrl && videoRef.current) {
          videoRef.current.src = fallbackUrl;
          videoRef.current.load();
        }
      }, RESOLUTION_SWITCH_DELAY);
      return;
    } else {
      // No more resolutions to try
      setHasAttemptedAllResolutions(true);
    }
    
    // If we've tried all resolutions or something else went wrong, show error
    console.error(`Failed to load video after trying ${totalAttemptsRef.current} attempts`);
    setErrorMessage(`Unable to play video after trying all quality levels`);
    setIsLoading(false);
    setIsError(true);
    if (onError) onError();
  };

  const handlePlayPause = () => {
    // If using dash.js player
    if (dashPlayerRef.current) {
      if (isPlaying) {
        dashPlayerRef.current.pause();
        setIsPlaying(false);
      } else {
        dashPlayerRef.current.play();
        setIsPlaying(true);
      }
      return;
    }
    
    // Fallback to standard HTML5 video
    if (!videoRef.current) return;

    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    
    // If using dash.js player
    if (dashPlayerRef.current) {
      dashPlayerRef.current.setMute(newMutedState);
      return;
    }
    
    // Fallback to standard HTML5 video
    if (videoRef.current) {
      videoRef.current.muted = newMutedState;
    }
  };
  
  // Initialize video sources and dash.js when component mounts or video changes
  useEffect(() => {
    // Reset state when video changes
    setIsLoading(true);
    setIsError(false);
    setErrorMessage('');
    setCurrentResolutionIndex(0);
    setHasAttemptedAllResolutions(false);
    totalAttemptsRef.current = 0;
    
    // Only load video sources when the video is actually in view
    if (isInView) {
      // Get video sources from video data
      const sources = getVideoSources(video);
      setVideoSources(sources);
      
      // Clean up any existing dash player
      if (dashPlayerRef.current) {
        dashPlayerRef.current.destroy();
        dashPlayerRef.current = null;
        setDashInitialized(false);
      }
      
      // If we have a DASH URL, load dash.js script
      if (sources?.dashUrl && typeof window !== 'undefined') {
        if (window.dashjs) {
          // If dash.js is already loaded, initialize player
          dashScriptLoadedRef.current = true;
          initializeDashPlayer();
        } else {
          // Otherwise load dash.js script
          loadDashScript();
        }
      }
    } else {
      // If not in view, don't load anything yet
      setIsLoading(false);
    }
    
    // Clean up on unmount
    return () => {
      if (dashPlayerRef.current) {
        dashPlayerRef.current.destroy();
        dashPlayerRef.current = null;
      }
    };
  }, [video.id, isInView]); // Re-run when video ID changes or when visibility changes

  return (
    <VideoContainer ref={containerRef}>
      <video
        ref={videoRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: isLoading || isError ? 'none' : 'block',
          opacity: isLoading ? 0 : 1,
          transition: 'opacity 0.3s ease-in-out',
        }}
        preload="none" /* Changed from 'auto' to 'none' to prevent preloading */
        playsInline
        autoPlay={false} /* Disabled autoplay to prevent automatic loading */
        muted={isMuted}
        loop={loop}
        controls={controls}
        onLoadedData={handleLoadedData}
        onError={handleError}
        onClick={handlePlayPause}
      />

      {isLoading && (
        <LoadingOverlay>
          <CircularProgress size={40} />
        </LoadingOverlay>
      )}

      {isError && (
        <LoadingOverlay>
          <Box display="flex" flexDirection="column" alignItems="center">
            <ErrorOutlineIcon style={{ fontSize: 40, color: 'red', marginBottom: '8px' }} />
            <Typography variant="body2" color="error">
              {errorMessage || 'Error loading video'}
            </Typography>
          </Box>
        </LoadingOverlay>
      )}

      {!isLoading && !isError && !controls && (
        <VideoOverlay onClick={onClick || handlePlayPause}>
          <PlayButton>
            {isPlaying ? null : <PlayArrowIcon />}
          </PlayButton>
          <MutedIndicator onClick={(e) => { e.stopPropagation(); toggleMute(); }}>
            {isMuted ? <VolumeOffIcon fontSize="small" /> : <VolumeUpIcon fontSize="small" />}
          </MutedIndicator>
        </VideoOverlay>
      )}

      {!isInView && video.thumbnailUrl && (
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
          loading="lazy"
        />
      )}

      {isError && (
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            padding: 2,
            textAlign: 'center',
          }}
        >
          <ErrorOutlineIcon sx={{ fontSize: 40, mb: 1 }} />
          <Typography variant="body2">
            {errorMessage || 'Video playback error'}
          </Typography>
        </Box>
      )}
    </VideoContainer>
  );
};

export default RedditVideoEmbed;
