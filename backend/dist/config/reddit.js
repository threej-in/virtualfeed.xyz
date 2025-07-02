"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redditClient = void 0;
const snoowrap_1 = __importDefault(require("snoowrap"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.redditClient = new snoowrap_1.default({
    userAgent: 'virtualfeed-app',
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    refreshToken: process.env.REDDIT_REFRESH_TOKEN
});
