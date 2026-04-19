import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { testCaseSchema, type TestCase } from "../types/test-case";
import z from "zod";
import { logger } from "./logger";
import { Command } from "commander";
import { ConfigLoader } from "../config/loader";
import { findFiles } from "./file-utils";

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

const program = new Command()
  .option("-t, --testsPath <path>", "Path to the tests file or directory")
  .option("-o, --resultsPath <path>", "Path to the results file")
  .option("-v, --verbose", "Verbose output")
  .option("-s, --screenshots", "Take screenshots")
  .option("--maxTurns <turns>", "Maximum turns per test case")
  .option("-m, --model <model>", "The model to use")
  .option("-c, --config <path>", "Path to config file", "config/cc-test.yaml")
  .option("-e, --environment <env>", "Environment to use")
  .parse(process.argv);

const args = program.opts<CLIOptions>();

// Load configuration file
const configLoader = new ConfigLoader(args.config, args.environment);
const config = configLoader.load();

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
    ? parseInt(args.maxTurns.toString())
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

// Load test cases
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

  const stat = require("fs").statSync(fullPath);

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

// Load test cases (use top-level await)
let testCases: TestCase[] = [];
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
