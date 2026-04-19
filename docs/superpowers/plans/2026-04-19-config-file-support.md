# Configuration File Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add YAML-based configuration file support with environment management and smart CLI argument merging

**Architecture:** Configuration loader reads YAML files, detects environments (CLI arg → env var → Git branch), deep merges default + environment configs, validates values at runtime, and integrates with existing CLI argument parsing

**Tech Stack:** TypeScript, Zod (validation), js-yaml (parsing), Commander (CLI), Glob (pattern matching)

---

## File Structure

**New files:**
- `cli/src/types/config.ts` - Configuration type definitions with Zod schemas
- `cli/src/config/loader.ts` - Configuration loading and environment detection
- `cli/src/config/validator.ts` - Runtime configuration value validation
- `cli/src/commands/config.ts` - Configuration management CLI commands
- `cli/src/utils/file-utils.ts` - File system utilities (glob matching)
- `config/cc-test.yaml` - Sample configuration file
- `cli/src/tests/config.test.ts` - Configuration unit tests

**Modified files:**
- `cli/src/utils/args.ts` - Integrate config loading and merging
- `cli/src/index.ts` - Register config commands
- `cli/package.json` - Add dependencies
- `README.md` - Document configuration feature

---

## Task 1: Add Dependencies

**Files:**
- Modify: `cli/package.json`

- [ ] **Step 1: Add js-yaml dependency**

```bash
cd cli
bun add js-yaml
```

Expected: package.json updated with `js-yaml: ^4.1.0`

- [ ] **Step 2: Add glob dependency**

```bash
bun add glob
```

Expected: package.json updated with `glob: ^10.3.0`

- [ ] **Step 3: Add TypeScript types**

```bash
bun add -d @types/js-yaml
```

Expected: Dev dependency added

- [ ] **Step 4: Commit dependencies**

```bash
git add cli/package.json bun.lock
git commit -m "feat: add js-yaml and glob dependencies for config file support"
```

---

## Task 2: Create Configuration Type Definitions

**Files:**
- Create: `cli/src/types/config.ts`

- [ ] **Step 1: Write the configuration types**

```typescript
import z from "zod";

/**
 * Supported environment names
 */
export const environmentSchema = z.enum([
  "development",
  "testing",
  "production",
  "staging",
]);

export type Environment = z.infer<typeof environmentSchema>;

/**
 * Test configuration options
 */
export const testsConfigSchema = z.object({
  path: z.string().default("./tests"),
  patterns: z.array(z.string()).default(["**/*.json"]),
  exclude: z.array(z.string()).default([]),
});

export type TestsConfig = z.infer<typeof testsConfigSchema>;

/**
 * Execution configuration options
 */
export const executionConfigSchema = z.object({
  resultsPath: z.string().default("./results"),
  verbose: z.boolean().default(false),
  screenshots: z.boolean().default(false),
  maxTurns: z.number().min(1).max(100).default(30),
  timeout: z.number().min(1000).default(300000),
});

export type ExecutionConfig = z.infer<typeof executionConfigSchema>;

/**
 * Claude AI configuration options
 */
export const claudeConfigSchema = z.object({
  model: z.string().optional(),
});

export type ClaudeConfig = z.infer<typeof claudeConfigSchema>;

/**
 * Single environment configuration
 */
export const environmentConfigSchema = z.object({
  tests: testsConfigSchema.optional(),
  execution: executionConfigSchema.optional(),
  claude: claudeConfigSchema.optional(),
});

export type EnvironmentConfig = z.infer<typeof environmentConfigSchema>;

/**
 * Complete configuration file structure
 */
export const configFileSchema = z.object({
  default: environmentConfigSchema,
  environments: z.record(environmentSchema, environmentConfigSchema).optional(),
});

export type ConfigFile = z.infer<typeof configFileSchema>;
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd cli
bun run tsc --noEmit
```

Expected: No type errors

- [ ] **Step 3: Commit type definitions**

```bash
git add cli/src/types/config.ts
git commit -m "feat: add configuration type definitions with Zod schemas"
```

---

## Task 3: Create File Utilities

**Files:**
- Create: `cli/src/utils/file-utils.ts`

- [ ] **Step 1: Write file utility functions**

```typescript
import { glob } from "glob";
import { promises as fs } from "fs";
import { resolve, dirname } from "path";

/**
 * Find files matching glob patterns
 */
export async function findFiles(
  patterns: string[],
  basePath: string = ".",
  excludePatterns: string[] = []
): Promise<string[]> {
  const allFiles: string[] = [];

  for (const pattern of patterns) {
    const files = await glob(pattern, {
      cwd: basePath,
      absolute: false,
      ignore: excludePatterns,
      nodir: true,
    });
    allFiles.push(...files);
  }

  // Remove duplicates and sort
  return [...new Set(allFiles)].sort();
}

/**
 * Ensure directory exists, create if not
 */
export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    // Ignore if directory already exists
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
  }
}

/**
 * Read JSON file safely
 */
export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf-8");
  return JSON.parse(content) as T;
}

/**
 * Write file ensuring directory exists
 */
export async function writeFile(
  filePath: string,
  content: string
): Promise<void> {
  await ensureDir(dirname(filePath));
  await fs.writeFile(filePath, content, "utf-8");
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd cli
bun run tsc --noEmit
```

Expected: No type errors

- [ ] **Step 3: Commit file utilities**

```bash
git add cli/src/utils/file-utils.ts
git commit -m "feat: add file system utilities for glob and file operations"
```

---

## Task 4: Create Configuration Validator

**Files:**
- Create: `cli/src/config/validator.ts`

- [ ] **Step 1: Write configuration validator**

```typescript
import { logger } from "../utils/logger";
import type { TestsConfig, ExecutionConfig, ClaudeConfig } from "../types/config";

/**
 * Validation result
 */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate tests configuration
 */
export function validateTestsConfig(config: TestsConfig): ValidationResult {
  const errors: string[] = [];

  if (!config.path || config.path.trim().length === 0) {
    errors.push("tests.path must be a non-empty string");
  }

  if (!Array.isArray(config.patterns)) {
    errors.push("tests.patterns must be an array");
  }

  if (!Array.isArray(config.exclude)) {
    errors.push("tests.exclude must be an array");
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate execution configuration
 */
export function validateExecutionConfig(config: ExecutionConfig): ValidationResult {
  const errors: string[] = [];

  if (config.maxTurns < 1 || config.maxTurns > 100) {
    errors.push(`execution.maxTurns must be between 1 and 100, got ${config.maxTurns}`);
  }

  if (config.timeout < 1000) {
    errors.push(`execution.timeout must be at least 1000ms, got ${config.timeout}`);
  }

  if (typeof config.verbose !== "boolean") {
    errors.push(`execution.verbose must be a boolean, got ${typeof config.verbose}`);
  }

  if (typeof config.screenshots !== "boolean") {
    errors.push(`execution.screenshots must be a boolean, got ${typeof config.screenshots}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate Claude configuration
 */
export function validateClaudeConfig(config: ClaudeConfig): ValidationResult {
  const errors: string[] = [];

  if (config.model !== undefined && typeof config.model !== "string") {
    errors.push(`claude.model must be a string, got ${typeof config.model}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Log validation errors with suggestions
 */
export function logValidationErrors(
  context: string,
  result: ValidationResult
): void {
  if (!result.isValid) {
    logger.error(`Configuration validation failed for ${context}`);
    result.errors.forEach((error) => {
      logger.error(`  - ${error}`);
    });
  }
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd cli
bun run tsc --noEmit
```

Expected: No type errors

- [ ] **Step 3: Commit validator**

```bash
git add cli/src/config/validator.ts
git commit -m "feat: add configuration validator with detailed error messages"
```

---

## Task 5: Create Configuration Loader

**Files:**
- Create: `cli/src/config/loader.ts`

- [ ] **Step 1: Write configuration loader**

```typescript
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import * as yaml from "js-yaml";
import {
  configFileSchema,
  type ConfigFile,
  type EnvironmentConfig,
  type Environment,
} from "../types/config";
import { logger } from "../utils/logger";
import {
  validateTestsConfig,
  validateExecutionConfig,
  validateClaudeConfig,
  logValidationErrors,
} from "./validator";

export class ConfigLoader {
  private configPath: string;
  private environment: Environment;
  private configFile: ConfigFile | null = null;
  private mergedConfig: EnvironmentConfig = {};

  constructor(
    configPath: string = "config/cc-test.yaml",
    environment?: string
  ) {
    this.configPath = configPath;
    this.environment = this.detectEnvironment(environment);
  }

  /**
   * Detect environment from multiple sources
   * Priority: parameter > env var > git branch > default
   */
  private detectEnvironment(environment?: string): Environment {
    if (environment) {
      return this.isValidEnvironment(environment)
        ? (environment as Environment)
        : "development";
    }

    // Check environment variables
    const envFromVar =
      process.env.CC_TEST_ENV || process.env.NODE_ENV;
    if (envFromVar && this.isValidEnvironment(envFromVar)) {
      return envFromVar as Environment;
    }

    // Try to detect from Git branch
    const gitBranch = this.detectGitBranch();
    if (gitBranch) {
      return gitBranch;
    }

    return "development"; // Default
  }

  /**
   * Validate if string is a valid environment
   */
  private isValidEnvironment(env: string): boolean {
    return ["development", "testing", "production", "staging"].includes(env);
  }

  /**
   * Detect environment from Git branch
   */
  private detectGitBranch(): Environment | null {
    try {
      // Use GIT_BRANCH env var if available (CI/CD)
      if (process.env.GIT_BRANCH) {
        const branch = process.env.GIT_BRANCH.split("/").pop() || "";
        return this.mapBranchToEnvironment(branch);
      }

      // Otherwise try to run git command
      const { execSync } = require("child_process");
      const branch = execSync("git rev-parse --abbrev-ref HEAD", {
        encoding: "utf-8",
        stdio: ["pipe", "pipe", "ignore"],
      }).trim();

      return this.mapBranchToEnvironment(branch);
    } catch {
      // Git not available, return null
      return null;
    }
  }

  /**
   * Map Git branch name to environment
   */
  private mapBranchToEnvironment(branch: string): Environment | null {
    if (branch === "main" || branch === "master") {
      return "production";
    } else if (branch.includes("dev") || branch.includes("feature")) {
      return "development";
    } else if (branch.includes("test") || branch.includes("release")) {
      return "testing";
    }
    return null;
  }

  /**
   * Load and parse configuration file
   */
  public load(): EnvironmentConfig {
    if (!existsSync(this.configPath)) {
      logger.debug(
        `Configuration file not found at ${this.configPath}, using defaults`
      );
      return {};
    }

    try {
      const fileContent = readFileSync(this.configPath, "utf8");
      const parsed = yaml.load(fileContent) as object;
      this.configFile = configFileSchema.parse(parsed);

      logger.info(`Loaded configuration from ${this.configPath}`);
      logger.debug(`Using environment: ${this.environment}`);

      this.mergedConfig = this.getMergedConfig();

      // Validate configuration
      this.validateConfiguration();

      return this.mergedConfig;
    } catch (error) {
      this.handleConfigError(error as Error);
      return {};
    }
  }

  /**
   * Merge default and environment-specific configurations
   */
  private getMergedConfig(): EnvironmentConfig {
    if (!this.configFile) {
      return {};
    }

    const defaultConfig = this.configFile.default;
    const envConfig =
      this.configFile.environments?.[this.environment] || {};

    // Deep merge configurations
    return {
      tests: { ...defaultConfig.tests, ...envConfig.tests },
      execution: { ...defaultConfig.execution, ...envConfig.execution },
      claude: { ...defaultConfig.claude, ...envConfig.claude },
    };
  }

  /**
   * Validate loaded configuration
   */
  private validateConfiguration(): void {
    if (this.mergedConfig.tests) {
      const result = validateTestsConfig(this.mergedConfig.tests);
      if (!result.isValid) {
        logValidationErrors("tests", result);
      }
    }

    if (this.mergedConfig.execution) {
      const result = validateExecutionConfig(this.mergedConfig.execution);
      if (!result.isValid) {
        logValidationErrors("execution", result);
      }
    }

    if (this.mergedConfig.claude) {
      const result = validateClaudeConfig(this.mergedConfig.claude);
      if (!result.isValid) {
        logValidationErrors("claude", result);
      }
    }
  }

  /**
   * Handle configuration errors with helpful messages
   */
  private handleConfigError(error: Error): void {
    const errorMessage = error.message;
    let suggestion = "";

    if (errorMessage.includes("YAML")) {
      suggestion = "Check YAML syntax at https://www.yamllint.com/";
    } else if (errorMessage.includes("required")) {
      suggestion = "Ensure all required fields are present in the configuration";
    } else if (errorMessage.includes("invalid")) {
      suggestion = "Verify field types and values match the expected format";
    }

    logger.error(`Configuration error: ${errorMessage}`);
    if (suggestion) {
      logger.info(`Suggestion: ${suggestion}`);
    }

    throw error;
  }

  /**
   * Get current environment
   */
  public getEnvironment(): Environment {
    return this.environment;
  }

  /**
   * Get merged configuration
   */
  public getConfiguration(): EnvironmentConfig {
    return this.mergedConfig;
  }

  /**
   * Get raw configuration file
   */
  public getRawConfig(): ConfigFile | null {
    return this.configFile;
  }
}
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd cli
bun run tsc --noEmit
```

Expected: No type errors

- [ ] **Step 3: Commit configuration loader**

```bash
git add cli/src/config/loader.ts
git commit -m "feat: implement configuration loader with environment detection and merging"
```

---

## Task 6: Integrate Config Loading with CLI Arguments

**Files:**
- Modify: `cli/src/utils/args.ts`

- [ ] **Step 1: Add config imports and update CLI options**

```typescript
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
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd cli
bun run tsc --noEmit
```

Expected: No type errors

- [ ] **Step 3: Commit CLI integration**

```bash
git add cli/src/utils/args.ts
git commit -m "feat: integrate configuration loading with CLI argument merging"
```

---

## Task 7: Create Configuration Commands

**Files:**
- Create: `cli/src/commands/config.ts`

- [ ] **Step 1: Write configuration management commands**

```typescript
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
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd cli
bun run tsc --noEmit
```

Expected: No type errors

- [ ] **Step 3: Commit config commands**

```bash
git add cli/src/commands/config.ts
git commit -m "feat: add configuration management commands (init, validate, show)"
```

---

## Task 8: Register Config Commands in CLI

**Files:**
- Modify: `cli/src/index.ts`

- [ ] **Step 1: Import and register config commands**

Add this after the imports section:

```typescript
import { configCommands } from "./commands/config";
```

Add this after creating the commander program:

```typescript
// Register configuration commands
program.addCommand(configCommands);
```

- [ ] **Step 2: Run TypeScript check**

```bash
cd cli
bun run tsc --noEmit
```

Expected: No type errors

- [ ] **Step 3: Rebuild CLI**

```bash
cd cli
bun run build
```

Expected: Build succeeds

- [ ] **Step 4: Test config commands**

```bash
# Test init command
./dist/cc-test-runner config init

# Test validate command
./dist/cc-test-runner config validate

# Test show command
./dist/cc-test-runner config show
```

Expected: All commands execute without errors

- [ ] **Step 5: Commit CLI registration**

```bash
git add cli/src/index.ts
git commit -m "feat: register configuration commands in CLI"
```

---

## Task 9: Create Sample Configuration File

**Files:**
- Create: `config/cc-test.yaml`

- [ ] **Step 1: Create sample configuration**

```bash
cd cli
./dist/cc-test-runner config init
```

Expected: Sample config created at `config/cc-test.yaml`

- [ ] **Step 2: Review generated config**

```bash
cat config/cc-test.yaml
```

Expected: YAML configuration file with default values

- [ ] **Step 3: Commit sample config**

```bash
git add config/cc-test.yaml
git commit -m "feat: add sample configuration file"
```

---

## Task 10: Update README Documentation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Add configuration section to README**

Add this section after the "Usage" section:

```markdown
## Configuration

The test runner supports configuration files to simplify CLI usage and manage environment-specific settings.

### Configuration File

Create a configuration file at `config/cc-test.yaml`:

\`\`\`bash
cc-test-runner config init
\`\`\`

### Configuration Structure

\`\`\`yaml
# Default configuration
default:
  tests:
    path: ./tests
    patterns:
      - "**/*.json"
    exclude:
      - "**/node_modules/**"

  execution:
    resultsPath: ./results
    verbose: false
    screenshots: false
    maxTurns: 30
    timeout: 300000

  claude:
    model: claude-sonnet-4-6

# Environment-specific overrides
environments:
  development:
    execution:
      verbose: true
      screenshots: true

  production:
    execution:
      maxTurns: 20
\`\`\`

### Environment Detection

The test runner automatically detects the environment:

1. **CLI argument**: `--environment production`
2. **Environment variable**: `CC_TEST_ENV` or `NODE_ENV`
3. **Git branch**: `main/master` → production, `*dev*` → development
4. **Default**: development

### CLI Argument Priority

Command-line arguments override configuration file settings:

\`\`\`bash
# Use config file settings
cc-test-runner

# Override specific settings
cc-test-runner --verbose --screenshots
\`\`\`

### Configuration Commands

\`\`\`bash
# Create sample configuration
cc-test-runner config init

# Validate configuration
cc-test-runner config validate

# Show current configuration
cc-test-runner config show

# Show configuration for specific environment
cc-test-runner config show --environment production
\`\`\`

### Backward Compatibility

Configuration files are optional. The test runner works with command-line arguments only, maintaining full backward compatibility.
```

- [ ] **Step 2: Update example commands in README**

Update the "Example Commands" section to include config usage:

```markdown
#### Example Commands

\`\`\`bash
# Using configuration file
cc-test-runner

# Override config with CLI arguments
cc-test-runner --verbose

# Specify environment
cc-test-runner --environment production

# Traditional CLI usage (still works)
cc-test-runner -t ./tests.json -v

# With custom config file
cc-test-runner --config ./my-config.yaml
\`\`\`
```

- [ ] **Step 3: Commit README updates**

```bash
git add README.md
git commit -m "docs: add configuration file documentation"
```

---

## Task 11: Create Unit Tests

**Files:**
- Create: `cli/src/tests/config.test.ts`

- [ ] **Step 1: Write configuration loader tests**

```typescript
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, unlinkSync, mkdirSync, rmdirSync } from "fs";
import { resolve } from "path";
import { ConfigLoader } from "../config/loader";
import { configFileSchema } from "../types/config";

const TEST_CONFIG_DIR = resolve(__dirname, "../../test-config");
const TEST_CONFIG_PATH = resolve(TEST_CONFIG_DIR, "test.yaml");

describe("ConfigLoader", () => {
  beforeEach(() => {
    // Create test config directory
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
  });

  afterEach(() => {
    // Clean up test config
    try {
      unlinkSync(TEST_CONFIG_PATH);
    } catch {}
    try {
      rmdirSync(TEST_CONFIG_DIR);
    } catch {}
  });

  describe("environment detection", () => {
    it("should use provided environment parameter", () => {
      const loader = new ConfigLoader(TEST_CONFIG_PATH, "production");
      expect(loader.getEnvironment()).toBe("production");
    });

    it("should detect environment from CC_TEST_ENV", () => {
      process.env.CC_TEST_ENV = "testing";
      const loader = new ConfigLoader(TEST_CONFIG_PATH);
      expect(loader.getEnvironment()).toBe("testing");
      delete process.env.CC_TEST_ENV;
    });

    it("should default to development", () => {
      const loader = new ConfigLoader(TEST_CONFIG_PATH);
      expect(loader.getEnvironment()).toBe("development");
    });
  });

  describe("configuration loading", () => {
    it("should return empty config when file does not exist", () => {
      const loader = new ConfigLoader(TEST_CONFIG_PATH);
      const config = loader.load();
      expect(config).toEqual({});
    });

    it("should load valid YAML configuration", () => {
      const configContent = `
default:
  execution:
    verbose: true
    maxTurns: 50
`;
      writeFileSync(TEST_CONFIG_PATH, configContent);

      const loader = new ConfigLoader(TEST_CONFIG_PATH);
      const config = loader.load();

      expect(config.execution?.verbose).toBe(true);
      expect(config.execution?.maxTurns).toBe(50);
    });

    it("should merge default and environment configs", () => {
      const configContent = `
default:
  execution:
    verbose: false
    maxTurns: 30

environments:
  development:
    execution:
      verbose: true
`;
      writeFileSync(TEST_CONFIG_PATH, configContent);

      const loader = new ConfigLoader(TEST_CONFIG_PATH, "development");
      const config = loader.load();

      expect(config.execution?.verbose).toBe(true);
      expect(config.execution?.maxTurns).toBe(30);
    });

    it("should throw error for invalid YAML", () => {
      const invalidYaml = `
default:
  execution:
    verbose: true
    bad_syntax: [
`;
      writeFileSync(TEST_CONFIG_PATH, invalidYaml);

      const loader = new ConfigLoader(TEST_CONFIG_PATH);
      expect(() => loader.load()).toThrow();
    });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
cd cli
bun test src/tests/config.test.ts
```

Expected: Tests pass

- [ ] **Step 3: Commit tests**

```bash
git add cli/src/tests/config.test.ts
git commit -m "test: add configuration loader unit tests"
```

---

## Task 12: Integration Testing

**Files:**
- None (manual testing)

- [ ] **Step 1: Test backward compatibility**

```bash
# Ensure old CLI arguments still work
./dist/cc-test-runner -t ./samples/pdca-e2e-tests.json -v
```

Expected: Tests run successfully with verbose output

- [ ] **Step 2: Test config file loading**

```bash
# Test with config file
./dist/cc-test-runner
```

Expected: Tests run using config file settings

- [ ] **Step 3: Test environment override**

```bash
# Test environment detection
CC_TEST_ENV=production ./dist/cc-test-runner
```

Expected: Uses production environment settings

- [ ] **Step 4: Test CLI argument override**

```bash
# Test CLI args override config
./dist/cc-test-runner --maxTurns=50
```

Expected: Uses CLI argument value instead of config value

- [ ] **Step 5: Test config commands**

```bash
# Test all config commands
./dist/cc-test-runner config validate
./dist/cc-test-runner config show
./dist/cc-test-runner config show --environment production --json
```

Expected: All commands execute successfully

- [ ] **Step 6: Test error handling**

```bash
# Test invalid config
echo "invalid: yaml: [" > config/cc-test.yaml
./dist/cc-test-runner 2>&1 | grep "Configuration error"
```

Expected: Helpful error message displayed

- [ ] **Step 7: Clean up test config**

```bash
rm config/cc-test.yaml
```

---

## Task 13: Final Build and Verification

**Files:**
- None (build and verify)

- [ ] **Step 1: Run linter**

```bash
cd cli
bun run lint
```

Expected: No linting errors

- [ ] **Step 2: Build final CLI**

```bash
bun run build
```

Expected: Build succeeds without errors

- [ ] **Step 3: Verify built executable**

```bash
./dist/cc-test-runner --help
```

Expected: Help text includes new config commands

- [ ] **Step 4: Create git tag for feature**

```bash
git tag -a feat/config-support -m "Add configuration file support feature"
git push origin feat/config-support
```

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "feat: complete configuration file support implementation

- Add YAML-based configuration file support
- Support environment-specific configurations
- Implement smart CLI argument merging
- Add configuration management commands
- Maintain full backward compatibility
- Add comprehensive documentation and tests"
```

---

## Success Criteria Verification

After completing all tasks, verify:

- [x] Configuration file is optional and doesn't break existing functionality
- [x] Environment detection works correctly in all scenarios
- [x] Command-line arguments properly override configuration file settings
- [x] Error messages are clear and actionable
- [x] All new CLI commands work as expected
- [x] Documentation is complete and accurate
- [x] Unit tests pass
- [x] Integration tests pass
- [x] Backward compatibility maintained

---

## Migration Guide for Existing Users

No action required! The tool maintains full backward compatibility. Optional migration:

1. **Generate sample config**: `cc-test-runner config init`
2. **Review settings**: Edit `config/cc-test.yaml` to match your needs
3. **Simplify commands**: Replace repeated CLI args with config file
4. **Test locally**: Verify config works with `cc-test-runner config validate`

---

**Plan complete and saved to `docs/superpowers/plans/2026-04-19-config-file-support.md`**
