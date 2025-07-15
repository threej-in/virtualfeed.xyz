const { DuplicateVideoDetector } = require('./src/services/duplicateVideoDetector');
const Video = require('./src/models/Video').default;

// Mock Reddit post submission
const mockPost = {
    id: 'test123',
    title: 'Amazing AI Generated Video',
    score: 150,
    author: { name: 'testuser' },
    subreddit: { display_name: 'testsubreddit' },
    created_utc: Date.now() / 1000
};

// Mock video metadata
const mockVideoMetadata = {
    url: 'https://v.redd.it/abc123/DASH_720.mp4',
    duration: 30,
    width: 1280,
    height: 720,
    format: 'mp4'
};

async function testDuplicateDetection() {
    try {
        console.log('Testing duplicate detection...');
        
        // Test 1: Check for exact URL match
        console.log('\nTest 1: Checking for exact URL match...');
        const result1 = await DuplicateVideoDetector.findDuplicateVideo(mockPost, mockVideoMetadata);
        console.log('Result:', result1 ? 'Duplicate found' : 'No duplicate found');
        
        // Test 2: Check for same author across subreddits
        console.log('\nTest 2: Checking for same author across subreddits...');
        const result2 = await DuplicateVideoDetector.findDuplicateVideo(mockPost, mockVideoMetadata);
        console.log('Result:', result2 ? 'Duplicate found' : 'No duplicate found');
        
        // Test 3: Check for title similarity
        console.log('\nTest 3: Checking for title similarity...');
        const result3 = await DuplicateVideoDetector.findDuplicateVideo(mockPost, mockVideoMetadata);
        console.log('Result:', result3 ? 'Duplicate found' : 'No duplicate found');
        
    } catch (error) {
        console.error('Error testing duplicate detection:', error);
    }
}

// Run the test
testDuplicateDetection(); 