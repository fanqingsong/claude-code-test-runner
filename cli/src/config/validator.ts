import { logger } from "../utils/logger";
import type { TestsConfig, ExecutionConfig, ClaudeConfig } from "../types/config";

/**
 * Validation result interface.
 */
export interface ValidationResult {
  /** Whether the validation passed. */
  isValid: boolean;
  /** Array of error messages. */
  errors: string[];
}

/**
 * Validate tests configuration.
 * @param config - The tests configuration to validate.
 * @returns Validation result with any errors found.
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
 * Validate execution configuration.
 * @param config - The execution configuration to validate.
 * @returns Validation result with any errors found.
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
 * Validate Claude configuration.
 * @param config - The Claude configuration to validate.
 * @returns Validation result with any errors found.
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
 * Log validation errors with suggestions.
 * @param context - The context of the validation (e.g., "tests", "execution").
 * @param result - The validation result to log.
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