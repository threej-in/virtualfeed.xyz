const mysql = require('mysql2/promise');

async function checkPlatforms() {
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'localhost',
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'virtualfeed',
  });

  try {
    // Check platform distribution
    const [platformResults] = await connection.execute(
      'SELECT platform, COUNT(*) as count FROM videos GROUP BY platform'
    );
    
    console.log('Platform distribution:');
    platformResults.forEach(row => {
      console.log(`${row.platform}: ${row.count} videos`);
    });

    // Check some sample videos
    const [sampleVideos] = await connection.execute(
      'SELECT id, title, platform, subreddit FROM videos ORDER BY createdAt DESC LIMIT 10'
    );
    
    console.log('\nSample videos:');
    sampleVideos.forEach(video => {
      console.log(`ID: ${video.id}, Platform: ${video.platform}, Subreddit: ${video.subreddit}, Title: ${video.title.substring(0, 50)}...`);
    });

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await connection.end();
  }
}

checkPlatforms(); 