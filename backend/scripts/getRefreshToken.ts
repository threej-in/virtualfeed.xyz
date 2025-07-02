const express = require('express');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const port = 5000;

const clientId = process.env.REDDIT_CLIENT_ID;
const clientSecret = process.env.REDDIT_CLIENT_SECRET;
const redirectUri = 'http://localhost:5000/callback';
const scope = ['read', 'history'];

// Generate the Reddit authorization URL
const authUrl = `https://www.reddit.com/api/v1/authorize?client_id=${clientId}&response_type=code&state=randomstring&redirect_uri=${redirectUri}&duration=permanent&scope=${scope.join(' ')}`;

console.log('\nPlease open this URL in your browser to authorize the application:');
console.log(authUrl);
console.log('\nWaiting for callback...\n');

app.get('/callback', async (req, res) => {
    const code = req.query.code;
    
    try {
        // Exchange the code for a refresh token
        const response = await fetch('https://www.reddit.com/api/v1/access_token', {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: `grant_type=authorization_code&code=${code}&redirect_uri=${redirectUri}`
        });

        const data = await response.json();
        
        console.log('\nYour refresh token is:', data.refresh_token);
        console.log('\nAdd this to your .env file as REDDIT_REFRESH_TOKEN\n');
        
        res.send('Successfully obtained refresh token! You can close this window.');
        
        // Exit the process after a short delay
        setTimeout(() => process.exit(0), 1000);
    } catch (error) {
        console.error('Error getting refresh token:', error);
        res.status(500).send('Error getting refresh token');
    }
});

app.listen(port);
