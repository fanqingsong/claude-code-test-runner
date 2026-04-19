import { Command } from "commander";
import { ConfigLoader } from "../config/loader";
import { logger } from "../utils/logger";
import { writeFile } from "../utils/file-utils";

export const configCommands = new Command()
  .name("config")
  .description("Configuration management commands");

// Validate configuration
configCommands
  .command("validate")
  .description("Validate configuration file")
  .option("-c, --config <path>", "Path to config file", "config/cc-test.yaml")
  .option("-e, --environment <env>", "Environment to validate")
  .action(async (options) => {
    const loader = new ConfigLoader(options.config, options.environment);
    try {
      const config = loader.load();
      logger.info(
        `✅ Configuration is valid for environment: ${loader.getEnvironment()}`
      );
      logger.debug(JSON.stringify(config, null, 2));
      process.exit(0);
    } catch (error) {
      logger.error("❌ Configuration validation failed");
      logger.error(String(error));
      process.exit(1);
    }
  });

// Show current configuration
configCommands
  .command("show")
  .description("Show current configuration")
  .option("-c, --config <path>", "Path to config file", "config/cc-test.yaml")
  .option("-e, --environment <env>", "Environment to show")
  .option("-j, --json", "Output as JSON")
  .action(async (options) => {
    const loader = new ConfigLoader(options.config, options.environment);
    const config = loader.load();

    logger.info(`Environment: ${loader.getEnvironment()}`);
    logger.info(`Config file: ${options.config}`);

    if (options.json) {
      console.log(JSON.stringify(config, null, 2));
    } else {
      console.log("\n# Current Configuration");
      console.log(JSON.stringify(config, null, 2));
    }
  });

// Initialize configuration file
configCommands
  .command("init")
  .description("Create a sample configuration file")
  .option("-o, --output <path>", "Output path", "config/cc-test.yaml")
  .option("--force", "Overwrite existing file")
  .action(async (options) => {
    const sampleConfig = `# Claude Code Test Runner Configuration
# This file supports environment-specific configurations

# Default configuration (used as base for all environments)
default:
  # Test file configuration
  tests:
    path: ./tests
    patterns:
      - "**/*.json"
    exclude:
      - "**/node_modules/**"

  # Execution configuration
  execution:
    resultsPath: ./results
    verbose: false
    screenshots: false
    maxTurns: 30
    timeout: 300000  # 5 minutes in milliseconds

  # Claude AI configuration
  claude:
    model: claude-sonnet-4-6

# Environment-specific configurations
# These override the default configuration
environments:
  # Development environment - verbose output, more debugging
  development:
    execution:
      verbose: true
      screenshots: true
      maxTurns: 50

  # Testing environment - balanced performance
  testing:
    execution:
      resultsPath: ./test-results
      screenshots: true
    claude:
      model: claude-haiku-4-5-20251001

  # Production environment - optimized for speed
  production:
    execution:
      maxTurns: 20
      timeout: 180000  # 3 minutes
    tests:
      exclude:
        - "**/experimental/**"
`;

    try {
      await writeFile(options.output, sampleConfig);
      logger.info(`✅ Created sample configuration at ${options.output}`);
      logger.info(
        "Edit this file to customize your test runner settings"
      );
    } catch (error) {
      if (String(error).includes("EEXIST") && !options.force) {
        logger.error(
          `Configuration file already exists at ${options.output}`
        );
        logger.info('Use --force to overwrite the existing file');
        process.exit(1);
      } else {
        logger.error(`Failed to create configuration file: ${error}`);
        process.exit(1);
      }
    }
  });