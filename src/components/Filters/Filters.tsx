import React from 'react';
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
} from '@mui/material';
import { motion } from 'framer-motion';

const StyledFormControl = styled(FormControl)(({ theme }) => ({
  background: 'rgba(19, 19, 47, 0.6)',
  backdropFilter: 'blur(10px)',
  borderRadius: '18px',
  minWidth: '100px !important',
  '& .MuiInputLabel-root': {
    fontSize: '0.75rem',
    transform: 'translate(14px, 8px) scale(1)',
    '&.MuiInputLabel-shrink': {
      transform: 'translate(14px, -6px) scale(0.75)',
    },
  },
  '& .MuiSelect-select': {
    fontSize: '0.75rem',
    padding: '8px 14px',
  },
  '& .MuiOutlinedInput-root': {
    '& fieldset': {
      borderColor: 'rgba(108, 99, 255, 0.1)',
      borderRadius: '18px',
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
}));

interface FiltersProps {
  sortBy: string;
  order: 'asc' | 'desc';
  subreddit: string;
  showNsfw: boolean;
  onSortByChange: (value: string) => void;
  onOrderChange: (value: 'asc' | 'desc') => void;
  onSubredditChange: (value: string) => void;
  onNsfwChange: (value: boolean) => void;
}

const Filters: React.FC<FiltersProps> = ({
  sortBy,
  order,
  subreddit,
  showNsfw,
  onSortByChange,
  onOrderChange,
  onSubredditChange,
  onNsfwChange,
}) => {
  const subreddits = ['r/videos', 'r/gaming', 'r/funny', 'r/aww', 'r/music'];

  return (
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

      <StyledFormControl size="small">
        <InputLabel>Sub</InputLabel>
        <Select
          value={subreddit}
          label="Sub"
          onChange={(e) => onSubredditChange(e.target.value)}
          MenuProps={{
            PaperProps: {
              style: { maxHeight: 200 },
            },
          }}
        >
          <MenuItem value="">All</MenuItem>
          {subreddits.map((sub) => (
            <MenuItem key={sub} value={sub}>
              {sub}
            </MenuItem>
          ))}
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
        label={<Typography variant="caption" sx={{ fontSize: '0.75rem' }}>NSFW</Typography>}
        sx={{
          marginLeft: 0.5,
          background: 'rgba(19, 19, 47, 0.6)',
          backdropFilter: 'blur(10px)',
          borderRadius: '18px',
          padding: '0 8px',
          height: '32px',
          '& .MuiFormControlLabel-label': {
            marginRight: 0.5,
          },
        }}
      />
    </FiltersContainer>
  );
};

export default Filters;
