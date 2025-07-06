import React, { useState } from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  styled,
  Switch,
  FormControlLabel,
  Typography,
  IconButton,
  useMediaQuery,
  useTheme,
  Popover,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import FilterListIcon from '@mui/icons-material/FilterList';
import { theme } from '../../theme';

const StyledFormControl = styled(FormControl)(({ theme }) => ({
  background: 'rgba(19, 19, 47, 0.6)',
  backdropFilter: 'blur(10px)',
  borderRadius: '18px',
  minWidth: '100px !important',
  [theme.breakpoints.down('sm')]: {
    minWidth: '80px !important',
    borderRadius: '16px',
  },
  '& .MuiInputLabel-root': {
    fontSize: '0.75rem',
    transform: 'translate(14px, 8px) scale(1)',
    '&.MuiInputLabel-shrink': {
      transform: 'translate(14px, -6px) scale(0.75)',
    },
    [theme.breakpoints.down('sm')]: {
      fontSize: '0.7rem',
      transform: 'translate(10px, 7px) scale(1)',
      '&.MuiInputLabel-shrink': {
        transform: 'translate(10px, -6px) scale(0.7)',
      },
    },
  },
  '& .MuiSelect-select': {
    fontSize: '0.75rem',
    padding: '8px 14px',
    [theme.breakpoints.down('sm')]: {
      fontSize: '0.7rem',
      padding: '6px 10px',
    },
  },
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: 'rgba(108, 99, 255, 0.1)',
      borderRadius: '18px',
      [theme.breakpoints.down('sm')]: {
        borderRadius: '16px',
      },
    },
    '&:hover fieldset': {
      borderColor: 'rgba(108, 99, 255, 0.3)',
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main,
    },
  },
}));

const FiltersContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(1),
  flexWrap: 'nowrap',
  justifyContent: 'center',
  [theme.breakpoints.down('sm')]: {
    gap: theme.spacing(0.5),
    overflowX: 'auto',
    padding: theme.spacing(0.5, 0),
    '&::-webkit-scrollbar': {
      display: 'none'
    },
    msOverflowStyle: 'none',  /* IE and Edge */
    scrollbarWidth: 'none',  /* Firefox */
  },
}));

interface FiltersProps {
  sortBy: string;
  order: 'asc' | 'desc';
  showNsfw: boolean;
  onSortByChange: (value: string) => void;
  onOrderChange: (value: 'asc' | 'desc') => void;
  onNsfwChange: (value: boolean) => void;
  mobileView?: boolean;
}

const Filters: React.FC<FiltersProps> = ({
  sortBy,
  order,
  showNsfw,
  onSortByChange,
  onOrderChange,
  onNsfwChange,
  mobileView = false,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  
  const handleFilterClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const renderFilters = () => (
    <FiltersContainer>
      <StyledFormControl size="small">
        <InputLabel>Sort</InputLabel>
        <Select
          value={sortBy}
          label="Sort"
          onChange={(e) => onSortByChange(e.target.value)}
          MenuProps={{
            PaperProps: {
              style: { maxHeight: 200 },
            },
          }}
        >
          <MenuItem value="createdAt">Date</MenuItem>
          <MenuItem value="views">Views</MenuItem>
          <MenuItem value="likes">Likes</MenuItem>
        </Select>
      </StyledFormControl>

      <StyledFormControl size="small">
        <InputLabel>Order</InputLabel>
        <Select
          value={order}
          label="Order"
          onChange={(e) => onOrderChange(e.target.value as 'asc' | 'desc')}
        >
          <MenuItem value="desc">↓ Desc</MenuItem>
          <MenuItem value="asc">↑ Asc</MenuItem>
        </Select>
      </StyledFormControl>

      <FormControlLabel
        control={
          <Switch
            checked={showNsfw}
            onChange={(e) => onNsfwChange(e.target.checked)}
            size="small"
            sx={{
              '& .MuiSwitch-switchBase.Mui-checked': {
                color: '#ff6584',
              },
              '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                backgroundColor: '#ff6584',
              },
            }}
          />
        }
        label={
          <Typography 
            variant="caption" 
            sx={{ 
              fontSize: { xs: '0.7rem', sm: '0.75rem' },
              whiteSpace: 'nowrap'
            }}
          >
            NSFW
          </Typography>
        }
        sx={{
          margin: 0,
          background: 'rgba(19, 19, 47, 0.6)',
          backdropFilter: 'blur(10px)',
          borderRadius: '18px',
          border: '1px solid rgba(108, 99, 255, 0.1)',
          padding: theme.spacing(0.25, 0.75),
          '& .MuiFormControlLabel-label': {
            marginLeft: '4px',
          },
        }}
      />
    </FiltersContainer>
  );

  // For mobile view
  if (isMobile && mobileView) {
    const open = Boolean(anchorEl);
    const id = open ? 'filters-popover' : undefined;

    return (
      <Box>
        <IconButton
          onClick={handleFilterClick}
          aria-describedby={id}
          sx={{
            backgroundColor: 'rgba(19, 19, 47, 0.6)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(108, 99, 255, 0.1)',
            borderRadius: '50%',
            p: '6px',
            '&:hover': {
              backgroundColor: 'rgba(19, 19, 47, 0.8)',
            }
          }}
        >
          <FilterListIcon fontSize="small" />
        </IconButton>
        <Popover
          id={id}
          open={open}
          anchorEl={anchorEl}
          onClose={handleClose}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right',
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right',
          }}
          PaperProps={{
            sx: {
              mt: 1,
              p: 1.5,
              borderRadius: '12px',
              backgroundColor: 'rgba(19, 19, 47, 0.95)',
              backdropFilter: 'blur(12px)',
              border: '1px solid rgba(108, 99, 255, 0.15)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
            }
          }}
        >
          {renderFilters()}
        </Popover>
      </Box>
    );
  }

  // For desktop view
  return renderFilters();
};

export default Filters;
