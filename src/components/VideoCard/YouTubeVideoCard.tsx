import React, { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardMedia,
  Typography,
  Chip,
  Box,
  IconButton,
  Tooltip,
  Skeleton,
  CircularProgress,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  YouTube as YouTubeIcon,
  Visibility as ViewIcon,
  ThumbUp as LikeIcon,
} from '@mui/icons-material';
import { motion } from 'framer-motion';
import { Video } from '../../types/Video';
import { getVideoTags, getVideoTagsSlice, getVideoTagsCount } from '../../utils/videoUtils';

interface YouTubeVideoCardProps {
  video: Video;
  onVideoClick: (video: Video) => void;
  isLoading?: boolean;
  isPlaying?: boolean;
  isFocused?: boolean;
  isLargeDevice?: boolean;
  onHoverStart?: () => void;
  onHoverEnd?: () => void;
}

const YouTubeVideoCard: React.FC<YouTubeVideoCardProps> = ({
  video,
  onVideoClick,
  isLoading = false,
  isPlaying = false,
  isFocused = false,
  isLargeDevice = false,
  onHoverStart,
  onHoverEnd,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [videoLoading, setVideoLoading] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  const handleVideoLoadStart = () => {
    setVideoLoading(true);
  };

  const handleVideoLoad = () => {
    setVideoLoading(false);
  };

  // Set video loading state when video starts playing
  useEffect(() => {
    if (isPlaying) {
      setVideoLoading(true);
    } else {
      setVideoLoading(false);
    }
  }, [isPlaying]);

  // Function to get the best quality thumbnail
  const getBestThumbnail = (video: Video): string => {
    if (!video.thumbnailUrl) return '';
    
    // If it's already a high-quality thumbnail, use it
    if (video.thumbnailUrl.includes('maxres') || video.thumbnailUrl.includes('hq')) {
      return video.thumbnailUrl;
    }
    
    // Try to get maxres thumbnail by replacing URL parts
    const url = video.thumbnailUrl;
    if (url.includes('default.jpg')) {
      return url.replace('default.jpg', 'maxresdefault.jpg');
    }
    if (url.includes('mqdefault.jpg')) {
      return url.replace('mqdefault.jpg', 'maxresdefault.jpg');
    }
    if (url.includes('hqdefault.jpg')) {
      return url.replace('hqdefault.jpg', 'maxresdefault.jpg');
    }
    
    return video.thumbnailUrl;
  };

  // Function to get YouTube embed URL
  const getYouTubeEmbedUrl = (video: Video): string => {
    const videoId = video.metadata?.youtubeId || video.videoUrl?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
    if (videoId) {
      const muteParam = isLargeDevice ? '0' : '1';
      return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&mute=${muteParam}&playsinline=1&rel=0&modestbranding=1&controls=0&iv_load_policy=3&fs=0&disablekb=1&loop=1&playlist=${videoId}`;
    }
    return video.videoUrl || '';
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const truncateTitle = (title: string, maxLength: number = 60): string => {
    if (title.length <= maxLength) return title;
    return title.substring(0, maxLength) + '...';
  };

  if (isLoading) {
    return (
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3)',
          },
        }}
      >
        <Box sx={{ 
          position: 'relative', 
          paddingTop: '177.78%',
          // Ensure consistent dimensions
          width: '100%',
          height: 0,
          overflow: 'hidden',
          // Mobile: full height
          '@media (max-width: 600px)': {
            paddingTop: '100vh',
            height: 'calc(100vh - 80px)',
          },
        }}>
          <Skeleton
            variant="rectangular"
            width="100%"
            height="100%"
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              // Ensure skeleton maintains same aspect ratio
              aspectRatio: '9/16',
              minHeight: '100%',
              minWidth: '100%',
            }}
          />
        </Box>
        <CardContent sx={{ flexGrow: 1, p: 2 }}>
          <Skeleton variant="text" width="80%" height={24} />
          <Skeleton variant="text" width="60%" height={20} />
          <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
            <Skeleton variant="rectangular" width={60} height={24} />
            <Skeleton variant="rectangular" width={80} height={24} />
          </Box>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
    >
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          cursor: 'pointer',
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 25px rgba(0, 0, 0, 0.3)',
          },
          // Mobile TikTok-like styling
          '@media (max-width: 600px)': {
            borderRadius: 0,
            height: 'auto',
            minHeight: 'calc(100vh - 80px)',
            '&:hover': {
              transform: 'none',
              boxShadow: 'none'
            },
          },
        }}
        onClick={() => onVideoClick(video)}
        onMouseEnter={() => {
          if (isLargeDevice) onHoverStart?.();
        }}
        onMouseLeave={() => {
          if (isLargeDevice) onHoverEnd?.();
        }}
      >
        <Box sx={{ 
          position: 'relative', 
          paddingTop: '177.78%',
          // Ensure consistent dimensions
          width: '100%',
          height: 0,
          overflow: 'hidden',
          // Mobile: full height
          '@media (max-width: 600px)': {
            paddingTop: '100vh',
            height: 'calc(100vh - 80px)',
          },
        }}>
          {!imageLoaded && !isPlaying && (
            <Skeleton
              variant="rectangular"
              width="100%"
              height="100%"
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                // Ensure skeleton maintains same aspect ratio
                aspectRatio: '9/16',
                minHeight: '100%',
                minWidth: '100%',
              }}
            />
          )}
          
          {/* Show embedded video when playing */}
          {isPlaying ? (
            <>
              {/* Show thumbnail while video is loading */}
              {videoLoading && (
                <CardMedia
                  component="img"
                  image={
                    imageError
                      ? 'https://via.placeholder.com/400x720/1a1a1a/ffffff?text=YouTube+Video'
                      : getBestThumbnail(video)
                  }
                  alt={video.title}
                  sx={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    objectPosition: 'center',
                    display: imageLoaded ? 'block' : 'none',
                    minHeight: '100%',
                    minWidth: '100%',
                    aspectRatio: '9/16',
                    '& img': {
                      objectFit: 'cover',
                      objectPosition: 'center',
                    },
                  }}
                  onLoad={handleImageLoad}
                  onError={handleImageError}
                />
              )}
              
              {/* Loading overlay */}
              {videoLoading && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    backgroundColor: 'rgba(0, 0, 0, 0.7)',
                    borderRadius: '50%',
                    width: 60,
                    height: 60,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 2,
                  }}
                >
                  <CircularProgress size={30} sx={{ color: 'white' }} />
                </Box>
              )}
              
              {/* YouTube iframe */}
              <Box
                component="iframe"
                src={getYouTubeEmbedUrl(video)}
                title={video.title}
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                onLoad={handleVideoLoad}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  maxHeight: '100%',
                  border: 'none',
                  borderRadius: 'inherit',
                  opacity: videoLoading ? 0 : 1,
                  transition: 'opacity 0.3s ease-in-out',
                }}
              />
            </>
          ) : (
            <CardMedia
              component="img"
              image={
                imageError
                  ? 'https://via.placeholder.com/400x720/1a1a1a/ffffff?text=YouTube+Video'
                  : getBestThumbnail(video)
              }
              alt={video.title}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
                display: imageLoaded ? 'block' : 'none',
                // Ensure consistent aspect ratio and prevent layout shifts
                minHeight: '100%',
                minWidth: '100%',
                // Force aspect ratio consistency
                aspectRatio: '9/16',
                // Prevent image distortion
                '& img': {
                  objectFit: 'cover',
                  objectPosition: 'center',
                },
              }}
              onLoad={handleImageLoad}
              onError={handleImageError}
            />
          )}
          
          {/* Play button overlay - only show when not playing */}
          {!isPlaying && (
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                backgroundColor: 'rgba(0, 0, 0, 0.7)',
                borderRadius: '50%',
                width: 60,
                height: 60,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: 0,
                transition: 'opacity 0.2s ease-in-out',
                '&:hover': {
                  opacity: 1,
                },
              }}
            >
              <PlayIcon sx={{ color: 'white', fontSize: 30 }} />
            </Box>
          )}

          {/* Focus indicator - shows when video is in viewport center (only on mobile) */}
          {isFocused && !isPlaying && !isLargeDevice && (
            <Box
              sx={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                backgroundColor: 'rgba(0, 255, 0, 0.8)',
                borderRadius: '50%',
                width: 12,
                height: 12,
                animation: 'pulse 2s infinite',
                '@keyframes pulse': {
                  '0%': {
                    transform: 'scale(1)',
                    opacity: 1,
                  },
                  '50%': {
                    transform: 'scale(1.2)',
                    opacity: 0.7,
                  },
                  '100%': {
                    transform: 'scale(1)',
                    opacity: 1,
                  },
                },
              }}
            />
          )}

          {/* Stats overlay */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.7))',
              padding: '8px',
              borderRadius: '4px',
            }}
          >
            {/* Views and Likes */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <ViewIcon sx={{ 
                  fontSize: 14, 
                  color: 'white',
                  mr: 0.5,
                  opacity: 0.9
                }} />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontSize: '0.7rem',
                    color: 'white',
                    fontWeight: 500
                  }}
                >
                  {formatNumber(video.views)}
                </Typography>
              </Box>
              
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <LikeIcon sx={{ 
                  fontSize: 14, 
                  color: 'white',
                  mr: 0.5,
                  opacity: 0.9
                }} />
                <Typography 
                  variant="caption" 
                  sx={{ 
                    fontSize: '0.7rem',
                    color: 'white',
                    fontWeight: 500
                  }}
                >
                  {formatNumber(video.likes)}
                </Typography>
              </Box>
            </Box>
            
            {/* Platform indicator */}
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <YouTubeIcon sx={{ 
                fontSize: 14, 
                color: '#FF0000',
                mr: 0.5,
                opacity: 0.9
              }} />
              <Typography 
                variant="caption" 
                sx={{ 
                  fontSize: '0.7rem',
                  color: 'white',
                  fontWeight: 500
                }}
              >
                YouTube
              </Typography>
            </Box>
          </Box>
        </Box>

        <CardContent sx={{ 
          flexGrow: 1, 
          p: 1, 
          '&:last-child': { pb: 1 },
          // Mobile: hide content area for TikTok-like experience
          '@media (max-width: 600px)': {
            display: 'none',
          }
        }}>
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255, 255, 255, 0.7)',
              fontSize: '0.875rem',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {truncateTitle(video.title)}
          </Typography>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default YouTubeVideoCard; 
