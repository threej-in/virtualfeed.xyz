"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// Define log levels
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["ERROR"] = 0] = "ERROR";
    LogLevel[LogLevel["WARN"] = 1] = "WARN";
    LogLevel[LogLevel["INFO"] = 2] = "INFO";
    LogLevel[LogLevel["DEBUG"] = 3] = "DEBUG";
})(LogLevel || (LogLevel = {}));
class Logger {
    constructor() {
        var _a;
        this.logDir = path_1.default.join(__dirname, '../../logs');
        this.errorLogPath = path_1.default.join(this.logDir, 'error.log');
        this.infoLogPath = path_1.default.join(this.logDir, 'info.log');
        // Default to INFO level, but can be overridden by environment variable
        const configuredLevel = (_a = process.env.LOG_LEVEL) === null || _a === void 0 ? void 0 : _a.toUpperCase();
        if (configuredLevel === 'ERROR')
            this.logLevel = LogLevel.ERROR;
        else if (configuredLevel === 'WARN')
            this.logLevel = LogLevel.WARN;
        else if (configuredLevel === 'INFO')
            this.logLevel = LogLevel.INFO;
        else if (configuredLevel === 'DEBUG')
            this.logLevel = LogLevel.DEBUG;
        else
            this.logLevel = LogLevel.INFO; // Default to INFO
        this.initializeLogDirectory();
    }
    initializeLogDirectory() {
        if (!fs_1.default.existsSync(this.logDir)) {
            fs_1.default.mkdirSync(this.logDir, { recursive: true });
        }
    }
    formatMessage(message, data) {
        const timestamp = new Date().toISOString();
        const dataString = data ? `\nData: ${JSON.stringify(data, null, 2)}` : '';
        return `[${timestamp}] ${message}${dataString}\n`;
    }
    error(message, error) {
        // Always log errors regardless of log level
        const errorMessage = this.formatMessage(message, error);
        fs_1.default.appendFileSync(this.errorLogPath, errorMessage);
        console.error(errorMessage);
    }
    warn(message, data) {
        if (this.logLevel >= LogLevel.WARN) {
            const warnMessage = this.formatMessage(message, data);
            fs_1.default.appendFileSync(this.infoLogPath, warnMessage);
            console.warn(warnMessage);
        }
    }
    info(message, data) {
        if (this.logLevel >= LogLevel.INFO) {
            const infoMessage = this.formatMessage(message, data);
            fs_1.default.appendFileSync(this.infoLogPath, infoMessage);
            console.log(infoMessage);
        }
    }
    debug(message, data) {
        if (this.logLevel >= LogLevel.DEBUG) {
            const debugMessage = this.formatMessage(message, data);
            fs_1.default.appendFileSync(this.infoLogPath, debugMessage);
            console.log(debugMessage);
        }
    }
    setLogLevel(level) {
        if (level === 'ERROR')
            this.logLevel = LogLevel.ERROR;
        else if (level === 'WARN')
            this.logLevel = LogLevel.WARN;
        else if (level === 'INFO')
            this.logLevel = LogLevel.INFO;
        else if (level === 'DEBUG')
            this.logLevel = LogLevel.DEBUG;
    }
}
exports.logger = new Logger();
