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

// Function to configure logger with file transport after args are loaded
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
