import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { execSync } from "child_process";
import * as yaml from "js-yaml";
import {
  configFileSchema,
  type ConfigFile,
  type EnvironmentConfig,
  type Environment,
  type TestsConfig,
  type ExecutionConfig,
  type ClaudeConfig,
} from "../types/config.js";
import { logger } from "../utils/logger.js";
import {
  validateTestsConfig,
  validateExecutionConfig,
  validateClaudeConfig,
  logValidationErrors,
} from "./validator.js";

export class ConfigLoader {
  private configPath: string;
  private environment: Environment;
  private configFile: ConfigFile | null = null;
  private mergedConfig: EnvironmentConfig = {};

  constructor(
    configPath: string = "config/cc-test.yaml",
    environment?: string
  ) {
    this.configPath = resolve(process.cwd(), configPath);
    this.environment = this.detectEnvironment(environment);
  }

  /**
   * Detect environment from multiple sources
   * Priority: parameter > env var > git branch > default.
   * @param environment - Optional environment name.
   * @returns The detected environment.
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
   * Validate if string is a valid environment.
   * @param env - The environment string to validate.
   * @returns True if valid environment, false otherwise.
   */
  private isValidEnvironment(env: string): boolean {
    return ["development", "testing", "production", "staging"].includes(env);
  }

  /**
   * Detect environment from Git branch.
   * @returns The detected environment or null if unable to detect.
   */
  private detectGitBranch(): Environment | null {
    try {
      // Use GIT_BRANCH env var if available (CI/CD)
      if (process.env.GIT_BRANCH) {
        const branch = process.env.GIT_BRANCH.split("/").pop() || "";
        return this.mapBranchToEnvironment(branch);
      }

      // Otherwise try to run git command
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
   * Map Git branch name to environment.
   * @param branch - The Git branch name.
   * @returns The corresponding environment or null if no match.
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
   * Load and parse configuration file.
   * @returns The merged configuration for current environment.
   * @throws Error if file exists but cannot be parsed or validated.
   */
  public load(): EnvironmentConfig {
    if (!existsSync(this.configPath)) {
      logger.debug(
        `Configuration file not found at ${this.configPath}, using defaults`
      );
      return {};
    }

    try {
      const fileContent = readFileSync(this.configPath, "utf-8");
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
      throw error;
    }
  }

  /**
   * Merge default and environment-specific configurations
   * Performs shallow merge (top-level properties override).
   * @returns The merged configuration.
   */
  private getMergedConfig(): EnvironmentConfig {
    if (!this.configFile) {
      return {};
    }

    const defaultConfig = this.configFile.default;
    const envConfig =
      this.configFile.environments?.[this.environment] || {};

    // Shallow merge (top-level properties override)
    // Only include sections that exist in at least one config
    const merged: EnvironmentConfig = {};

    if (defaultConfig.tests || envConfig.tests) {
      merged.tests = {
        ...defaultConfig.tests,
        ...envConfig.tests,
      } as TestsConfig;
    }

    if (defaultConfig.execution || envConfig.execution) {
      merged.execution = {
        ...defaultConfig.execution,
        ...envConfig.execution,
      } as ExecutionConfig;
    }

    if (defaultConfig.claude || envConfig.claude) {
      merged.claude = {
        ...defaultConfig.claude,
        ...envConfig.claude,
      } as ClaudeConfig;
    }

    return merged;
  }

  /**
   * Validate loaded configuration
   * Throws error if validation fails.
   * @throws Error if any configuration section fails validation.
   */
  private validateConfiguration(): void {
    let hasErrors = false;

    if (this.mergedConfig.tests) {
      const result = validateTestsConfig(this.mergedConfig.tests);
      if (!result.isValid) {
        logValidationErrors("tests", result);
        hasErrors = true;
      }
    }

    if (this.mergedConfig.execution) {
      const result = validateExecutionConfig(this.mergedConfig.execution);
      if (!result.isValid) {
        logValidationErrors("execution", result);
        hasErrors = true;
      }
    }

    if (this.mergedConfig.claude) {
      const result = validateClaudeConfig(this.mergedConfig.claude);
      if (!result.isValid) {
        logValidationErrors("claude", result);
        hasErrors = true;
      }
    }

    if (hasErrors) {
      throw new Error("Configuration validation failed. Please fix the errors above.");
    }
  }

  /**
   * Handle configuration errors with helpful messages.
   * @param error - The error to handle.
   * @throws Always re-throws the error after logging.
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
   * Get current environment.
   * @returns The current environment name.
   */
  public getEnvironment(): Environment {
    return this.environment;
  }

  /**
   * Get merged configuration.
   * @returns The merged configuration object.
   */
  public getConfiguration(): EnvironmentConfig {
    return this.mergedConfig;
  }

  /**
   * Get raw configuration file.
   * @returns The parsed configuration file or null if not loaded.
   */
  public getRawConfig(): ConfigFile | null {
    return this.configFile;
  }
}
