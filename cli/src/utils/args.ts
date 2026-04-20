import { readFileSync, existsSync, statSync } from "fs";
import { resolve } from "path";
import { testCaseSchema, type TestCase } from "../types/test-case.js";
import z from "zod";
import { Command } from "commander";
import { ConfigLoader } from "../config/loader.js";
import { findFiles } from "./file-utils.js";
import { type EnvironmentConfig } from "../types/config.js";
import { logger, configureLogger } from "./logger.js";

interface CLIOptions {
  testsPath?: string;
  resultsPath?: string;
  verbose?: boolean;
  maxTurns?: number;
  screenshots?: boolean;
  model?: string;
  config?: string;
  environment?: string;
}

// Create program but don't parse yet - let the main program handle parsing
const program = new Command()
  .option("-t, --testsPath <path>", "Path to the tests file or directory")
  .option("-o, --resultsPath <path>", "Path to the results file")
  .option("-v, --verbose", "Verbose output")
  .option("-s, --screenshots", "Take screenshots")
  .option("--maxTurns <turns>", "Maximum turns per test case")
  .option("-m, --model <model>", "The model to use")
  .option("-c, --config <path>", "Path to config file", "config/cc-test.yaml")
  .option("-e, --environment <env>", "Environment to use");

// We'll parse later, after the main program sets up subcommands
let args: CLIOptions = {};

export function parseArgs() {
  program.parse(process.argv);
  args = program.opts<CLIOptions>();
  return args;
}

// Configure logger after args are loaded
export function setupLogger(config: any) {
  configureLogger(
    config.execution?.resultsPath || './results',
    config.execution?.verbose || false
  );
}

export { program };

// Load configuration file
const configLoader = new ConfigLoader(args.config, args.environment);
let config: EnvironmentConfig = {};
try {
  config = configLoader.load();
} catch (error) {
  logger.error(`Failed to load configuration: ${error}`);
  logger.info("Proceeding with CLI arguments and defaults only");
  // Continue with empty config (CLI args will provide values)
}

// Validate CLI-provided values
if (args.maxTurns !== undefined) {
  const maxTurns = parseInt(args.maxTurns.toString());
  if (isNaN(maxTurns) || maxTurns < 1 || maxTurns > 100) {
    logger.error(`maxTurns must be between 1 and 100, got: ${args.maxTurns}`);
    process.exit(1);
  }
}

// Merge configuration with CLI arguments (CLI args take precedence)
const mergedConfig: {
  testsPath?: string;
  resultsPath: string;
  verbose: boolean;
  screenshots: boolean;
  maxTurns: number;
  model?: string;
  testPatterns: string[];
  testExclude: string[];
} = {
  testsPath: args.testsPath ?? config.tests?.path,
  resultsPath:
    args.resultsPath ??
    config.execution?.resultsPath ??
    `./results/${new Date().getMilliseconds()}`,
  verbose: args.verbose ?? config.execution?.verbose ?? false,
  screenshots: args.screenshots ?? config.execution?.screenshots ?? false,
  maxTurns: args.maxTurns
    ? (() => {
        const parsed = parseInt(args.maxTurns.toString());
        if (isNaN(parsed) || parsed < 1 || parsed > 100) {
          throw new Error(`maxTurns must be a number between 1 and 100, got: ${args.maxTurns}`);
        }
        return parsed;
      })()
    : config.execution?.maxTurns ?? 30,
  model: args.model ?? config.claude?.model,
  testPatterns: config.tests?.patterns ?? ["**/*.json"],
  testExclude: config.tests?.exclude ?? [],
};

// Log configuration source
if (configLoader.getRawConfig()) {
  logger.info(`Using environment: ${configLoader.getEnvironment()}`);
  logger.debug(`Configuration loaded from: ${args.config}`);
}

/**
 * Loads test cases from a specified path, which can be a single file or a directory.
 * Supports filtering by file patterns and exclusion patterns.
 *
 * @param testsPath - Path to the tests file or directory
 * @param patterns - Glob patterns to match test files (e.g., glob patterns)
 * @param exclude - Glob patterns to exclude from matching (e.g., exclude patterns)
 * @returns Promise<TestCase[]> Array of loaded and validated test cases
 * @throws Error if tests path doesn't exist or if a file cannot be parsed
 */
async function loadTestCases(
  testsPath: string,
  patterns: string[],
  exclude: string[]
): Promise<TestCase[]> {
  const testCases: TestCase[] = [];

  // Check if testsPath is a file or directory
  const fullPath = resolve(testsPath);
  if (!existsSync(fullPath)) {
    throw new Error(`Tests path does not exist: ${fullPath}`);
  }

  const stat = statSync(fullPath);

  if (stat.isFile()) {
    // Load single file
    const testCasesJson = readFileSync(fullPath, "utf-8");
    const cases = z.array(testCaseSchema).parse(JSON.parse(testCasesJson));
    testCases.push(...cases);
  } else if (stat.isDirectory()) {
    // Load all matching files in directory
    const files = await findFiles(patterns, testsPath, exclude);

    for (const file of files) {
      const filePath = resolve(testsPath, file);
      try {
        const testCasesJson = readFileSync(filePath, "utf-8");
        const cases = z.array(testCaseSchema).parse(JSON.parse(testCasesJson));
        testCases.push(...cases);
      } catch (error) {
        logger.warn(`Failed to load test cases from ${filePath}: ${error}`);
      }
    }
  }

  return testCases;
}

// Load test cases (use top-level await) - but only if not in config mode
let testCases: TestCase[] = [];
const isConfigMode = process.argv.slice(2)[0] === 'config';

if (!isConfigMode) {
  try {
    testCases = await loadTestCases(
      mergedConfig.testsPath ?? "./tests",
      mergedConfig.testPatterns,
      mergedConfig.testExclude
    );
  } catch (error) {
    logger.error("Error loading test cases", { error });
    process.exit(1);
  }
}

const inputs: CLIOptions & {
  testCases: TestCase[];
  resultsPath: string;
  verbose: boolean;
  screenshots: boolean;
  maxTurns: number;
  model?: string;
} = {
  ...args,
  testCases,
  resultsPath: mergedConfig.resultsPath,
  verbose: mergedConfig.verbose,
  screenshots: mergedConfig.screenshots,
  maxTurns: mergedConfig.maxTurns,
  model: mergedConfig.model,
};

export { inputs, configLoader };
