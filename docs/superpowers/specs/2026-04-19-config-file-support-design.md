# Configuration File Support Design

**Date:** 2026-04-19
**Status:** Design Approved
**Priority:** High

## Overview

Add comprehensive configuration file support to improve user experience and simplify CLI usage. The configuration system will support YAML-based configuration with environment-specific overrides and smart command-line argument merging.

## Goals

1. **Simplify Usage**: Reduce repetitive command-line arguments
2. **Environment Management**: Support different configurations for development, testing, and production
3. **Validation**: Provide helpful error messages and suggestions
4. **Flexibility**: Allow command-line arguments to override configuration file settings

## Design

### Configuration File Structure

**Location:** `config/cc-test.yaml`

**Format:** YAML with environment-based inheritance

```yaml
# Default configuration (base for all environments)
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
      maxTurns: 50

  testing:
    execution:
      resultsPath: ./test-results
      screenshots: true
    claude:
      model: claude-haiku-4-5-20251001

  production:
    execution:
      maxTurns: 20
      timeout: 180000
    tests:
      exclude:
        - "**/experimental/**"
```

### Type Definitions

**New file:** `cli/src/types/config.ts`

```typescript
import z from "zod";

const environmentSchema = z.enum(["development", "testing", "production", "staging"]);

const testsConfigSchema = z.object({
  path: z.string().default("./tests"),
  patterns: z.array(z.string()).default(["**/*.json"]),
  exclude: z.array(z.string()).default([]),
});

const executionConfigSchema = z.object({
  resultsPath: z.string().default("./results"),
  verbose: z.boolean().default(false),
  screenshots: z.boolean().default(false),
  maxTurns: z.number().min(1).max(100).default(30),
  timeout: z.number().min(1000).default(300000),
});

const claudeConfigSchema = z.object({
  model: z.string().optional(),
});

const environmentConfigSchema = z.object({
  tests: testsConfigSchema.optional(),
  execution: executionConfigSchema.optional(),
  claude: claudeConfigSchema.optional(),
});

const configFileSchema = z.object({
  default: environmentConfigSchema,
  environments: z.record(environmentSchema, environmentConfigSchema).optional(),
});

export type ConfigFile = z.infer<typeof configFileSchema>;
export type EnvironmentConfig = z.infer<typeof environmentConfigSchema>;
```

### Configuration Loader

**New file:** `cli/src/config/loader.ts`

**Key Features:**
1. **Environment Detection**: Automatic environment detection from Git branch
2. **Smart Merging**: Deep merge of default and environment-specific configs
3. **Error Handling**: Detailed error messages with suggestions
4. **Runtime Validation**: Validate configuration values when used

**Environment Detection Priority:**
1. Command-line argument (`--environment`)
2. Environment variable (`CC_TEST_ENV` or `NODE_ENV`)
3. Git branch detection
4. Default to `development`

**Error Handling Strategy:**
- YAML syntax errors → Link to YAML validator
- Missing required fields → Clear error message
- Invalid types → Show expected format and actual value
- Runtime validation → Log error and use default value

### CLI Integration

**Modified file:** `cli/src/utils/args.ts`

**Changes:**
1. Add new CLI options: `--config`, `--environment`
2. Load configuration file
3. Merge with command-line arguments (CLI args take precedence)
4. Validate critical configuration values

**Merging Logic:**
```typescript
const mergedConfig = {
  testsPath: args.testsPath ?? config.tests?.path,
  resultsPath: args.resultsPath ?? config.execution?.resultsPath ?? "./results",
  verbose: args.verbose ?? config.execution?.verbose,
  // ... other fields
};
```

### New CLI Commands

**New file:** `cli/src/commands/config.ts`

**Commands:**
1. `cc-test-runner config init` - Create sample configuration file
2. `cc-test-runner config validate` - Validate configuration syntax and values
3. `cc-test-runner config show` - Display current configuration (merged)

### Dependencies

**New dependencies:**
- `js-yaml`: ^4.1.0 - YAML parsing
- `glob`: ^10.3.0 - Pattern matching for test files

### Backward Compatibility

- All existing command-line arguments continue to work
- Configuration file is optional
- If no configuration file exists, tool works as before
- No breaking changes to existing functionality

## File Structure

```
cli/src/
├── config/
│   ├── loader.ts          # Configuration loading and merging
│   └── validator.ts       # Runtime configuration validation
├── types/
│   └── config.ts          # Configuration type definitions
├── commands/
│   └── config.ts          # Configuration management commands
└── utils/
    └── args.ts            # Modified to integrate config loading
```

## Implementation Phases

### Phase 1: Core Infrastructure
1. Add type definitions
2. Implement configuration loader
3. Add js-yaml dependency

### Phase 2: CLI Integration
1. Modify args.ts to load and merge configuration
2. Add new CLI options
3. Test backward compatibility

### Phase 3: Configuration Commands
1. Implement config init command
2. Implement config validate command
3. Implement config show command

### Phase 4: Testing and Documentation
1. Add unit tests for configuration loader
2. Update README with configuration examples
3. Add sample configuration file to repository

## Success Criteria

1. ✅ Configuration file is optional and doesn't break existing functionality
2. ✅ Environment detection works correctly in all scenarios
3. ✅ Command-line arguments properly override configuration file settings
4. ✅ Error messages are clear and actionable
5. ✅ All new CLI commands work as expected
6. ✅ Documentation is complete and accurate

## Migration Path

For existing users:
1. No action required - tool works as before
2. Optional: Run `cc-test-runner config init` to create sample config
3. Gradually migrate command-line arguments to config file

## Future Enhancements

Out of scope for this implementation but worth noting:
- Configuration file hot-reloading
- Configuration validation schema export
- Web-based configuration editor
- Configuration file encryption for sensitive values
- Configuration profiles within environments
