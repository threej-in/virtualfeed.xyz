# VirtualFeed - AI Generated Video Platform

A modern web application that aggregates and displays AI-generated videos from various subreddits. Built with React, TypeScript, and Node.js.

## Features

- Browse AI-generated videos in a YouTube-like grid layout
- Search videos by title and description
- Filter videos by subreddit
- Sort videos by date, views, or likes
- Responsive design with dark theme
- Video playback with view and like tracking
- Automatic Reddit content scraping

## Prerequisites

- Node.js (v14 or higher)
- MongoDB
- Reddit API credentials

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   # Install frontend dependencies
   npm install

   # Install backend dependencies
   cd backend
   npm install
   ```

3. Create a `.env` file in the backend directory using `.env.example` as a template:
   ```
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/virtualfeed
   REDDIT_CLIENT_ID=your_client_id
   REDDIT_CLIENT_SECRET=your_client_secret
   REDDIT_REFRESH_TOKEN=your_refresh_token
   ```

4. Build and start the application:
   ```bash
   # Start the backend
   cd backend
   npm run build
   npm start

   # In a new terminal, start the frontend
   cd ..
   npm start
   ```

5. Open your browser and navigate to `http://localhost:3000`

## Development

- Frontend runs on port 3000
- Backend runs on port 5000
- MongoDB should be running on default port 27017

## Reddit API Setup

1. Create a Reddit account
2. Go to https://www.reddit.com/prefs/apps
3. Create a new application (script)
4. Get your client ID and client secret
5. Generate a refresh token using Reddit's OAuth flow
6. Add these credentials to your `.env` file

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
