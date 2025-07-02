import React, { useState } from 'react';
import { Paper, InputBase, IconButton, Box, styled } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { motion } from 'framer-motion';

const StyledPaper = styled(Paper)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  height: '36px',
  margin: '0 auto',
  padding: theme.spacing(0, 1),
  background: 'rgba(19, 19, 47, 0.6)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(108, 99, 255, 0.1)',
  borderRadius: '18px',
  transition: 'all 0.2s ease-in-out',
  '&:hover, &:focus-within': {
    background: 'rgba(19, 19, 47, 0.8)',
    boxShadow: '0 4px 12px rgba(108, 99, 255, 0.2)',
  },
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  flex: 1,
  marginLeft: theme.spacing(0.5),
  '& input': {
    color: theme.palette.text.primary,
    fontSize: '0.875rem',
    padding: theme.spacing(0.5, 0),
    '&::placeholder': {
      color: theme.palette.text.secondary,
      opacity: 0.7,
    },
  },
}));

interface SearchBarProps {
  onSearch: (query: string) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch }) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(query);
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%' }}>
      <StyledPaper>
        <IconButton type="submit" sx={{ p: '4px' }}>
          <SearchIcon fontSize="small" />
        </IconButton>
        <StyledInputBase
          placeholder="Search videos..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          fullWidth
        />
      </StyledPaper>
    </Box>
  );
};

export default SearchBar;
