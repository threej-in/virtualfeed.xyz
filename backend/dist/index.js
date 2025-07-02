"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const redditScraper_1 = require("./services/redditScraper");
const logger_1 = require("./services/logger");
const database_1 = __importDefault(require("./config/database"));
const videoRoutes_1 = __importDefault(require("./routes/videoRoutes"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const port = process.env.PORT || 5000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Serve static files from the public directory
app.use(express_1.default.static('public'));
// Explicitly serve thumbnails directory
app.use('/thumbnails', express_1.default.static('public/thumbnails'));
// Routes
app.use('/api/videos', videoRoutes_1.default);
// Start server and initialize database
function startServer() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Test database connection
            yield database_1.default.authenticate();
            logger_1.logger.info('Successfully connected to MySQL database');
            // Sync database models
            yield database_1.default.sync();
            logger_1.logger.info('Database models synchronized successfully');
            // Start the server
            app.listen(port, () => {
                logger_1.logger.info(`Server is running on port ${port}`);
            });
            // Start Reddit scraper
            const startScraping = () => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield redditScraper_1.RedditScraper.scrapeSubreddits();
                }
                catch (error) {
                    logger_1.logger.error('Error in scraping cycle:', error);
                }
            });
            // Check if scraping should be enabled
            const enableScraping = process.argv.includes('--enable-scraping');
            if (enableScraping) {
                logger_1.logger.info('Reddit scraping is enabled');
                // Schedule periodic scraping (every 60 minutes instead of 30 to reduce API calls)
                setInterval(startScraping, 60 * 60 * 1000);
                // Delay initial scrape by 10 seconds to ensure server is fully started
                setTimeout(() => {
                    logger_1.logger.info('Starting initial Reddit scrape');
                    startScraping();
                }, 10000);
            }
            else {
                logger_1.logger.info('Reddit scraping is disabled. Start with --enable-scraping flag to enable');
            }
        }
        catch (error) {
            logger_1.logger.error('Error starting server:', error);
            process.exit(1);
        }
    });
}
startServer();
