"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
var fs_1 = __importDefault(require("fs"));
var path_1 = __importDefault(require("path"));
var Logger = /** @class */ (function () {
    function Logger() {
        this.logDir = path_1.default.join(__dirname, '../../logs');
        this.errorLogPath = path_1.default.join(this.logDir, 'error.log');
        this.infoLogPath = path_1.default.join(this.logDir, 'info.log');
        this.initializeLogDirectory();
    }
    Logger.prototype.initializeLogDirectory = function () {
        if (!fs_1.default.existsSync(this.logDir)) {
            fs_1.default.mkdirSync(this.logDir, { recursive: true });
        }
    };
    Logger.prototype.formatMessage = function (message, data) {
        var timestamp = new Date().toISOString();
        var dataString = data ? "\nData: ".concat(JSON.stringify(data, null, 2)) : '';
        return "[".concat(timestamp, "] ").concat(message).concat(dataString, "\n");
    };
    Logger.prototype.error = function (message, error) {
        var errorMessage = this.formatMessage(message, error);
        fs_1.default.appendFileSync(this.errorLogPath, errorMessage);
        console.error(errorMessage);
    };
    Logger.prototype.info = function (message, data) {
        var infoMessage = this.formatMessage(message, data);
        fs_1.default.appendFileSync(this.infoLogPath, infoMessage);
        console.log(infoMessage);
    };
    return Logger;
}());
exports.logger = new Logger();
