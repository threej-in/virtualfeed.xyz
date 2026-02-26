import React, { useState, useEffect, useRef, useCallback } from "react";
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
  IconButton,
  Drawer,
  useMediaQuery,
} from "@mui/material";
import { Menu as MenuIcon, Close as CloseIcon } from "@mui/icons-material";
import { motion, AnimatePresence } from "framer-motion";
import VideoGrid from "./components/VideoGrid/VideoGrid";
import SearchBar from "./components/SearchBar/SearchBar";
import Filters from "./components/Filters/Filters";
import Sidebar from "./components/Sidebar/Sidebar";
import VideoPlayer from "./components/VideoPlayer/VideoPlayer";
import VideoSubmission from "./components/VideoSubmission/VideoSubmission";
import Background from "./components/Background/Background";
import { Video } from "./types/Video";
import { getVideos, submitVideo } from "./services/api";
import { LanguageDetector } from "./utils/languageDetection";
import { theme } from "./theme";

const StyledContainer = styled(Container)(({ theme }) => ({
  position: "relative",
  height: "100vh",
  paddingBottom: 0,
  paddingLeft: theme.spacing(0),
  paddingRight: theme.spacing(0),
  paddingTop: 0,
  zIndex: 1,
  [theme.breakpoints.up("sm")]: {
    paddingLeft: theme.spacing(0),
    paddingRight: theme.spacing(0),
  },
}));

const Header = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: theme.spacing(0.75, 1),
  marginBottom: theme.spacing(0),
  background: "rgba(19, 19, 47, 0.95)",
  backdropFilter: "blur(12px)",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.2)",
  border: "1px solid rgba(108, 99, 255, 0.15)",
  overflow: "hidden",
  transition: "all 0.3s ease",
  position: "sticky",
  top: 0,
  zIndex: 1100,
  width: "100%",
  left: 0,
  [theme.breakpoints.up("sm")]: {
    flexDirection: "row",
    padding: theme.spacing(0.75, 1.5),
    marginBottom: theme.spacing(0),
  },
  right: 0,
  "&:hover": {
    boxShadow: "0 6px 20px rgba(0, 0, 0, 0.25)",
    borderColor: "rgba(108, 99, 255, 0.25)",
  },
  [theme.breakpoints.down("xs")]: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: theme.spacing(0.25),
    padding: theme.spacing(0.25, 0.5),
  },
  [theme.breakpoints.down("md")]: {
    flexDirection: "column",
    alignItems: "stretch",
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 0.75),
  },
}));

const LogoSection = styled(Box)(({ theme }) => ({
  display: "flex",
  alignItems: "center",
  marginRight: theme.spacing(1.5),
  [theme.breakpoints.down("md")]: {
    justifyContent: "center",
    marginRight: 0,
    marginBottom: theme.spacing(0.5),
  },
}));

const SearchSection = styled(Box)(({ theme }) => ({
  flex: 1,
  display: "flex",
  justifyContent: "center",
  [theme.breakpoints.down("md")]: {},
  [theme.breakpoints.down("sm")]: {
    position: "relative",
  },
}));

const FiltersSection = styled(Box)(({ theme }) => ({
  display: "flex",
  gap: theme.spacing(0.75),
  [theme.breakpoints.down("sm")]: {
    justifyContent: "flex-end",
    gap: theme.spacing(0.5),
  },
}));

const LoadingContainer = styled(Box)(({ theme }) => ({
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "50vh",
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
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [filterValues, setFilterValues] = useState({
    limit: 12,
    sortBy: "createdAt" as "createdAt" | "views" | "likes",
    order: "desc" as "asc" | "desc",
    search: undefined as string | undefined,
    platform: "", // Default to show all platforms
    showNsfw: false,
    trending: undefined as "24h" | "48h" | "1w" | undefined, // No trending filter by default - show recent videos
    language: LanguageDetector.getUserPreferredLanguage(), // Default to user's preferred language
  });
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [isFallbackContent, setIsFallbackContent] = useState(false);
  const [isVideoSubmissionOpen, setIsVideoSubmissionOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [playingVideoId, setPlayingVideoId] = useState<number | null>(null);
  const [focusedVideoId, setFocusedVideoId] = useState<number | null>(null);

  // Detect if we're on a large device (desktop/tablet)
  const isLargeDevice = useMediaQuery("(min-width:900px)");

  // Observer for infinite scrolling
  const observer = useRef<IntersectionObserver | null>(null);

  // Observer for video focus/autoplay
  const videoFocusObserver = useRef<IntersectionObserver | null>(null);

  // Function to load videos (either initial load or more videos)
  const loadVideos = useCallback(
    async (isInitialLoad: boolean = false, page: number = 1) => {
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
          page: page,
        };

        const response = await getVideos(currentFilters);

        // Check if this is fallback content (recent videos instead of trending)
        const isFallback =
          response.trending?.period === "recent" ||
          (response.videos.length > 0 &&
            response.videos[0].trending?.isFallback);
        setIsFallbackContent(isFallback || false);

        if (page === 1) {
          // First page load - replace videos
          setVideos(response.videos);
        } else {
          // Subsequent pages - append videos
          setVideos((prev) => [...prev, ...response.videos]);
        }

        // Update current page
        setCurrentPage(response.currentPage);

        // Check if there are more videos to load
        const hasMorePages = response.currentPage < response.pages;
        setHasMore(hasMorePages);
      } catch (error) {
        console.error("Error fetching videos:", error);
        setError(
          "Failed to load videos. Please check if the API server is running."
        );
        setShowError(true);
      } finally {
        if (isInitialLoad) {
          setInitialLoading(false);
        } else {
          setLoading(false);
        }
      }
    },
    [loading, filterValues]
  );

  // Use a ref to store the last request ID to prevent duplicate requests
  const requestIdRef = useRef<string>("");

  // Combine initial load and filter changes into a single effect with proper deduplication
  useEffect(() => {
    // Generate a unique request ID based on the current filters
    const requestId = JSON.stringify({
      limit: filterValues.limit,
      sortBy: filterValues.sortBy,
      order: filterValues.order,
      search: filterValues.search,
      platform: filterValues.platform,
      showNsfw: filterValues.showNsfw,
      trending: filterValues.trending,
      page: 1,
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
  }, [
    filterValues.limit,
    filterValues.sortBy,
    filterValues.order,
    filterValues.search,
    filterValues.platform,
    filterValues.showNsfw,
    filterValues.trending,
    loadVideos,
  ]);

  // Keep track of initial render state
  const isInitialRender = useRef(true);

  // Function to load more videos when user scrolls to bottom
  const loadMoreVideos = useCallback(() => {
    if (!loading && hasMore) {
      loadVideos(false, currentPage + 1);
    }
  }, [loading, hasMore, currentPage, loadVideos]);

  // Set up intersection observer for infinite scrolling
  const lastVideoElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (loading || initialLoading) return;
      if (observer.current) observer.current.disconnect();

      observer.current = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting && hasMore) {
            loadMoreVideos();
          }
        },
        {
          rootMargin: "200px", // Increased margin for snap scrolling
          threshold: 0.1, // Lower threshold to trigger earlier
        }
      );

      if (node) {
        observer.current.observe(node);
      }
    },
    [loading, initialLoading, hasMore, loadMoreVideos]
  );

  // Set up intersection observer for video focus/autoplay (only on mobile devices)
  useEffect(() => {
    // Only enable autoplay on mobile devices
    if (isLargeDevice) {
      return;
    }

    videoFocusObserver.current = new IntersectionObserver(
      (entries) => {
        // Find the video that is most in focus (highest intersection ratio)
        let mostFocusedVideoId: number | null = null;
        let highestRatio = 0;

        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > highestRatio) {
            const videoId = parseInt(
              entry.target.getAttribute("data-video-id") || "0"
            );
            highestRatio = entry.intersectionRatio;
            mostFocusedVideoId = videoId;
          }
        });

        // Stop all videos first, then start the most focused video
        if (mostFocusedVideoId && highestRatio >= 0.7) {
          setPlayingVideoId(mostFocusedVideoId);
          setFocusedVideoId(mostFocusedVideoId);
        } else {
          setPlayingVideoId(null);
          setFocusedVideoId(null);
        }
      },
      {
        threshold: [0.1, 0.3, 0.5, 0.7, 0.9], // Multiple thresholds for better detection
        rootMargin: "-10% 0px -10% 0px", // Only trigger when video is in center 80% of viewport
      }
    );

    return () => {
      if (videoFocusObserver.current) {
        videoFocusObserver.current.disconnect();
      }
    };
  }, [videos, isLargeDevice]);

  // Add scroll event listener as backup for infinite scrolling with snap scrolling
  useEffect(() => {
    const handleScroll = () => {
      if (loading || !hasMore) return;

      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      // Load more when user is near bottom (within 300px)
      if (scrollTop + windowHeight >= documentHeight - 300) {
        loadMoreVideos();
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [loading, hasMore, loadMoreVideos]);

  const handleSearch = (query: string) => {
    setFilterValues((prev) => ({ ...prev, search: query }));
  };

  const handleSortByChange = (value: string) => {
    const validSortOptions = ["createdAt", "views", "likes"];
    if (!validSortOptions.includes(value)) {
      console.error(`Invalid sort option: ${value}`);
      return;
    }
    setFilterValues((prev) => ({
      ...prev,
      sortBy: value as "createdAt" | "views" | "likes",
    }));
  };

  const handleOrderChange = (value: "asc" | "desc") => {
    setFilterValues((prev) => ({ ...prev, order: value }));
  };

  const handleNsfwChange = (value: boolean) => {
    setFilterValues((prev) => ({ ...prev, showNsfw: value }));
  };

  const handleTrendingChange = (period: "24h" | "48h" | "1w" | undefined) => {
    setFilterValues((prev) => ({ ...prev, trending: period }));
  };

  const handlePlatformChange = (platform: string) => {
    setFilterValues((prev) => ({ ...prev, platform }));
  };

  const handleLanguageChange = (language: string) => {
    setFilterValues((prev) => ({ ...prev, language }));
  };

  // Function to handle tag clicks for filtering videos
  const handleTagClick = (tag: string) => {
    setSelectedVideo(null); // Close the video player
    setFilterValues((prev) => ({ ...prev, search: tag }));
  };

  const handleCloseError = () => {
    setShowError(false);
    setError(null);
  };

  const handleCloseSuccess = () => {
    setShowSuccess(false);
    setSuccessMessage(null);
  };

  const handleSubmitVideo = async (redditUrl: string, isNsfw: boolean) => {
    try {
      await submitVideo(redditUrl, isNsfw);
      setIsVideoSubmissionOpen(false);
      setSuccessMessage("Video submitted successfully!");
      setShowSuccess(true);
      // Don't reload videos immediately - let user continue browsing
      // The video will appear in the next natural refresh
    } catch (error) {
      console.error("Error submitting video:", error);
      // Error is handled by the VideoSubmission component
      throw error; // Re-throw to let VideoSubmission handle it
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Background />
      <StyledContainer maxWidth={false}>
        <Snackbar
          open={showError}
          autoHideDuration={6000}
          onClose={handleCloseError}
        >
          <Alert
            onClose={handleCloseError}
            severity="error"
            sx={{ width: "100%" }}
          >
            {error}
          </Alert>
        </Snackbar>
        <Snackbar
          open={showSuccess}
          autoHideDuration={6000}
          onClose={handleCloseSuccess}
        >
          <Alert
            onClose={handleCloseSuccess}
            severity="success"
            sx={{ width: "100%" }}
          >
            {successMessage}
          </Alert>
        </Snackbar>
        <Header className="sticky-header">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            style={{ width: "100%", display: "flex", flexGrow: 1 }}
          >
            <LogoSection
              sx={{
                display: { xs: isSearchExpanded ? "none" : "flex", sm: "flex" },
                paddingLeft: { md: 3 }, // Align with sidebar padding
              }}
            >
              {/* Mobile Menu Button */}
              <IconButton
                onClick={() => setIsSidebarOpen(true)}
                sx={{
                  display: { xs: "flex", md: "none" },
                  mr: 1,
                  color: "rgba(255, 255, 255, 0.8)",
                  padding: { xs: 0.5, sm: 1 },
                  "&:hover": {
                    color: "white",
                    background: "rgba(255, 255, 255, 0.1)",
                  },
                }}
              >
                <MenuIcon sx={{ fontSize: { xs: "1.2rem", sm: "1.5rem" } }} />
              </IconButton>

              <Typography
                variant="h5"
                onClick={() => {
                  // Reset all filters and return to homepage
                  setFilterValues({
                    limit: 12,
                    sortBy: "createdAt",
                    order: "desc",
                    search: "",
                    platform: "",
                    showNsfw: false,
                    trending: undefined,
                    language: LanguageDetector.getUserPreferredLanguage(), // Use homepage algorithm by default
                  });
                  // Reset videos array to trigger a fresh load
                  setVideos([]);
                  setCurrentPage(1);
                  setHasMore(true);
                }}
                sx={{
                  fontWeight: 700,
                  background: "linear-gradient(45deg, #6c63ff, #ff6584)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  mr: { xs: 0, md: 1 },
                  cursor: "pointer",
                  fontSize: { xs: "1.2rem", sm: "1.5rem", md: "1.5rem" },
                  "&:hover": {
                    opacity: 0.85,
                    transform: "scale(1.03)",
                  },
                  transition: "all 0.2s ease-in-out",
                }}
              >
                VirtualFeed
              </Typography>
            </LogoSection>

            <Box
              sx={{
                display: "flex",
                width: "100%",
                justifyContent: "space-between",
                alignItems: "center",
                flexDirection: { xs: "row", sm: "row" },
                gap: { xs: 1, sm: 2 },
              }}
            >
              <SearchSection
                sx={{
                  flex: { xs: 1, sm: 1 },
                  position: "relative",
                  width: { xs: "100%", sm: "auto" },
                }}
              >
                <Box
                  sx={{
                    width: "100%",
                    maxWidth: { xs: "100%", sm: 500 },
                    position: "relative",
                  }}
                >
                  <SearchBar
                    onSearch={handleSearch}
                    mobileView={true}
                    onSearchOpenChange={setIsSearchExpanded}
                  />
                </Box>
              </SearchSection>

              <FiltersSection
                sx={{
                  flexShrink: 0,
                }}
              >
                <Filters
                  sortBy={filterValues.sortBy || "createdAt"}
                  order={filterValues.order || "desc"}
                  showNsfw={filterValues.showNsfw}
                  trending={filterValues.trending}
                  language={filterValues.language}
                  onSortByChange={handleSortByChange}
                  onOrderChange={handleOrderChange}
                  onNsfwChange={handleNsfwChange}
                  onTrendingChange={handleTrendingChange}
                  onLanguageChange={handleLanguageChange}
                  mobileView={true}
                  isFallback={isFallbackContent}
                />
              </FiltersSection>
            </Box>
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
              <Box
                sx={{
                  display: "flex",
                  height: "calc(100vh - 40px)",
                  flexDirection: { xs: "column", md: "row" },
                }}
              >
                {/* Desktop Sidebar */}
                <Box sx={{ display: { xs: "none", md: "block" } }}>
                  <Sidebar
                    currentPlatform={filterValues.platform || ""}
                    onPlatformChange={handlePlatformChange}
                    onVideoSubmission={() => setIsVideoSubmissionOpen(true)}
                  />
                </Box>

                {/* Main Content Area */}
                <Box
                  sx={{
                    flex: 1,
                    p: { xs: 0, md: 3 },
                    marginLeft: { md: "260px" },
                    width: { xs: "100%", md: "auto" },
                    height: "100%",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <VideoGrid
                    videos={videos}
                    onVideoClick={(video) => {
                      if (isLargeDevice) {
                        // On large devices, always use popup for both YouTube and Reddit videos
                        if (video.platform === "youtube") {
                          setSelectedVideo(
                            selectedVideo?.id === video.id ? null : video
                          );
                          setPlayingVideoId(null); // Stop any in-place playing video
                          setFocusedVideoId(null);
                        } else {
                          setSelectedVideo(
                            selectedVideo?.id === video.id ? null : video
                          );
                          setPlayingVideoId(null); // Stop any playing YouTube video
                          setFocusedVideoId(null);
                        }
                      } else {
                        // On mobile devices, use the existing autoplay behavior
                        if (video.platform === "youtube") {
                          // For YouTube videos, manually toggle playing state (override autoplay)
                          setPlayingVideoId(
                            playingVideoId === video.id ? null : video.id
                          );
                          setFocusedVideoId(
                            playingVideoId === video.id ? null : video.id
                          );
                          setSelectedVideo(null); // Don't open popup for YouTube
                        } else {
                          // For Reddit videos, manually toggle popup (override autoplay)
                          setSelectedVideo(
                            selectedVideo?.id === video.id ? null : video
                          );
                          setPlayingVideoId(null); // Stop any playing YouTube video
                          setFocusedVideoId(
                            selectedVideo?.id === video.id ? null : video.id
                          );
                        }
                      }
                    }}
                    lastVideoRef={lastVideoElementRef}
                    playingVideoId={playingVideoId}
                    focusedVideoId={focusedVideoId}
                    videoFocusObserver={videoFocusObserver}
                    isLargeDevice={isLargeDevice}
                    onResetFilters={() => {
                      // Reset all filters and return to homepage
                      setFilterValues({
                        limit: 12,
                        sortBy: "createdAt",
                        order: "desc",
                        search: "",
                        platform: "", // Show all platforms by default
                        showNsfw: false,
                        trending: undefined, // Show recent videos by default
                        language: LanguageDetector.getUserPreferredLanguage(), // Reset to user's preferred language
                      });
                      // Reset videos array to trigger a fresh load
                      setVideos([]);
                      setCurrentPage(1);
                      setHasMore(true);
                    }}
                  />

                  {/* Loading indicator at bottom */}
                  {loading && videos.length > 0 && (
                    <Box display="flex" justifyContent="center" p={4}>
                      <CircularProgress size={40} />
                    </Box>
                  )}

                  {/* No more videos message removed - clean infinite scroll experience */}

                  {/* Manual load more button removed - using infinite scroll instead */}
                </Box>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Video Player with swipe functionality - for both YouTube and Reddit videos on large devices */}
        {selectedVideo && (
          <VideoPlayer
            videos={videos}
            initialVideoIndex={
              selectedVideo
                ? videos.findIndex((v) => v.id === selectedVideo.id)
                : 0
            }
            open={!!selectedVideo}
            onClose={() => setSelectedVideo(null)}
            onTagClick={handleTagClick}
          />
        )}

        {/* Video Submission Modal */}
        <VideoSubmission
          open={isVideoSubmissionOpen}
          onClose={() => setIsVideoSubmissionOpen(false)}
          onSubmit={handleSubmitVideo}
        />

        {/* Mobile Sidebar Drawer */}
        <Drawer
          anchor="left"
          open={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              width: "100%",
              maxWidth: "320px",
              background:
                "linear-gradient(135deg, rgba(19, 19, 47, 0.98) 0%, rgba(25, 25, 60, 0.95) 100%)",
              backdropFilter: "blur(25px)",
              border: "none",
              boxShadow: "8px 0 30px rgba(0, 0, 0, 0.4)",
              borderRight: "1px solid rgba(108, 99, 255, 0.2)",
            },
          }}
        >
          <Box
            sx={{
              height: "100%",
              display: "flex",
              flexDirection: "column",
              background:
                "linear-gradient(180deg, rgba(108, 99, 255, 0.05) 0%, transparent 50%, rgba(255, 101, 132, 0.05) 100%)",
            }}
          >
            {/* Header with Close Button */}
            <Box
              sx={{
                p: 3,
                pb: 2,
                borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
                background: "rgba(255, 255, 255, 0.02)",
              }}
            >
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 700,
                    background: "linear-gradient(45deg, #6c63ff, #ff6584)",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    fontSize: "1.25rem",
                  }}
                >
                  Menu
                </Typography>
                <IconButton
                  onClick={() => setIsSidebarOpen(false)}
                  sx={{
                    color: "rgba(255, 255, 255, 0.7)",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    "&:hover": {
                      color: "white",
                      background: "rgba(255, 255, 255, 0.1)",
                      borderColor: "rgba(255, 255, 255, 0.2)",
                      transform: "scale(1.05)",
                    },
                    transition: "all 0.2s ease-in-out",
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            </Box>

            {/* Sidebar Content */}
            <Box sx={{ flex: 1, p: 3, pt: 2 }}>
              <Sidebar
                currentPlatform={filterValues.platform || ""}
                onPlatformChange={(platform) => {
                  handlePlatformChange(platform);
                  setIsSidebarOpen(false); // Close drawer after selection
                }}
                onVideoSubmission={() => {
                  setIsVideoSubmissionOpen(true);
                  setIsSidebarOpen(false); // Close drawer after clicking submit
                }}
                isMobileDrawer={true}
              />
            </Box>
          </Box>
        </Drawer>
      </StyledContainer>
    </ThemeProvider>
  );
}

export default App;
