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
  GitHub as GitHubIcon,
} from '@mui/icons-material';

interface SidebarProps {
  currentPlatform: string;
  onPlatformChange: (platform: string) => void;
  onVideoSubmission: () => void;
  isMobileDrawer?: boolean;
}

const StyledSidebar = styled(Box)(({ theme }) => ({
  width: 260,
  height: 'calc(100vh - 60px)', // Account for header height
  background: '#0f0f0f',
  borderRight: '1px solid rgba(255, 255, 255, 0.12)',
  backdropFilter: 'blur(25px)',
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(3),
  position: 'fixed',
  top: 60, // Account for header height
  left: 0,
  overflowY: 'auto',
  zIndex: 1000,
  boxShadow: '8px 0 30px rgba(0, 0, 0, 0.3)',
  '&::-webkit-scrollbar': {
    width: '8px',
  },
  '&::-webkit-scrollbar-track': {
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '4px',
  },
  '&::-webkit-scrollbar-thumb': {
    background: 'rgba(255, 255, 255, 0.22)',
    borderRadius: '4px',
    '&:hover': {
      background: 'rgba(255, 255, 255, 0.32)',
    },
  },
  // Mobile responsive styles - only apply when not in drawer
  '&.mobile-drawer': {
    width: '100%',
    height: 'auto',
    position: 'static',
    top: 'auto',
    borderRight: 'none',
    padding: 0,
    gap: theme.spacing(1.5),
    background: 'transparent',
    overflowY: 'visible',
    '& .platform-buttons': {
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
    },
    '& .platform-button': {
      height: 40,
      fontSize: '0.8rem',
      fontWeight: 600,
      borderRadius: 8,
      border: '1px solid rgba(255, 255, 255, 0.1)',
      background: 'rgba(255, 255, 255, 0.03)',
      backdropFilter: 'blur(10px)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      color: 'rgba(255, 255, 255, 0.9)',
      textTransform: 'none',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'flex-start',
      '&:hover': {
        background: 'rgba(255, 255, 255, 0.08)',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        transform: 'translateY(-1px)',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.2)',
        color: 'white',
      },
      '&.active': {
        background: 'linear-gradient(135deg, rgba(108, 99, 255, 0.2), rgba(255, 101, 132, 0.2))',
        borderColor: 'rgba(108, 99, 255, 0.4)',
        boxShadow: '0 4px 15px rgba(108, 99, 255, 0.3)',
        color: 'white',
      },
      '& .MuiButton-startIcon': {
        marginRight: '8px',
        fontSize: '1.1rem',
      },
    },
    '& .submit-section': {
      background: 'rgba(255, 255, 255, 0.03)',
      borderRadius: 10,
      padding: theme.spacing(1.5),
      border: '1px solid rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(10px)',
    },
    '& .stats-section': {
      background: 'rgba(255, 255, 255, 0.02)',
      borderRadius: 10,
      padding: theme.spacing(1.5),
      border: '1px solid rgba(255, 255, 255, 0.08)',
      backdropFilter: 'blur(10px)',
    },
  },
}));

const PlatformButton = styled(Button, {
  shouldForwardProp: (prop) => prop !== '$active'
})<{ $active?: boolean }>(({ theme, $active }) => ({
  width: '100%',
  height: 44,
  borderRadius: 12,
  background: $active 
    ? 'rgba(255, 0, 0, 0.16)'
    : 'rgba(255, 255, 255, 0.03)',
  border: $active 
    ? '2px solid rgba(255, 0, 0, 0.42)'
    : '1px solid rgba(255, 255, 255, 0.1)',
  color: $active ? 'white' : 'rgba(255, 255, 255, 0.7)',
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.9rem',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  backdropFilter: 'blur(10px)',
  '&:hover': {
    background: $active 
      ? 'rgba(255, 0, 0, 0.2)'
      : 'rgba(255, 255, 255, 0.08)',
    borderColor: $active ? 'rgba(255, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.2)',
    transform: 'translateY(-2px)',
    boxShadow: $active 
      ? '0 8px 25px rgba(255, 0, 0, 0.2)'
      : '0 4px 15px rgba(0, 0, 0, 0.2)',
  },
  '&::before': $active ? {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(255, 0, 0, 0.08)',
    borderRadius: 12,
    zIndex: -1,
  } : {},
  '& .MuiButton-startIcon': {
    marginRight: theme.spacing(1.5),
    fontSize: '1.4rem',
  },
  // Mobile responsive styles
  [theme.breakpoints.down('md')]: {
    height: 40,
    fontSize: '0.85rem',
    borderRadius: 10,
    '& .MuiButton-startIcon': {
      marginRight: theme.spacing(1),
      fontSize: '1.2rem',
    },
  },
}));

const SubmitButton = styled(Button)(({ theme }) => ({
  width: '100%',
  height: 44,
  borderRadius: 12,
  background: 'linear-gradient(135deg, #cc0000, #ff0000)',
  color: 'white',
  textTransform: 'none',
  fontWeight: 700,
  fontSize: '1rem',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  backdropFilter: 'blur(10px)',
  '&:hover': {
    background: 'linear-gradient(135deg, #b30000, #e60000)',
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 25px rgba(255, 0, 0, 0.35)',
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
    borderRadius: 12,
    zIndex: -1,
  },
  '& .MuiButton-startIcon': {
    marginRight: theme.spacing(1.5),
    fontSize: '1.4rem',
  },
  // Mobile responsive styles
  [theme.breakpoints.down('md')]: {
    height: 40,
    fontSize: '0.9rem',
    borderRadius: 10,
    '& .MuiButton-startIcon': {
      marginRight: theme.spacing(1),
      fontSize: '1.2rem',
    },
  },
}));

const GitHubButton = styled(Button)(({ theme }) => ({
  width: '100%',
  height: 44,
  borderRadius: 12,
  background: 'linear-gradient(135deg, #24292e, #586069)',
  color: 'white',
  textTransform: 'none',
  fontWeight: 700,
  fontSize: '1rem',
  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  position: 'relative',
  overflow: 'hidden',
  backdropFilter: 'blur(10px)',
  '&:hover': {
    background: 'linear-gradient(135deg, #1b1f23, #4a5568)',
    transform: 'translateY(-2px)',
    boxShadow: '0 8px 25px rgba(36, 41, 46, 0.4)',
  },
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.05))',
    borderRadius: 12,
    zIndex: -1,
  },
  '& .MuiButton-startIcon': {
    marginRight: theme.spacing(1.5),
    fontSize: '1.4rem',
  },
  // Mobile responsive styles
  [theme.breakpoints.down('md')]: {
    height: 40,
    fontSize: '0.9rem',
    borderRadius: 10,
    '& .MuiButton-startIcon': {
      marginRight: theme.spacing(1),
      fontSize: '1.2rem',
    },
  },
}));

const Sidebar: React.FC<SidebarProps> = ({
  currentPlatform,
  onPlatformChange,
  onVideoSubmission,
  isMobileDrawer = false,
}) => {
  const theme = useTheme();

  return (
    <StyledSidebar className={isMobileDrawer ? 'mobile-drawer' : ''}>
      {/* Platform Selection */}
      <Box className="platform-buttons" sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: 1.5,
        mb: 2
      }}>        
        <PlatformButton
          variant="outlined"
          startIcon={<TrendingIcon sx={{ color: '#6c63ff' }} />}
          onClick={() => onPlatformChange('')}
          $active={currentPlatform === ''}
          className={currentPlatform === '' ? 'platform-button active' : 'platform-button'}
        >
          All Videos
        </PlatformButton>
        
        <PlatformButton
          variant="outlined"
          startIcon={<RedditIcon sx={{ color: '#FF4500' }} />}
          onClick={() => onPlatformChange('reddit')}
          $active={currentPlatform === 'reddit'}
          className={currentPlatform === 'reddit' ? 'platform-button active' : 'platform-button'}
        >
          Reddit Videos
        </PlatformButton>
        
        <PlatformButton
          variant="outlined"
          startIcon={<YouTubeIcon sx={{ color: '#FF0000' }} />}
          onClick={() => onPlatformChange('youtube')}
          $active={currentPlatform === 'youtube'}
          className={currentPlatform === 'youtube' ? 'platform-button active' : 'platform-button'}
        >
          YouTube
        </PlatformButton>
      </Box>

      <Divider sx={{ 
        borderColor: 'rgba(108, 99, 255, 0.2)', 
        my: 0.5,
        borderWidth: '1px'
      }} />

             {/* Contribute Section */}
       <Box className="submit-section" sx={{
         mb: 2
       }}>
                   <Typography
            variant="subtitle2"
            sx={{
              color: 'rgba(255, 255, 255, 0.9)',
              fontWeight: 700,
              mb: 2,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontSize: { xs: '0.75rem', md: '0.75rem' },
            }}
          >
            Contribute
          </Typography>
         
         <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
           <SubmitButton
             variant="contained"
             startIcon={<AddIcon sx={{ fontSize: { xs: '1.25rem', md: '1rem' } }} />}
             onClick={onVideoSubmission}
                           sx={{
                width: '100%',
                height: { xs: 40, md: 40 },
                fontSize: { xs: '0.8rem', md: '0.9rem' },
                fontWeight: 600,
                borderRadius: { xs: 8, md: 10 },
                background: 'linear-gradient(135deg, #6c63ff, #ff6584)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #5a52d5, #e55a75)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(108, 99, 255, 0.4)',
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
           >
             Submit Video
           </SubmitButton>
           
           <GitHubButton
             variant="contained"
             startIcon={<GitHubIcon sx={{ fontSize: { xs: '1.25rem', md: '1rem' } }} />}
             onClick={() => window.open('https://github.com/threej-in/virtualfeed.xyz', '_blank')}
                           sx={{
                width: '100%',
                height: { xs: 40, md: 40 },
                fontSize: { xs: '0.8rem', md: '0.9rem' },
                fontWeight: 600,
                borderRadius: { xs: 8, md: 10 },
                background: 'linear-gradient(135deg, #24292e, #586069)',
                '&:hover': {
                  background: 'linear-gradient(135deg, #1b1f23, #4a5568)',
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 25px rgba(36, 41, 46, 0.4)',
                },
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              }}
           >
             GitHub
           </GitHubButton>
         </Box>
       </Box>

      {/* Stats or Info */}
      <Box sx={{ mt: 'auto', pt: 2 }} className="stats-section">
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            background: 'rgba(255, 255, 255, 0.01)',
            border: '1px solid rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <TrendingIcon sx={{ 
              color: '#6c63ff', 
              fontSize: { xs: 24, md: 20 }, 
              mr: 1.5 
            }} />
                         <Typography
               variant="subtitle2"
               sx={{
                 color: 'rgba(255, 255, 255, 0.9)',
                 fontWeight: 700,
                 fontSize: { xs: '0.8rem', md: '0.875rem' },
               }}
             >
               Trending Now
             </Typography>
          </Box>
                     <Typography
             variant="body2"
             sx={{
               color: 'rgba(255, 255, 255, 0.7)',
               lineHeight: 1.5,
               fontSize: { xs: '0.7rem', md: '0.75rem' },
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
