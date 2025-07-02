import fs from 'fs';
import path from 'path';

// Define log levels
enum LogLevel {
    ERROR = 0,
    WARN = 1,
    INFO = 2,
    DEBUG = 3
}

class Logger {
    private logDir: string;
    private errorLogPath: string;
    private infoLogPath: string;
    private logLevel: LogLevel;

    constructor() {
        this.logDir = path.join(__dirname, '../../logs');
        this.errorLogPath = path.join(this.logDir, 'error.log');
        this.infoLogPath = path.join(this.logDir, 'info.log');
        
        // Default to INFO level, but can be overridden by environment variable
        const configuredLevel = process.env.LOG_LEVEL?.toUpperCase();
        if (configuredLevel === 'ERROR') this.logLevel = LogLevel.ERROR;
        else if (configuredLevel === 'WARN') this.logLevel = LogLevel.WARN;
        else if (configuredLevel === 'INFO') this.logLevel = LogLevel.INFO;
        else if (configuredLevel === 'DEBUG') this.logLevel = LogLevel.DEBUG;
        else this.logLevel = LogLevel.INFO; // Default to INFO
        
        this.initializeLogDirectory();
    }

    private initializeLogDirectory() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }

    private formatMessage(message: string, data?: any): string {
        const timestamp = new Date().toISOString();
        const dataString = data ? `\nData: ${JSON.stringify(data, null, 2)}` : '';
        return `[${timestamp}] ${message}${dataString}\n`;
    }

    error(message: string, error?: any) {
        // Always log errors regardless of log level
        const errorMessage = this.formatMessage(message, error);
        fs.appendFileSync(this.errorLogPath, errorMessage);
        console.error(errorMessage);
    }
    
    warn(message: string, data?: any) {
        if (this.logLevel >= LogLevel.WARN) {
            const warnMessage = this.formatMessage(message, data);
            fs.appendFileSync(this.infoLogPath, warnMessage);
            console.warn(warnMessage);
        }
    }

    info(message: string, data?: any) {
        if (this.logLevel >= LogLevel.INFO) {
            const infoMessage = this.formatMessage(message, data);
            fs.appendFileSync(this.infoLogPath, infoMessage);
            console.log(infoMessage);
        }
    }

    debug(message: string, data?: any) {
        if (this.logLevel >= LogLevel.DEBUG) {
            const debugMessage = this.formatMessage(message, data);
            fs.appendFileSync(this.infoLogPath, debugMessage);
            console.log(debugMessage);
        }
    }
    
    setLogLevel(level: string) {
        if (level === 'ERROR') this.logLevel = LogLevel.ERROR;
        else if (level === 'WARN') this.logLevel = LogLevel.WARN;
        else if (level === 'INFO') this.logLevel = LogLevel.INFO;
        else if (level === 'DEBUG') this.logLevel = LogLevel.DEBUG;
    }
}

export const logger = new Logger();
