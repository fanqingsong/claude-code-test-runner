# Test Analytics Dashboard Design

**Date**: 2026-04-21
**Status**: Approved
**Priority**: High

## Overview

Design and implementation of a comprehensive test analytics dashboard for the Claude Code Test Runner, providing historical insights, trend analysis, and interactive visualizations of test execution results.

## Problem Statement

The current test reporting system generates static CTRF JSON and Markdown summaries for individual test runs. Users lack visibility into:
- Test health trends over time
- Flaky test detection
- Performance degradation patterns
- Historical comparisons and analytics

## Goals

1. Provide a comprehensive, single-page dashboard showing all key metrics at a glance
2. Enable interactive exploration of test data through advanced visualizations
3. Support both static HTML generation and optional dev server mode
4. Maintain indefinite historical data storage for long-term analysis

## Architecture

### Components

**1. Database Layer** (`src/db/`)
- SQLite database (`test-results.db`) with schema for: test_runs, test_cases, test_steps
- Database manager class for migrations, querying, and aggregation
- Automatic indexing on timestamps, test IDs, and status fields

**2. Analytics Engine** (`src/analytics/`)
- Metrics calculators for pass rates, flakiness, duration trends, failure patterns
- Statistical analysis: rolling averages, standard deviation for flaky test detection
- Query builders for common aggregations (daily/weekly/monthly trends)

**3. Reporting Layer** (`src/reporting/`)
- HTML generator using EJS templates for static reports
- Dev server using Express.js for interactive mode
- Chart.js integration for interactive visualizations
- REST API endpoints for data fetching in dev server mode

**4. CLI Integration**
- `cc-test dashboard --serve` - starts dev server at `http://localhost:3000`
- `cc-test dashboard --static` - generates standalone HTML file
- `cc-test dashboard --cleanup` - database cleanup and VACUUM
- Automatic database population after every test run

### Data Flow

```
Test Execution → CTRF JSON → Database Ingestion → Analytics Calculation → Dashboard Visualization
```

## Data Model

### Database Schema

**Table: test_runs**
```sql
CREATE TABLE test_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id TEXT UNIQUE NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  total_tests INTEGER NOT NULL,
  passed INTEGER NOT NULL,
  failed INTEGER NOT NULL,
  total_duration INTEGER NOT NULL,
  environment TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_test_runs_start_time ON test_runs(start_time);
CREATE INDEX idx_test_runs_run_id ON test_runs(run_id);
```

**Table: test_cases**
```sql
CREATE TABLE test_cases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id INTEGER NOT NULL,
  test_id TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  duration INTEGER NOT NULL,
  start_time INTEGER NOT NULL,
  end_time INTEGER NOT NULL,
  message TEXT,
  FOREIGN KEY (run_id) REFERENCES test_runs(id)
);

CREATE INDEX idx_test_cases_run_id ON test_cases(run_id);
CREATE INDEX idx_test_cases_test_id_status ON test_cases(test_id, status);
```

**Table: test_steps**
```sql
CREATE TABLE test_steps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  test_case_id INTEGER NOT NULL,
  step_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL,
  error_message TEXT,
  FOREIGN KEY (test_case_id) REFERENCES test_cases(id)
);

CREATE INDEX idx_test_steps_test_case_id ON test_steps(test_case_id);
CREATE INDEX idx_test_steps_status ON test_steps(status);
```

### Database Location

`<resultsPath>/.analytics/test-results.db`

## Metrics & Algorithms

### 1. Pass Rate Trends

**Calculation:**
```sql
SELECT
  DATE(start_time, 'unixepoch') as date,
  SUM(passed) * 100.0 / SUM(total_tests) as pass_rate
FROM test_runs
WHERE start_time >= ?
GROUP BY date
ORDER BY date;
```

**Display:** Line chart with pass rate % over time (30-day window)
**Smoothing:** 7-day moving average

### 2. Flaky Test Detection

**Algorithm:**
```sql
SELECT
  test_id,
  COUNT(*) as total_runs,
  SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passes,
  SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failures,
  CAST(SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*) as pass_rate
FROM test_cases
WHERE start_time >= strftime('%s', 'now', '-30 days')
GROUP BY test_id
HAVING pass_rate > 0.3 AND pass_rate < 0.7
ORDER BY pass_rate ASC;
```

**Flaky Threshold:** Pass rate between 30-70% over last 30 days
**Display:** Table with flakiness score, last 10 run history (sparkline), failure reasons

### 3. Duration Trends

**Calculation:**
```sql
SELECT
  DATE(start_time, 'unixepoch') as date,
  test_id,
  AVG(duration) as avg_duration
FROM test_cases
WHERE start_time >= ?
GROUP BY date, test_id
ORDER BY date;
```

**Display:** Multi-line chart showing trend per test (top 5 slowest) + overall average
**Alert:** Highlight tests with >20% duration increase week-over-week

### 4. Slowest Tests Leaderboard

**Calculation:**
```sql
SELECT
  test_id,
  AVG(duration) as avg_duration,
  COUNT(*) as run_count
FROM test_cases
GROUP BY test_id
ORDER BY avg_duration DESC
LIMIT 20;
```

**Display:** Ranked bar chart with execution times
**Interaction:** Click to drill down into individual test history

### 5. Failure Patterns

**Calculation:**
```sql
SELECT
  description,
  COUNT(*) as failure_count,
  COUNT(DISTINCT test_id) as affected_tests
FROM test_steps
WHERE status = 'failed'
GROUP BY description
ORDER BY failure_count DESC
LIMIT 10;
```

**Display:** Pie chart + ranked list of most common failing steps
**Correlation:** Show which tests contain these steps

### 6. Execution Frequency

**Calculation:**
```sql
SELECT
  test_id,
  DATE(start_time, 'unixepoch') as date,
  COUNT(*) as run_count
FROM test_cases
WHERE start_time >= ?
GROUP BY test_id, date
ORDER BY date, test_id;
```

**Display:** Heatmap (tests × time) showing execution frequency
**Insight:** Identify rarely-run tests that might be stale

## Dashboard Layout

### Single-Page Overview Structure

**Header Section**
- Project title, last run timestamp, environment indicator
- Action buttons: "Refresh", "Export Report", "Configure"
- Summary cards row: Total Tests, Pass Rate, Avg Duration, Flaky Tests

**Main Content Grid** (2-column responsive layout)

**Left Column (60% width):**
- Pass Rate Trend Chart - Large line chart, 30-day window
- Duration Trend Chart - Multi-line chart, top 5 tests + overall
- Execution Frequency Heatmap - Tests × dates color-coded by run count

**Right Column (40% width):**
- Flaky Tests Panel - Top 10 with pass rates and mini sparklines
- Slowest Tests Leaderboard - Bar chart, top 20 by average duration
- Failure Patterns - Donut chart of most common failing steps

**Bottom Section (full width):**
- Individual Test Details - Expandable table with search/filter
  - Test ID, description, last run status, duration
  - Expand: full history, step-by-step breakdown, screenshots

### Color Scheme

- Passed: `#10b981` (green)
- Failed: `#ef4444` (red)
- Flaky: `#f59e0b` (yellow)
- Neutral: `#6b7280` (gray)

### Responsive Design

Collapses to single column on mobile, charts stack vertically

## HTML Generation & Dev Server

### Static HTML Generation

**Approach:**
- EJS templates for HTML structure
- Chart.js for client-side rendering
- Embedded JSON data in `<script>` tags

**Process:**
1. Query SQLite database for all required metrics
2. Aggregate data into JSON structures
3. Render EJS template with embedded data
4. Write standalone HTML to `<resultsPath>/dashboard.html`
5. Charts render when user opens file

**File Structure:**
```
src/reporting/
├── templates/
│   └── dashboard.ejs
├── generators/
│   ├── static-generator.ts
│   └── data-processor.ts
└── assets/
    ├── dashboard.css
    └── charts.js
```

### Dev Server Mode

**Command:** `cc-test dashboard --serve --port 3000`

**Features:**
- Express.js server serving EJS template
- REST API endpoints: `/api/metrics`, `/api/tests`, `/api/trends`
- WebSocket for real-time updates (auto-refresh on new test runs)
- Hot reload: charts update when new test completes

### Hybrid Workflow

```bash
# Quick static view after tests
cc-test dashboard --static
# Opens file:// results/dashboard.html

# Interactive exploration during development
cc-test dashboard --serve
# Opens http://localhost:3000 with live data
```

## Error Handling & Edge Cases

### Database Errors
- **Missing database**: Auto-create on first run with migrations
- **Corrupted database**: Log error, fallback to generating report without historical data
- **Lock contention**: Retry writes up to 3 times with exponential backoff

### Data Quality Issues
- **Missing test runs**: Skip gracefully in charts (show gap)
- **Invalid timestamps**: Filter out, log warning
- **Duplicate run_id**: Use INSERT OR REPLACE

### Chart Rendering
- **No data available**: Show "No test data available - run tests first"
- **Single data point**: Disable trend lines, show single value
- **Large datasets**: Paginate tables (50 rows), aggregate chart data

### Memory Management
- **Database size**: VACUUM command (`cc-test dashboard --cleanup`)
- **Query limits**: Default to last 90 days, add `--all` flag for full history
- **Chart performance**: Downsample >1000 points

### User Actions
- **Invalid CLI flags**: Clear error message with examples
- **Port in use**: Auto-increment port (3000 → 3001 → 3002)
- **File permissions**: Check write access before generation

## Testing Strategy

### Unit Tests
- Database layer: migrations, CRUD operations, complex queries
- Analytics engine: metric calculations with mock data
- Data processor: chart data preparation, edge cases
- HTML generator: EJS rendering, embedded data structure

### Integration Tests
- End-to-end: run tests → database population → dashboard generation
- CLI commands: test `--serve`, `--static`, `--cleanup` flags
- Database queries: verify SQL performance with 1000+ test runs

### Visual Regression Tests
- Snapshot testing: compare HTML against known-good snapshots
- Chart rendering: verify Chart.js initializes correctly

### Manual Testing Checklist
- [ ] Open static HTML in Chrome/Firefox/Safari
- [ ] Start dev server, navigate to localhost:3000
- [ ] Run 20+ tests, verify all charts render
- [ ] Test with empty database (first run)
- [ ] Test with large dataset (1000 test runs)
- [ ] Verify flaky test detection with sample data
- [ ] Test responsive design on mobile

### Performance Targets
- Dashboard generation < 2 seconds for 1000 test runs
- Dev server API responses < 100ms
- Static HTML file size < 500KB (with embedded data)

## Dependencies

### New Dependencies
- `better-sqlite3` - SQLite database driver
- `ejs` - HTML template engine
- `chart.js` - Client-side charting library
- `express` - Dev server (already in project)
- `ws` - WebSocket for real-time updates

### File Structure
```
cli/
├── src/
│   ├── db/
│   │   ├── schema.ts
│   │   ├── migrations.ts
│   │   └── manager.ts
│   ├── analytics/
│   │   ├── metrics.ts
│   │   ├── flaky-detector.ts
│   │   └── query-builder.ts
│   ├── reporting/
│   │   ├── templates/
│   │   │   └── dashboard.ejs
│   │   ├── generators/
│   │   │   ├── static-generator.ts
│   │   │   └── data-processor.ts
│   │   ├── assets/
│   │   │   ├── dashboard.css
│   │   │   └── charts.js
│   │   └── server.ts
│   └── commands/
│       └── dashboard.ts
├── docs/
│   └── superpowers/
│       └── specs/
│           └── 2026-04-21-test-analytics-dashboard-design.md
└── package.json
```

## Implementation Phases

### Phase 1: Database & Ingestion
- Create database schema and migrations
- Build database manager class
- Implement automatic CTRF ingestion after test runs
- Unit tests for database operations

### Phase 2: Analytics Engine
- Implement metrics calculators
- Build query builders for aggregations
- Flaky test detection algorithm
- Unit tests with mock data

### Phase 3: Static HTML Generation
- Create EJS dashboard template
- Build data processor for chart preparation
- Implement static HTML generator
- Chart.js integration

### Phase 4: Dev Server
- Express.js server setup
- REST API endpoints
- WebSocket for real-time updates
- Hot reload functionality

### Phase 5: CLI Integration
- Add `dashboard` command with subcommands
- Integrate with existing test execution flow
- Error handling and validation
- Documentation

### Phase 6: Testing & Polish
- Integration tests
- Visual regression tests
- Performance optimization
- Manual testing and bug fixes

## Success Criteria

- [ ] Static HTML dashboard generates successfully after test runs
- [ ] All 6 metrics render correctly with sample data
- [ ] Dev server starts and serves interactive dashboard
- [ ] Flaky test detection accurately identifies unreliable tests
- [ ] Dashboard loads in < 2 seconds with 1000 test runs
- [ ] Static HTML file < 500KB with embedded data
- [ ] Responsive design works on mobile viewports
- [ ] CLI commands work as documented
- [ ] No database corruption under concurrent access
- [ ] Performance targets met for all operations

## Future Enhancements

- CI/CD integration (upload results to external service)
- Multi-project support (separate databases per project)
- Custom metric definitions and plugins
- Export reports as PDF
- Email/slack alerts for flaky tests
- Historical data export/import
- Team collaboration features (shared dashboards)
