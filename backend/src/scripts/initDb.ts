import sequelize from '../config/database';
import Video from '../models/Video';
import { logger } from '../services/logger';

async function initializeDatabase() {
    try {
        // Test database connection
        await sequelize.authenticate();
        logger.info('Successfully connected to MySQL database');

        // Sync all models with database
        await sequelize.sync({ alter: true });
        logger.info('Database models synchronized successfully');
    } catch (error) {
        logger.error('Error initializing database:', error);
        process.exit(1);
    }
}

initializeDatabase();
