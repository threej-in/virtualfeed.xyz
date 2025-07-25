import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Chip,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Close as CloseIcon,
  YouTube as YouTubeIcon,
  Visibility as ViewIcon,
  ThumbUp as LikeIcon,
  Share as ShareIcon,
  OpenInNew as OpenInNewIcon,
} from '@mui/icons-material';
import { Video } from '../../types/Video';
import { getVideoTags } from '../../utils/videoUtils';

interface YouTubeVideoPlayerProps {
  video: Video | null;
  open: boolean;
  onClose: () => void;
}

const YouTubeVideoPlayer: React.FC<YouTubeVideoPlayerProps> = ({
  video,
  open,
  onClose,
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (video && open) {
      setIsLoading(true);
    }
  }, [video, open]);

  const handleIframeLoad = () => {
    setIsLoading(false);
  };

  const handleClose = () => {
    onClose();
  };

  const handleOpenYouTube = () => {
    if (video?.videoUrl) {
      window.open(video.videoUrl, '_blank');
    }
  };

  const handleShare = async () => {
    if (video?.videoUrl && navigator.share) {
      try {
        await navigator.share({
          title: video.title,
          text: video.description,
          url: video.videoUrl,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else if (video?.videoUrl) {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(video.videoUrl);
        // You could show a toast notification here
      } catch (error) {
        console.log('Error copying to clipboard:', error);
      }
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  if (!video) return null;

  // Extract YouTube video ID from URL
  const getYouTubeEmbedUrl = (url: string): string => {
    const videoId = video.metadata?.youtubeId || url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;
    }
    return url;
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="lg"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'rgba(0, 0, 0, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: 2,
          maxHeight: '90vh',
        },
      }}
    >
      <DialogContent sx={{ p: 0, position: 'relative' }}>
        {/* Close button */}
        <IconButton
          onClick={handleClose}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            '&:hover': {
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
            },
          }}
        >
          <CloseIcon />
        </IconButton>

        {/* Video container */}
        <Box sx={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
          {isLoading && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                zIndex: 1,
              }}
            >
              <Typography variant="h6" sx={{ color: 'white' }}>
                Loading YouTube video...
              </Typography>
            </Box>
          )}
          
          <iframe
            ref={iframeRef}
            src={getYouTubeEmbedUrl(video.videoUrl)}
            title={video.title}
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={handleIframeLoad}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              border: 'none',
            }}
          />
        </Box>

        {/* Video details */}
        <Box sx={{ p: 3 }}>
          {/* Title and platform */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
            <Box sx={{ flex: 1 }}>
              <Typography
                variant="h5"
                sx={{
                  color: 'white',
                  fontWeight: 600,
                  mb: 1,
                  lineHeight: 1.3,
                }}
              >
                {video.title}
              </Typography>
              
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <YouTubeIcon sx={{ color: '#FF0000', fontSize: 20 }} />
                <Typography
                  variant="body2"
                  sx={{ color: 'rgba(255, 255, 255, 0.7)' }}
                >
                  YouTube Short
                </Typography>
              </Box>
            </Box>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Tooltip title="Open on YouTube">
                <IconButton
                  onClick={handleOpenYouTube}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    },
                  }}
                >
                  <OpenInNewIcon />
                </IconButton>
              </Tooltip>
              
              <Tooltip title="Share">
                <IconButton
                  onClick={handleShare}
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'white',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    },
                  }}
                >
                  <ShareIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>

          {/* Stats */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <ViewIcon sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 18 }} />
              <Typography
                variant="body2"
                sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
              >
                {formatNumber(video.views)} views
              </Typography>
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <LikeIcon sx={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: 18 }} />
              <Typography
                variant="body2"
                sx={{ color: 'rgba(255, 255, 255, 0.6)' }}
              >
                {formatNumber(video.likes)} likes
              </Typography>
            </Box>
          </Box>

          {/* Description */}
          {video.description && (
            <Typography
              variant="body1"
              sx={{
                color: 'rgba(255, 255, 255, 0.8)',
                mb: 2,
                lineHeight: 1.6,
              }}
            >
              {video.description}
            </Typography>
          )}

          {/* Tags */}
          {getVideoTags(video).length > 0 && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {getVideoTags(video).map((tag, index) => (
                <Chip
                  key={index}
                  label={tag}
                  size="small"
                  sx={{
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    color: 'rgba(255, 255, 255, 0.8)',
                    '&:hover': {
                      backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    },
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

export default YouTubeVideoPlayer; 