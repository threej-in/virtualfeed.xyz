"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const videoController_1 = require("../controllers/videoController");
const router = express_1.default.Router();
router.get('/', videoController_1.getVideos);
router.post('/:id/stats', videoController_1.updateVideoStats);
router.post('/:id/upvotes', videoController_1.updateUpvotes);
router.get('/:id/reddit-upvotes', videoController_1.fetchRedditUpvotes);
exports.default = router;
