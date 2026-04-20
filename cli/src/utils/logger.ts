import winston from "winston";

// Simple console logger for initialization
export const logger = winston.createLogger({
    level: "info",
    transports: [
        new winston.transports.Console({
            format: winston.format.combine(winston.format.timestamp(), winston.format.colorize(), winston.format.simple()),
        }),
    ],
});

/**
 * Configures the logger with console and file transports based on verbosity level.
 * @param resultsPath - Directory path where debug log file will be created.
 * @param verbose - Whether to enable debug level logging to console.
 */
export function configureLogger(resultsPath: string, verbose: boolean) {
    logger.clear();
    logger.add(new winston.transports.Console({
        level: verbose ? "debug" : "info",
        format: winston.format.combine(winston.format.timestamp(), winston.format.colorize(), winston.format.simple()),
    }));
    logger.add(new winston.transports.File({
        filename: `${resultsPath}/debug.log`,
        level: "debug",
        format: winston.format.combine(winston.format.timestamp(), winston.format.json()),
    }));
}
