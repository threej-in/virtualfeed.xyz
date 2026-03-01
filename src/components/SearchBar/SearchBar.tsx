import React, { useState, useRef } from 'react';
import { Paper, InputBase, IconButton, Box, styled, useMediaQuery, useTheme } from '@mui/material';
import { Search as SearchIcon, Close as CloseIcon } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';

const StyledPaper = styled(Paper)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  height: '36px',
  maxWidth: '100%',
  margin: '0 auto',
  padding: theme.spacing(0, 0.5),
  background: '#121212',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255, 255, 255, 0.16)',
  borderRadius: '18px',
  transition: 'all 0.2s ease-in-out',
  '&:hover, &:focus-within': {
    background: '#1a1a1a',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.35)',
  },
  [theme.breakpoints.down('sm')]: {
    height: '32px',
    borderRadius: '16px',
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
    [theme.breakpoints.down('sm')]: {
      fontSize: '0.8rem',
      padding: theme.spacing(0.25, 0),
    },
  },
}));

interface SearchBarProps {
  onSearch: (query: string) => void;
  mobileView?: boolean;
  onSearchOpenChange?: (isOpen: boolean) => void;
}

const SearchBar: React.FC<SearchBarProps> = ({ onSearch, mobileView = false, onSearchOpenChange }) => {
  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    } else if (e.key === 'Escape' && isSearchOpen) {
      setIsSearchOpen(false);
    }
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
  };

  const toggleSearch = () => {
    const newState = !isSearchOpen;
    setIsSearchOpen(newState);
    if (onSearchOpenChange) {
      onSearchOpenChange(newState);
    }
    
    if (newState) { // Opening search
      setTimeout(() => {
        inputRef.current?.focus();
      }, 200);
    } else { // Closing search
      setQuery('');
    }
  };

  // On desktop or when search is open on mobile
  const renderSearchBar = () => (
    <Box component="form" onSubmit={handleSubmit} sx={{ width: '100%', display: 'flex', alignItems: 'center' }}>
      <StyledPaper>
        <SearchIcon sx={{ color: 'text.secondary', fontSize: { xs: '1rem', sm: '1.25rem' }, ml: 1 }} />
        <InputBase
          placeholder="Search videos..."
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          inputRef={inputRef}
          fullWidth
          sx={{
            ml: 1,
            flex: 1,
            fontSize: { xs: '0.875rem', sm: '1rem' },
          }}
          autoFocus={isSearchOpen}
        />
        {query && (
          <IconButton 
            onClick={handleClear} 
            sx={{ 
              p: { xs: '2px', sm: '4px' }, 
              visibility: query ? 'visible' : 'hidden',
              opacity: query ? 1 : 0,
              transition: 'opacity 0.2s ease-in-out',
              '& svg': { fontSize: { xs: '0.9rem', sm: '1.25rem' } }
            }}
            aria-label="clear search"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </StyledPaper>
      {isSearchOpen && (
        <IconButton 
          onClick={toggleSearch}
          sx={{ 
            ml: 1,
            p: { xs: '4px', sm: '6px' },
            backgroundColor: '#121212',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255, 255, 255, 0.16)',
            borderRadius: '50%',
            minWidth: '32px',
            height: '32px',
            '&:hover': {
              backgroundColor: '#1a1a1a',
            }
          }}
          aria-label="close search"
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
  );

  // Just the search icon for mobile when collapsed
  const renderSearchIcon = () => (
    <IconButton
      onClick={toggleSearch}
      sx={{
        backgroundColor: '#121212',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        borderRadius: '50%',
        p: '6px',
        '&:hover': {
          backgroundColor: '#1a1a1a',
        }
      }}
    >
      <SearchIcon fontSize="small" />
    </IconButton>
  );

  // For mobile view
  if (isMobile && mobileView) {
    return (
      <Box sx={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
        {!isSearchOpen && renderSearchIcon()}
        <AnimatePresence>
          {isSearchOpen && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: '100%' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              style={{ 
                position: 'absolute', 
                left: 0, 
                right: 0, 
                top: '50%',
                transform: 'translateY(-50%)',
                zIndex: 10,
                width: '100%',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              {renderSearchBar()}
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    );
  }

  // For desktop view
  return renderSearchBar();
};

export default SearchBar;
