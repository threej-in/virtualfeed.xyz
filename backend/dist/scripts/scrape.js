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
const redditScraper_1 = require("../services/redditScraper");
const logger_1 = require("../services/logger");
const database_1 = __importDefault(require("../config/database"));
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Test database connection
            yield database_1.default.authenticate();
            logger_1.logger.info('Database connection established successfully.');
            // Sync models
            yield database_1.default.sync();
            logger_1.logger.info('Database models synchronized.');
            // Start scraping
            yield redditScraper_1.RedditScraper.scrapeSubreddits();
        }
        catch (error) {
            logger_1.logger.error('Error in scrape script:', error);
            process.exit(1);
        }
        finally {
            yield database_1.default.close();
        }
    });
}
main();
