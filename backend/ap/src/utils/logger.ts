import winston from 'winston';

export const logger = winston.createLogger({
    level: 'debug',
    format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.Console()
    ]
});

interface LogInfo {
    level: string;
    message: string;
    timestamp?: string;
    [key: string]: any;
}

const error = (message: string | Error, meta?: any): winston.Logger => {
    const logInfo: LogInfo = {
        level: 'error',
        message: message instanceof Error ? message.message : message,
        timestamp: new Date().toISOString(),
        ...meta
    };

    if (message instanceof Error) {
        logInfo.stack = message.stack;
    }

    return logger.log(logInfo);
};

const warn = (message: string, meta?: any): winston.Logger => {
    return logger.log({
        level: 'warn',
        message,
        timestamp: new Date().toISOString(),
        ...meta
    });
};

const info = (message: string, meta?: any): winston.Logger => {
    return logger.log({
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        ...meta
    });
};

export const customLogger = {
    error,
    warn,
    info,
    log: logger.log.bind(logger)
};