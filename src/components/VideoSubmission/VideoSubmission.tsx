import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Typography,
  Box,
  Alert,
  CircularProgress,
  styled,
  Chip,
  FormControlLabel,
  Switch,
} from '@mui/material';
import { motion } from 'framer-motion';
import RedditIcon from '@mui/icons-material/Reddit';
import LinkIcon from '@mui/icons-material/Link';
import InfoIcon from '@mui/icons-material/Info';

const StyledDialog = styled(Dialog)(({ theme }) => ({
  '& .MuiDialog-paper': {
    borderRadius: 16,
    background: 'rgba(18, 18, 18, 0.95)',
    backdropFilter: 'blur(10px)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
    maxWidth: 500,
    width: '100%',
    color: '#ffffff',
  },
}));

const StyledTextField = styled(TextField)(({ theme }) => ({
  '& .MuiOutlinedInput-root': {
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    '& fieldset': {
      borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    '&:hover fieldset': {
      borderColor: theme.palette.primary.main,
    },
    '&.Mui-focused fieldset': {
      borderColor: theme.palette.primary.main,
    },
    '& .MuiInputBase-input': {
      color: '#ffffff',
    },
    '& .MuiInputLabel-root': {
      color: 'rgba(255, 255, 255, 0.7)',
    },
    '& .MuiInputLabel-root.Mui-focused': {
      color: theme.palette.primary.main,
    },
  },
}));

const SubmitButton = styled(Button)(({ theme }) => ({
  borderRadius: 12,
  textTransform: 'none',
  fontWeight: 600,
  padding: '12px 24px',
  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  '&:hover': {
    background: 'linear-gradient(135deg, #5a6fd8 0%, #6a4190 100%)',
  },
}));

interface VideoSubmissionProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (redditUrl: string, isNsfw: boolean) => Promise<void>;
}

const VideoSubmission: React.FC<VideoSubmissionProps> = ({ open, onClose, onSubmit }) => {
  const [redditUrl, setRedditUrl] = useState('');
  const [isNsfw, setIsNsfw] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async () => {
    if (!redditUrl.trim()) {
      setError('Please enter a Reddit video URL');
      return;
    }

    // Basic Reddit URL validation
    const redditUrlPattern = /^https?:\/\/(www\.)?reddit\.com\/r\/[^]+\/comments\/[^]+\/[^]+\/?/;
    if (!redditUrlPattern.test(redditUrl)) {
      setError('Please enter a valid Reddit post URL');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await onSubmit(redditUrl, isNsfw);
      setSuccess(true);
      setRedditUrl('');
      setIsNsfw(false);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit video');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setRedditUrl('');
      setIsNsfw(false);
      setError('');
      setSuccess(false);
      onClose();
    }
  };

  return (
    <StyledDialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
      >
        <DialogTitle sx={{ 
          textAlign: 'center', 
          pb: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1
        }}>
          <RedditIcon sx={{ color: '#FF4500', fontSize: 28 }} />
          <Typography variant="h5" fontWeight={600}>
            Submit AI Video
          </Typography>
        </DialogTitle>

        <DialogContent sx={{ pt: 2 }}>
          {success ? (
            <Box sx={{ textAlign: 'center', py: 3 }}>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 260, damping: 20 }}
              >
                               <Alert severity="success" sx={{ 
                 mb: 2,
                 backgroundColor: 'rgba(76, 175, 80, 0.1)',
                 color: '#4caf50',
                 border: '1px solid rgba(76, 175, 80, 0.3)'
               }}>
                 Video submitted successfully! It will be reviewed and added to our collection.
               </Alert>
              </motion.div>
            </Box>
          ) : (
            <>
              <Box sx={{ mb: 3 }}>
                                 <Alert 
                   severity="info" 
                   icon={<InfoIcon />}
                   sx={{ 
                     borderRadius: 2,
                     background: 'rgba(25, 118, 210, 0.1)',
                     border: '1px solid rgba(25, 118, 210, 0.3)',
                     color: '#64b5f6'
                   }}
                 >
                                   <Typography variant="body2">
                   Share your favorite AI-generated videos from Reddit! We only accept videos that are clearly created using AI tools like Stable Diffusion, Midjourney, DALL-E, or other AI generation platforms.
                 </Typography>
                </Alert>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                  Reddit Video URL
                </Typography>
                <StyledTextField
                  fullWidth
                  placeholder="https://reddit.com/r/artificial/comments/..."
                  value={redditUrl}
                  onChange={(e) => setRedditUrl(e.target.value)}
                  disabled={isSubmitting}
                  InputProps={{
                    startAdornment: <LinkIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                  }}
                />
                <Typography variant="caption" sx={{ mt: 1, display: 'block', color: 'rgba(255, 255, 255, 0.6)' }}>
                  Paste the full URL of the Reddit post containing the AI video
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={isNsfw}
                      onChange={(e) => setIsNsfw(e.target.checked)}
                      disabled={isSubmitting}
                      sx={{
                        '& .MuiSwitch-switchBase.Mui-checked': {
                          color: '#ff6b6b',
                          '&:hover': {
                            backgroundColor: 'rgba(255, 107, 107, 0.08)',
                          },
                        },
                        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
                          backgroundColor: '#ff6b6b',
                        },
                      }}
                    />
                  }
                  label={
                    <Typography variant="body2" sx={{ color: 'rgba(255, 255, 255, 0.8)' }}>
                      This video contains NSFW content
                    </Typography>
                  }
                />
              </Box>

              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                  What we're looking for:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  <Chip 
                    label="AI Generated" 
                    size="small" 
                    color="primary" 
                    variant="outlined"
                  />
                  <Chip 
                    label="Machine Learning" 
                    size="small" 
                    color="primary" 
                    variant="outlined"
                  />
                  <Chip 
                    label="Neural Networks" 
                    size="small" 
                    color="primary" 
                    variant="outlined"
                  />
                  <Chip 
                    label="Deep Learning" 
                    size="small" 
                    color="primary" 
                    variant="outlined"
                  />
                  <Chip 
                    label="AI Art" 
                    size="small" 
                    color="primary" 
                    variant="outlined"
                  />
                  <Chip 
                    label="AI Tools" 
                    size="small" 
                    color="primary" 
                    variant="outlined"
                  />
                </Box>
              </Box>

                             {error && (
                 <Alert severity="error" sx={{ 
                   mb: 2,
                   backgroundColor: 'rgba(244, 67, 54, 0.1)',
                   color: '#f44336',
                   border: '1px solid rgba(244, 67, 54, 0.3)'
                 }}>
                   {error}
                 </Alert>
               )}
            </>
          )}
        </DialogContent>

        {!success && (
          <DialogActions sx={{ px: 3, pb: 3 }}>
            <Button 
              onClick={handleClose} 
              disabled={isSubmitting}
              sx={{ borderRadius: 2 }}
            >
              Cancel
            </Button>
            <SubmitButton
              onClick={handleSubmit}
              disabled={isSubmitting || !redditUrl.trim()}
              variant="contained"
              startIcon={isSubmitting ? <CircularProgress size={16} color="inherit" /> : <RedditIcon />}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Video'}
            </SubmitButton>
          </DialogActions>
        )}
      </motion.div>
    </StyledDialog>
  );
};

export default VideoSubmission; 