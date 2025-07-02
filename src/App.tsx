import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container,
  CssBaseline,
  ThemeProvider,
  Box,
  CircularProgress,
  Typography,
  styled,
  Alert,
  Snackbar,
  Button,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import VideoGrid from './components/VideoGrid/VideoGrid';
import SearchBar from './components/SearchBar/SearchBar';
import Filters from './components/Filters/Filters';
import VideoPlayer from './components/VideoPlayer/VideoPlayer';
import Background from './components/Background/Background';
import { Video } from './types/Video';
import { getVideos, VideoFilters } from './services/api';
import { theme } from './theme';

const StyledContainer = styled(Container)(({ theme }) => ({
  position: 'relative',
  minHeight: '100vh',
  paddingBottom: theme.spacing(2),
  paddingLeft: theme.spacing(0),
  paddingRight: theme.spacing(0),
  paddingTop: 0,
  zIndex: 1,
  [theme.breakpoints.up('sm')]: {
    paddingLeft: theme.spacing(0),
    paddingRight: theme.spacing(0),
  },
}));

const Header = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0.75, 1.5),
  marginBottom: theme.spacing(2),
  background: 'rgba(19, 19, 47, 0.95)',
  backdropFilter: 'blur(12px)',
  boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
  border: '1px solid rgba(108, 99, 255, 0.15)',
  overflow: 'hidden',
  transition: 'all 0.3s ease',
  position: 'sticky',
  top: 0,
  zIndex: 1100,
  width: '100%',
  left: 0,
  right: 0,
  '&:hover': {
    boxShadow: '0 6px 20px rgba(0, 0, 0, 0.25)',
    borderColor: 'rgba(108, 99, 255, 0.25)',
  },
  [theme.breakpoints.down('md')]: {
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: theme.spacing(0.75),
    padding: theme.spacing(0.75, 1),
  },
}));

const LogoSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  marginRight: theme.spacing(1.5),
  [theme.breakpoints.down('md')]: {
    justifyContent: 'center',
    marginRight: 0,
    marginBottom: theme.spacing(0.5),
  },
}));

const SearchSection = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
  [theme.breakpoints.down('md')]: {
    marginBottom: theme.spacing(0.5),
  },
}));

const FiltersSection = styled(Box)(({ theme }) => ({
  display: 'flex',
  gap: theme.spacing(0.75),
  [theme.breakpoints.down('sm')]: {
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: theme.spacing(0.5),
  },
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '50vh',
  gap: theme.spacing(2),
}));

function App() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showError, setShowError] = useState(false);
  
  // Store filter values separately from the page number
  const [filterValues, setFilterValues] = useState({
    limit: 12,
    sortBy: 'createdAt' as 'createdAt' | 'views' | 'likes',
    order: 'desc' as 'asc' | 'desc',
    search: undefined as string | undefined,
    subreddit: undefined as string | undefined,
    showNsfw: false,
  });
  
  // Observer for infinite scrolling
  const observer = useRef<IntersectionObserver | null>(null);

  // Function to load videos (either initial load or more videos)
  const loadVideos = useCallback(async (isInitialLoad: boolean = false, page: number = 1) => {
    if (loading && !isInitialLoad) return;
    
    try {
      if (isInitialLoad) {
        setInitialLoading(true);
      } else {
        setLoading(true);
      }
      
      // Construct filters with current page
      const currentFilters = {
        ...filterValues,
        page: page
      };
      
      const response = await getVideos(currentFilters);
      
      if (page === 1) {
        // First page load - replace videos
        setVideos(response.videos);
      } else {
        // Subsequent pages - append videos
        setVideos(prev => [...prev, ...response.videos]);
      }
      
      // Update current page
      setCurrentPage(response.currentPage);
      
      // Check if there are more videos to load
      const hasMorePages = response.currentPage < response.pages;
      setHasMore(hasMorePages);
      
    } catch (error) {
      console.error('Error fetching videos:', error);
      setError('Failed to load videos. Please check if the API server is running.');
      setShowError(true);
    } finally {
      if (isInitialLoad) {
        setInitialLoading(false);
      } else {
        setLoading(false);
      }
    }
  }, [loading, filterValues]);
  
  // Use a ref to store the last request ID to prevent duplicate requests
  const requestIdRef = useRef<string>('');
  
  // Combine initial load and filter changes into a single effect with proper deduplication
  useEffect(() => {
    // Generate a unique request ID based on the current filters
    const requestId = JSON.stringify({
      limit: filterValues.limit,
      sortBy: filterValues.sortBy,
      order: filterValues.order,
      search: filterValues.search,
      subreddit: filterValues.subreddit,
      showNsfw: filterValues.showNsfw,
      page: 1
    });
    
    // Skip if this exact request was just made (handles React StrictMode double-mounting)
    if (requestId === requestIdRef.current) {
      return;
    }
    
    // Store the current request ID
    requestIdRef.current = requestId;
    
    // Determine if this is an initial load or a filter change
    const isFilterChange = !isInitialRender.current;
    
    // Reset pagination state on filter changes
    if (isFilterChange) {
      setCurrentPage(1);
      setVideos([]);
      setHasMore(true);
    }
    
    // Mark that we're no longer on initial render
    isInitialRender.current = false;
    
    // Load videos with the current filters
    loadVideos(true, 1);
    
  }, [filterValues.limit, filterValues.sortBy, filterValues.order, 
      filterValues.search, filterValues.subreddit, filterValues.showNsfw]);
      
  // Keep track of initial render state
  const isInitialRender = useRef(true);
  
  // Function to load more videos when user scrolls to bottom
  const loadMoreVideos = useCallback(() => {
    if (!loading && hasMore) {
      loadVideos(false, currentPage + 1);
    }
  }, [loading, hasMore, currentPage, loadVideos]);
  
  // Set up intersection observer for infinite scrolling
  const lastVideoElementRef = useCallback((node: HTMLDivElement | null) => {
    if (loading || initialLoading) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        loadMoreVideos();
      }
    }, { rootMargin: '100px' });
    
    if (node) {
      observer.current.observe(node);
    }
  }, [loading, initialLoading, hasMore, loadMoreVideos]);

  const handleSearch = (query: string) => {
    setFilterValues(prev => ({ ...prev, search: query }));
  };

  const handleSortByChange = (value: string) => {
    const validSortOptions = ['createdAt', 'views', 'likes'];
    if (!validSortOptions.includes(value)) {
      console.error(`Invalid sort option: ${value}`);
      return;
    }
    setFilterValues(prev => ({ ...prev, sortBy: value as 'createdAt' | 'views' | 'likes' }));
  };

  const handleOrderChange = (value: 'asc' | 'desc') => {
    setFilterValues(prev => ({ ...prev, order: value }));
  };

  const handleSubredditChange = (value: string) => {
    setFilterValues(prev => ({ ...prev, subreddit: value }));
  };

  const handleNsfwChange = (value: boolean) => {
    setFilterValues(prev => ({ ...prev, showNsfw: value }));
  };
  
  // Function to handle tag clicks for filtering videos
  const handleTagClick = (tag: string) => {
    setSelectedVideo(null); // Close the video player
    setFilterValues(prev => ({ ...prev, search: tag }));
  };

  const handleCloseError = () => {
    setShowError(false);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Background />
      <StyledContainer maxWidth={false}>
        <Snackbar open={showError} autoHideDuration={6000} onClose={handleCloseError}>
          <Alert onClose={handleCloseError} severity="error" sx={{ width: '100%' }}>
            {error}
          </Alert>
        </Snackbar>
        <Header className="sticky-header">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{ width: '100%', display: 'flex', flexGrow: 1 }}
          >
            <LogoSection>
              <Typography 
                variant="h5" 
                sx={{ 
                  fontWeight: 700, 
                  background: 'linear-gradient(45deg, #6c63ff, #ff6584)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  mr: { xs: 0, md: 1 }
                }}
              >
                VirtualFeed
              </Typography>
            </LogoSection>
            
            <SearchSection>
              <Box sx={{ width: '100%', maxWidth: 500 }}>
                <SearchBar onSearch={handleSearch} />
              </Box>
            </SearchSection>
            
            <FiltersSection>
              <Filters
                sortBy={filterValues.sortBy || 'createdAt'}
                order={filterValues.order || 'desc'}
                subreddit={filterValues.subreddit || ''}
                showNsfw={filterValues.showNsfw}
                onSortByChange={handleSortByChange}
                onOrderChange={handleOrderChange}
                onSubredditChange={handleSubredditChange}
                onNsfwChange={handleNsfwChange}
              />
            </FiltersSection>
          </motion.div>
        </Header>

        <AnimatePresence mode="wait">
          {initialLoading ? (
            <LoadingContainer>
              <CircularProgress size={60} />
              <Typography variant="body1" color="text.secondary">
                Loading amazing content...
              </Typography>
            </LoadingContainer>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              <VideoGrid
                videos={videos}
                onVideoClick={(video) => setSelectedVideo(video)}
                lastVideoRef={lastVideoElementRef}
              />
              
              {/* Loading indicator at bottom */}
              {loading && videos.length > 0 && (
                <Box display="flex" justifyContent="center" p={4}>
                  <CircularProgress size={40} />
                </Box>
              )}
              
              {/* No more videos message */}
              {!hasMore && videos.length > 0 && (
                <Box display="flex" justifyContent="center" p={4}>
                  <Typography variant="body2" color="text.secondary">
                    No more videos to load
                  </Typography>
                </Box>
              )}
              
              {/* Manual load more button as fallback */}
              {hasMore && videos.length > 0 && !loading && (
                <Box display="flex" justifyContent="center" p={4}>
                  <Button 
                    variant="outlined" 
                    color="primary" 
                    onClick={() => loadMoreVideos()}
                  >
                    Load More
                  </Button>
                </Box>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video Player with swipe functionality */}
        <VideoPlayer
          videos={videos}
          initialVideoIndex={selectedVideo ? videos.findIndex(v => v.id === selectedVideo.id) : 0}
          open={!!selectedVideo}
          onClose={() => setSelectedVideo(null)}
          onTagClick={handleTagClick}
        />
      </StyledContainer>
    </ThemeProvider>
  );
}

export default App;
