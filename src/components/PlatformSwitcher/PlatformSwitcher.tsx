import React from 'react';
import {
  Box,
  Tabs,
  Tab,
  Typography,
  styled,
} from '@mui/material';
import {
  Reddit as RedditIcon,
  YouTube as YouTubeIcon,
} from '@mui/icons-material';

interface PlatformSwitcherProps {
  currentPlatform: string;
  onPlatformChange: (platform: string) => void;
}

const StyledTabs = styled(Tabs)(({ theme }) => ({
  '& .MuiTabs-indicator': {
    backgroundColor: 'transparent',
  },
  '& .MuiTabs-flexContainer': {
    gap: theme.spacing(1),
  },
}));

const StyledTab = styled(Tab)(({ theme }) => ({
  minHeight: 48,
  minWidth: 120,
  borderRadius: 12,
  backgroundColor: 'rgba(255, 255, 255, 0.03)',
  border: '1px solid rgba(255, 255, 255, 0.08)',
  color: 'rgba(255, 255, 255, 0.6)',
  textTransform: 'none',
  fontWeight: 600,
  fontSize: '0.9rem',
  transition: 'all 0.2s ease-in-out',
  '&:hover': {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    transform: 'translateY(-1px)',
  },
  '&.Mui-selected': {
    backgroundColor: 'rgba(108, 99, 255, 0.15)',
    borderColor: 'rgba(108, 99, 255, 0.4)',
    color: 'white',
    boxShadow: '0 4px 12px rgba(108, 99, 255, 0.25)',
  },
}));

const PlatformSwitcher: React.FC<PlatformSwitcherProps> = ({
  currentPlatform,
  onPlatformChange,
}) => {
  const handleChange = (event: React.SyntheticEvent, newValue: string) => {
    onPlatformChange(newValue);
  };

  return (
    <Box
      sx={{
        p: 2,
        background: 'rgba(255, 255, 255, 0.03)',
        borderRadius: 2,
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(10px)',
        minWidth: 200,
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          mb: 2,
          color: 'rgba(255, 255, 255, 0.8)',
          fontWeight: 600,
          textAlign: 'center',
        }}
      >
        Platform
      </Typography>
      
      <StyledTabs
        value={currentPlatform}
        onChange={handleChange}
        orientation="vertical"
        variant="fullWidth"
        aria-label="platform tabs"
        sx={{
          '& .MuiTabs-flexContainer': {
            flexDirection: 'column',
            gap: 1,
          },
        }}
      >
        <StyledTab
          label="Reddit"
          value="reddit"
          icon={<RedditIcon sx={{ color: '#FF4500' }} />}
          iconPosition="start"
        />
        <StyledTab
          label="YouTube"
          value="youtube"
          icon={<YouTubeIcon sx={{ color: '#FF0000' }} />}
          iconPosition="start"
        />
      </StyledTabs>
    </Box>
  );
};

export default PlatformSwitcher; 