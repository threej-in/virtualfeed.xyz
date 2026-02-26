import { logger } from '../services/logger';
import { LanguageDetector } from '../utils/languageDetection';

const addLanguageColumn = async () => {
  try {
    const db = require('../config/database').default;
    
    // Add language column if it doesn't exist
    await db.query(`
      ALTER TABLE videos 
      ADD COLUMN IF NOT EXISTS language VARCHAR(50) DEFAULT NULL
    `);
    
    logger.info('Language column added to videos table');
    
    // Update existing videos with language detection
    const [videos] = await db.query('SELECT id, title, description, tags FROM videos WHERE language IS NULL');
    
    logger.info(`Found ${videos.length} videos without language information`);
    
    let updatedCount = 0;
    
    for (const video of videos) {
      try {
        // Detect language from video content
        const languageDetection = LanguageDetector.detectVideoLanguage({
          title: video.title || '',
          description: video.description || '',
          tags: video.tags || []
        });
        
        // Update video with detected language
        await db.query(
          'UPDATE videos SET language = ? WHERE id = ?',
          [languageDetection.language, video.id]
        );
        
        updatedCount++;
        
        if (updatedCount % 100 === 0) {
          logger.info(`Updated ${updatedCount} videos with language information`);
        }
      } catch (error) {
        logger.error(`Error updating language for video ${video.id}:`, error);
      }
    }
    
    logger.info(`Successfully updated ${updatedCount} videos with language information`);
    
  } catch (error) {
    logger.error('Error adding language column:', error);
    throw error;
  }
};

// Run the migration if this file is executed directly
if (require.main === module) {
  addLanguageColumn()
    .then(() => {
      logger.info('Language column migration completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Language column migration failed:', error);
      process.exit(1);
    });
}

export default addLanguageColumn; 