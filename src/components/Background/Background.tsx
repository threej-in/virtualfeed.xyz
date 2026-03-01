import React from 'react';
import { Box } from '@mui/material';

const Background: React.FC = () => {
  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: -1,
        backgroundColor: '#0f0f0f',
      }}
    />
  );
};

export default Background;
