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