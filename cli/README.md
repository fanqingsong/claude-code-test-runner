# Claude Code Test Runner

AI-powered test execution framework using Claude Code, Playwright browser automation, and comprehensive analytics dashboard.

## Features

- **AI-Native Testing**: Leverages Claude Code to execute test plans with natural language understanding
- **Browser Automation**: Playwright-powered test execution with screenshot capture
- **Configuration File Support**: YAML-based configuration with environment detection
- **Test Analytics Dashboard**: Interactive dashboard for tracking test results over time
- **SQLite Storage**: Indefinite historical test data storage
- **6 Key Metrics**: Pass rates, flaky tests, duration trends, slowest tests, failure patterns, execution frequency
- **Hybrid Workflow**: Generate static HTML reports or run interactive dev server

## Installation

```bash
bun install
```

## Quick Start

### 1. Define Test Cases

Create a YAML configuration file:

```yaml
# cc-test.yaml
environments:
  development:
    execution:
      resultsPath: ./results
      verbose: true
      screenshots: true
      maxTurns: 50

tests:
  - id: login-test
    description: Test user login flow
    steps:
      - id: 1
        description: Navigate to application
      - id: 2
        description: Enter email address
      - id: 3
        description: Enter password
      - id: 4
        description: Click login button
      - id: 5
        description: Verify successful login
```

### 2. Run Tests

```bash
# Run specific test
cc-test test login-test

# Run all tests
cc-test test all
```

### 3. View Analytics Dashboard

```bash
# Generate static HTML dashboard
cc-test dashboard --static

# Start interactive dev server
cc-test dashboard --serve --port 3000
```

## Test Analytics Dashboard

The Test Analytics Dashboard provides comprehensive insights into your test results over time.

### Features

**6 Key Metrics:**
1. **Pass Rate Trends** - Overall test health over time (30-day window)
2. **Flaky Tests** - Identifies unreliable tests with statistical analysis (30-70% pass rate)
3. **Duration Trends** - Performance degradation alerts with multi-test tracking
4. **Slowest Tests** - Performance ranking by average execution time
5. **Failure Patterns** - Most common failing steps across all tests
6. **Execution Frequency** - Test usage heatmap showing run frequency

**Hybrid Workflow:**
- **Static HTML Mode**: Generate standalone dashboard files for offline viewing
- **Dev Server Mode**: Interactive dashboard with REST API and real-time updates via WebSocket

### Usage

#### Generate Static Dashboard

```bash
cc-test dashboard --static
```

Generates `results/dashboard.html` with embedded data and interactive Chart.js visualizations. Open in any browser - no server required.

**Options:**
- `--output <path>` - Custom output path (default: `./results/dashboard.html`)
- `--days <number>` - Days of history to include (default: 30)

#### Start Dev Server

```bash
cc-test dashboard --serve --port 3000
```

Starts interactive dashboard server at `http://localhost:3000` with:
- Live dashboard with all metrics
- REST API endpoints for data access
- WebSocket support for real-time updates
- Hot reload when new tests complete

**API Endpoints:**
- `GET /` - Dashboard HTML
- `GET /api/summary` - Summary statistics
- `GET /api/pass-rate-trends` - Pass rate over time
- `GET /api/flaky-tests` - Flaky test list with scores
- `GET /api/dashboard?days=30` - All dashboard data

#### Database Operations

```bash
# Show database statistics
cc-test dashboard --stats

# Optimize database (VACUUM and reindex)
cc-test dashboard --cleanup

# Initialize/reinitialize database
cc-test dashboard --init
```

### Understanding the Metrics

**Flaky Test Detection:**
- Tests with pass rate between 30-70% are flagged as flaky
- Flakiness score (0-100) combines pass rate and recent variance
- Higher score = more flaky (inconsistent results)
- View last 10 executions for each flaky test

**Duration Trends:**
- Track execution time for each test over time
- Spot performance degradations (>20% increase week-over-week)
- Compare multiple tests in a single visualization

**Failure Patterns:**
- Aggregate which test steps fail most often
- Shows how many different tests are affected
- Helps identify systemic issues (e.g., "Click login" fails across multiple tests)

## Configuration

### Configuration File

By default, the tool looks for `cc-test.yaml` in the current directory.

Configuration priority (highest to lowest):
1. `--config <path>` CLI flag
2. `CC_TEST_CONFIG` environment variable
3. Git branch name
4. Default configuration

### Environment-Specific Settings

```yaml
default:
  execution:
    resultsPath: ./results
    verbose: false
    maxTurns: 30

environments:
  development:
    execution:
      verbose: true
      screenshots: true
      maxTurns: 50

  production:
    execution:
      verbose: false
      screenshots: false
      maxTurns: 30
```

### CLI Options

```bash
# Test commands
cc-test test <test-id>          # Run specific test
cc-test test all                  # Run all tests
cc-test test --config <path>      # Use custom config

# Dashboard commands
cc-test dashboard --static        # Generate HTML dashboard
cc-test dashboard --serve         # Start dev server
cc-test dashboard --cleanup       # Optimize database
cc-test dashboard --stats         # Show statistics

# Configuration commands
cc-test config init                # Create sample config
cc-test config validate            # Validate config file
cc-test config show               # Show current config
```

## Test Result Formats

Test results are automatically saved in multiple formats:

1. **SQLite Database** (`results/.analytics/test-results.db`)
   - Indefinite storage for historical analysis
   - Queryable for custom reports

2. **CTRF JSON** (`results/<run-id>/ctrf-report.json`)
   - Standard test result format
   - CI/CD integration support

3. **Markdown Summary** (`results/<run-id>/test-summary.md`)
   - Human-readable test summary
   - GitHub Actions-friendly

4. **Screenshots** (if enabled)
   - Automatic capture at each test step
   - Stored in results directory

## Architecture

```
┌─────────────┐
│   Config    │ YAML configuration loading with environment detection
└──────┬──────┘
       │
┌──────▼──────────┐
│ Test Execution │ Claude Code + Playwright browser automation
└──────┬──────────┘
       │
┌──────▼──────────────┐
│  Database Ingestion │ SQLite storage with automatic persistence
└──────┬──────────────┘
       │
┌──────▼─────────────────────┐
│   Analytics & Reporting      │
│ ├─ Query Builder           │ SQL aggregation for metrics
│ ├─ Flaky Detector         │ Statistical analysis
│ ├─ Data Processor         │ Chart data preparation
│ ├─ HTML Generator          │ Static dashboard files
│ └─ Dev Server              │ Interactive mode
└─────────────────────────────┘
```

## Development

### Project Structure

```
cli/
├── src/
│   ├── analytics/          # Metrics calculation
│   │   ├── query-builder.ts
│   │   └── flaky-detector.ts
│   ├── commands/           # CLI commands
│   │   └── dashboard.ts
│   ├── config/              # Configuration management
│   │   ├── loader.ts
│   │   └── schema.ts
│   ├── db/                  # Database layer
│   │   ├── schema.ts
│   │   ├── migrations.ts
│   │   └── manager.ts
│   ├── reporting/            # Dashboard & reporting
│   │   ├── templates/
│   │   │   └── dashboard.ejs
│   │   ├── generators/
│   │   │   ├── data-processor.ts
│   │   │   └── static-generator.ts
│   │   ├── server.ts
│   │   └── assets/
│   └── utils/                # Utilities
└── tests/
    ├── unit/                # Unit tests
    └── integration/         # Integration tests
```

### Tech Stack

- **Runtime**: Bun (JavaScript/TypeScript)
- **Database**: bun:sqlite (SQLite for Bun runtime)
- **AI**: Claude Code SDK
- **Browser Automation**: Playwright
- **HTTP Server**: Express.js
- **Templating**: EJS
- **Charts**: Chart.js
- **Config**: YAML (js-yaml)
- **Validation**: Zod
- **Logging**: Winston

### Running Tests

```bash
# Run all tests
bun test

# Run specific test file
bun test tests/unit/db/schema.test.ts

# Run with coverage
bun test --coverage

# Lint code
bun run lint

# Build for production
bun run build
```

## Performance

**Dashboard Generation:**
- < 2 seconds for 1000 test runs
- Output file < 500KB with embedded data

**API Response Times:**
- < 100ms for summary statistics
- < 200ms for full dashboard data

**Database:**
- Optimized with indexes on frequently queried columns
- WAL mode for better concurrency
- Periodic VACUUM for file size optimization

## License

MIT

## Contributing

Contributions are welcome! Please read our code of conduct and submit pull requests to the main repository.
