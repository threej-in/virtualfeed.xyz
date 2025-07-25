import React from 'react';
import {
  Box,
  Typography,
  Button,
  Divider,
  styled,
  useTheme,
} from '@mui/material';
import {
  Reddit as RedditIcon,
  YouTube as YouTubeIcon,
  Add as AddIcon,
  TrendingUp as TrendingIcon,
} from '@mui/icons-material';

interface SidebarProps {
  currentPlatform: string;
  onPlatformChange: (platform: string) => void;
  onVideoSubmission: () => void;
}

const StyledSidebar = styled(Box)(({ theme }) => ({
  width: 250,
  height: 'calc(100vh - 50px)', // Subtract header height
  background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%)',
  borderRight: '1px solid rgba(255, 255, 255, 0.1)',
  backdropFilter: 'blur(20px)',
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  position: 'fixed',
  top: 58, // Account for header height
  overflowY: 'auto',
  '&::-webkit-scrollbar': {
    width: '6px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '3px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(255, 255, 255, 0.2)',
    borderRadius: '3px',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.3)',
    },
  },
}));

const PlatformButton = styled(Button)<{ active?: boolean }>(({ theme, active }) => ({
  width: '100%',
  height: 40,
  borderRadius: 10,
  background: active 
    ? 'linear-gradient(135deg, rgba(108, 99, 255, 0.2), rgba(255, 101, 132, 0.2))'
    : 'rgba(255, 255, 255, 0.03)',
  border: active 
    ? '2px solid rgba(108, 99, 255, 0.4)'
    : '1px solid rgba(255, 255, 255, 0.1)',
  color: active ? 'white' : 'rgba(255, 255, 255, 0.7)',
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.9rem',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  '&:hover': {
    background: active 
      ? 'linear-gradient(135deg, rgba(108, 99, 255, 0.25), rgba(255, 101, 132, 0.25))'
      : 'rgba(255, 255, 255, 0.08)',
    borderColor: active ? 'rgba(108, 99, 255, 0.5)' : 'rgba(255, 255, 255, 0.2)',
    transform: 'translateY(-2px)',
    boxShadow: active 
      ? '0 8px 25px rgba(108, 99, 255, 0.3)'
      : '0 4px 15px rgba(0, 0, 0, 0.2)',
  },
  '&::before': active ? {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, rgba(108, 99, 255, 0.1), rgba(255, 101, 132, 0.1))',
    borderRadius: 14,
    zIndex: -1,
  } : {},
  '& .MuiButton-startIcon': {
    marginRight: theme.spacing(1.5),
    fontSize: '1.5rem',
  },
}));

const SubmitButton = styled(Button)(({ theme }) => ({
  width: '100%',
  height: 40,
  borderRadius: 10,
  background: 'linear-gradient(135deg, #6c63ff, #ff6584)',
  color: 'white',
  textTransform: 'none',
  fontWeight: 700,
  fontSize: '1rem',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  '&:hover': {
    background: 'linear-gradient(135deg, #5a52ff, #ff4d6a)',
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 25px rgba(108, 99, 255, 0.4)',
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
    borderRadius: 14,
    zIndex: -1,
  },
  '& .MuiButton-startIcon': {
    marginRight: theme.spacing(1.5),
    fontSize: '1.5rem',
  },
}));

const Sidebar: React.FC<SidebarProps> = ({
  currentPlatform,
  onPlatformChange,
  onVideoSubmission,
}) => {
  const theme = useTheme();

  return (
    <StyledSidebar>
      {/* Platform Selection */}
      <Box>        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <PlatformButton
            variant="outlined"
            startIcon={<RedditIcon sx={{ color: '#FF4500' }} />}
            onClick={() => onPlatformChange('reddit')}
            active={currentPlatform === 'reddit'}
          >
            Reddit Videos
          </PlatformButton>
          
          <PlatformButton
            variant="outlined"
            startIcon={<YouTubeIcon sx={{ color: '#FF0000' }} />}
            onClick={() => onPlatformChange('youtube')}
            active={currentPlatform === 'youtube'}
          >
            YouTube
          </PlatformButton>
        </Box>
      </Box>

      <Divider sx={{ borderColor: 'rgba(255, 255, 255, 0.1)' }} />

      {/* Submit Video */}
      <Box>
        <Typography
          variant="subtitle2"
          sx={{
            color: 'rgba(255, 255, 255, 0.8)',
            fontWeight: 600,
            mb: 2,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}
        >
          Contribute
        </Typography>
        
        <SubmitButton
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onVideoSubmission}
        >
          Submit Video
        </SubmitButton>
      </Box>

      {/* Stats or Info */}
      <Box sx={{ mt: 'auto', pt: 2 }}>
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <TrendingIcon sx={{ color: '#6c63ff', fontSize: 20, mr: 1 }} />
            <Typography
              variant="subtitle2"
              sx={{
                color: 'rgba(255, 255, 255, 0.8)',
                fontWeight: 600,
              }}
            >
              Trending Now
            </Typography>
          </Box>
          <Typography
            variant="body2"
            sx={{
              color: 'rgba(255, 255, 255, 0.6)',
              lineHeight: 1.4,
            }}
          >
            Discover the latest AI-generated videos from Reddit and YouTube
          </Typography>
        </Box>
      </Box>
    </StyledSidebar>
  );
};

export default Sidebar; 