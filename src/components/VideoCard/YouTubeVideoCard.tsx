import React, { useState } from 'react';
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
}

const YouTubeVideoCard: React.FC<YouTubeVideoCardProps> = ({
  video,
  onVideoClick,
  isLoading = false,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
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
        <Box sx={{ position: 'relative', paddingTop: '177.78%' }}>
          <Skeleton
            variant="rectangular"
            width="100%"
            height="100%"
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
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
        }}
        onClick={() => onVideoClick(video)}
      >
        <Box sx={{ position: 'relative', paddingTop: '177.78%' }}>
          {!imageLoaded && (
            <Skeleton
              variant="rectangular"
              width="100%"
              height="100%"
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
              }}
            />
          )}
          <CardMedia
            component="img"
            image={
              imageError
                ? 'https://via.placeholder.com/400x225/1a1a1a/ffffff?text=YouTube+Video'
                : video.thumbnailUrl
            }
            alt={video.title}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: imageLoaded ? 'block' : 'none',
            }}
            onLoad={handleImageLoad}
            onError={handleImageError}
          />
          
          {/* Play button overlay */}
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

        <CardContent sx={{ flexGrow: 1, p: 1, '&:last-child': { pb: 1 } }}>
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