import React, { useState } from 'react';
import {
  Box,
  IconButton,
  Menu,
  MenuItem,
  Typography,
  styled,
  Tooltip,
} from '@mui/material';
import { TrendingUp as TrendingIcon } from '@mui/icons-material';
import { motion } from 'framer-motion';

const StyledIconButton = styled(IconButton)(({ theme }) => ({
  background: 'linear-gradient(135deg, rgba(108, 99, 255, 0.1) 0%, rgba(255, 101, 132, 0.1) 100%)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(108, 99, 255, 0.2)',
  borderRadius: '20px',
  padding: '8px 12px',
  transition: 'all 0.3s ease-in-out',
  position: 'relative',
  overflow: 'hidden',
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'linear-gradient(135deg, rgba(108, 99, 255, 0.05) 0%, rgba(255, 101, 132, 0.05) 100%)',
    opacity: 0,
    transition: 'opacity 0.3s ease-in-out',
    zIndex: -1,
  },
  '&:hover': {
    background: 'linear-gradient(135deg, rgba(108, 99, 255, 0.2) 0%, rgba(255, 101, 132, 0.2) 100%)',
    borderColor: 'rgba(108, 99, 255, 0.4)',
    transform: 'scale(1.05)',
    '&::before': {
      opacity: 1,
    },
  },
  '&.active': {
    background: 'linear-gradient(135deg, rgba(108, 99, 255, 0.3) 0%, rgba(255, 101, 132, 0.3) 100%)',
    borderColor: 'rgba(108, 99, 255, 0.6)',
    boxShadow: '0 4px 12px rgba(108, 99, 255, 0.3)',
    '& .MuiSvgIcon-root': {
      color: '#6c63ff',
    },
    '& span': {
      color: '#6c63ff',
    },
  },
  [theme.breakpoints.down('sm')]: {
    padding: '6px 10px',
  },
}));

const StyledMenuItem = styled(MenuItem)(({ theme }) => ({
  fontSize: '0.875rem',
  padding: theme.spacing(1, 1.5),
  '&:hover': {
    backgroundColor: 'rgba(108, 99, 255, 0.1)',
  },
  '&.Mui-selected': {
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
    '&:hover': {
      backgroundColor: 'rgba(108, 99, 255, 0.25)',
    },
  },
}));

const StyledMenu = styled(Menu)(({ theme }) => ({
  '& .MuiPaper-root': {
    backgroundColor: 'rgba(19, 19, 47, 0.95)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(108, 99, 255, 0.15)',
    borderRadius: '12px',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
    minWidth: '120px',
  },
}));

interface TrendingButtonProps {
  currentTrending?: '24h' | '48h' | '1w';
  onTrendingChange: (period: '24h' | '48h' | '1w' | undefined) => void;
  mobileView?: boolean;
  isFallback?: boolean; // Add fallback indicator
}

const TrendingButton: React.FC<TrendingButtonProps> = ({
  currentTrending,
  onTrendingChange,
  mobileView = false,
  isFallback = false,
}) => {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleTrendingSelect = (period: '24h' | '48h' | '1w') => {
    // If the same period is selected, clear the trending filter
    if (currentTrending === period) {
      onTrendingChange(undefined);
    } else {
      onTrendingChange(period);
    }
    handleClose();
  };

  const getTrendingLabel = (period: string) => {
    switch (period) {
      case '24h': return 'Last 24 Hours';
      case '48h': return 'Last 48 Hours';
      case '1w': return 'Last Week';
      default: return 'Trending';
    }
  };

  const isActive = !!currentTrending;
  const buttonText = isFallback ? 'Recent' : 'Trending';
  const tooltipText = isFallback 
    ? `Showing recent videos (no trending content available for ${getTrendingLabel(currentTrending || '24h')})`
    : currentTrending ? `Trending: ${getTrendingLabel(currentTrending)}` : 'Show trending videos';

  return (
    <Box>
      <Tooltip 
        title={tooltipText}
        placement="bottom"
      >
        <StyledIconButton
          onClick={handleClick}
          className={isActive ? 'active' : ''}
          aria-label="trending filter"
          sx={{
            '& .MuiSvgIcon-root': {
              fontSize: { xs: '1.1rem', sm: '1.25rem' },
              color: isActive ? '#6c63ff' : 'text.secondary',
              transition: 'color 0.2s ease-in-out',
            },
          }}
        >
          <motion.div
            animate={isActive ? { rotate: [0, -10, 10, 0] } : {}}
            transition={{ duration: 0.3 }}
            style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <span style={{ fontSize: '0.75rem', whiteSpace: 'nowrap' }}>{buttonText}</span>
            <TrendingIcon />
          </motion.div>
        </StyledIconButton>
      </Tooltip>

      <StyledMenu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center',
        }}
        PaperProps={{
          elevation: 0,
        }}
        // Prevent menu from repositioning unexpectedly
        keepMounted
        disablePortal={false}
        // Better positioning control
        slotProps={{
          paper: {
            sx: {
              maxHeight: '300px',
              overflow: 'auto',
            }
          }
        }}
        MenuListProps={{
          sx: {
            padding: '8px 0',
          }
        }}
        // Prevent the menu from being cut off by viewport
        sx={{
          '& .MuiPaper-root': {
            maxHeight: '300px',
            overflow: 'visible',
          }
        }}
      >
        <StyledMenuItem
          onClick={() => handleTrendingSelect('24h')}
          selected={currentTrending === '24h'}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">🔥</Typography>
            <Typography variant="body2">Last 24 Hours</Typography>
          </Box>
        </StyledMenuItem>
        
        <StyledMenuItem
          onClick={() => handleTrendingSelect('48h')}
          selected={currentTrending === '48h'}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">⚡</Typography>
            <Typography variant="body2">Last 48 Hours</Typography>
          </Box>
        </StyledMenuItem>
        
        <StyledMenuItem
          onClick={() => handleTrendingSelect('1w')}
          selected={currentTrending === '1w'}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">📈</Typography>
            <Typography variant="body2">Last Week</Typography>
          </Box>
        </StyledMenuItem>
        
        {currentTrending && (
          <StyledMenuItem
            onClick={() => {
              onTrendingChange(undefined);
              handleClose();
            }}
            sx={{
              borderTop: '1px solid rgba(108, 99, 255, 0.1)',
              marginTop: 0.5,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Clear Trending Filter
            </Typography>
          </StyledMenuItem>
        )}
      </StyledMenu>
    </Box>
  );
};

export default TrendingButton; 