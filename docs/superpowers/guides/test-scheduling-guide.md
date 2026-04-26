# Test Scheduling Feature - User Guide

## Overview

The Test Scheduling feature allows you to automate test execution based on flexible schedules. You can schedule individual tests, test suites, or dynamically filter tests by tags.

## Key Features

- **Multiple Schedule Types**: Individual tests, test suites, or dynamic tag-based filtering
- **Flexible Scheduling**: Preset schedules (hourly, daily, weekly) or custom cron expressions
- **Execution History**: Track all scheduled runs with detailed results
- **Automatic Retry**: Configure retry logic for failed executions
- **Concurrency Control**: Prevent overlapping executions if needed
- **Manual Triggers**: Execute schedules on-demand
- **Timezone Support**: Schedules respect your configured timezone

## Architecture

```
┌─────────────────┐
│  API Endpoints  │
│  (FastAPI)      │
└────────┬────────┘
         │
         ├─→ Create/Update/Delete Schedules
         ├─→ View Schedule History
         └─→ Manual Trigger
                │
                ↓
┌─────────────────────────┐
│   PostgreSQL Database   │
│  - Schedules            │
│  - Test Suites          │
│  - Test Runs            │
└────────┬────────────────┘
         │
         ↓
┌─────────────────────────┐
│    Celery Beat          │
│  (Scheduler Service)    │
│  - Syncs schedules      │
│  - Triggers executions  │
└────────┬────────────────┘
         │
         ↓
┌─────────────────────────┐
│  Celery Workers         │
│  - Execute tests        │
│  - AI interpretation    │
│  - Result tracking      │
└─────────────────────────┘
```

## Getting Started

### 1. Start Services

```bash
cd docker-compose
docker compose up -d
```

This starts:
- `scheduler-service`: API server (port 8012)
- `scheduler-worker`: Task execution worker
- `scheduler-beat`: Scheduler that triggers tasks
- `postgres`: Database
- `redis`: Task queue broker

### 2. Verify Services

```bash
# Check all services are running
docker compose ps

# Check scheduler-service logs
docker compose logs -f scheduler-service

# Check scheduler-beat logs
docker compose logs -f scheduler-beat
```

### 3. Access API

The scheduler API is available at:
```
http://localhost:8012
```

API documentation (Swagger UI):
```
http://localhost:8012/docs
```

## Creating Schedules

### Schedule Individual Test

```bash
curl -X POST http://localhost:8012/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily Login Test",
    "schedule_type": "single",
    "test_definition_id": 1,
    "cron_expression": "0 9 * * *",
    "timezone": "America/New_York",
    "is_active": true,
    "max_retries": 2
  }'
```

### Schedule Test Suite

```bash
# First create a test suite
curl -X POST http://localhost:8012/api/v1/test-suites/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Critical User Flows",
    "description": "Essential user journey tests",
    "test_definition_ids": [1, 2, 3, 4, 5],
    "tags": {"priority": "critical", "category": "user-flows"}
  }'

# Then schedule it
curl -X POST http://localhost:8012/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekly Critical Tests",
    "schedule_type": "suite",
    "test_suite_id": 1,
    "cron_expression": "0 2 * * 1",
    "timezone": "UTC"
  }'
```

### Schedule by Tag Filter

```bash
curl -X POST http://localhost:8012/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Priority Tests",
    "schedule_type": "tag_filter",
    "tag_filter": "priority:high",
    "cron_expression": "*/30 * * * *",
    "timezone": "UTC"
  }'
```

## Using Schedule Presets

Instead of writing cron expressions, use presets:

```bash
# List available presets
curl http://localhost:8012/api/v1/schedules/presets

# Create schedule with preset
curl -X POST http://localhost:8012/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Hourly Health Check",
    "schedule_type": "single",
    "test_definition_id": 10,
    "preset_type": "hourly",
    "cron_expression": "0 * * * *"
  }'
```

Available presets:
- `hourly`: Every hour at minute 0
- `daily_midnight`: Daily at midnight
- `daily_noon`: Daily at noon (12:00)
- `weekly_monday`: Every Monday at midnight
- `weekly_friday`: Every Friday at midnight
- `monthly_1st`: On the 1st of every month
- `business_hours`: Every hour 9am-5pm, Mon-Fri

## Managing Schedules

### List All Schedules

```bash
# Get all schedules
curl http://localhost:8012/api/v1/schedules/

# Filter by active status
curl http://localhost:8012/api/v1/schedules/?is_active=true

# Filter by type
curl http://localhost:8012/api/v1/schedules/?schedule_type=single

# Pagination
curl http://localhost:8012/api/v1/schedules/?skip=0&limit=10
```

### Get Schedule Details

```bash
curl http://localhost:8012/api/v1/schedules/1
```

### Update Schedule

```bash
curl -X PUT http://localhost:8012/api/v1/schedules/1 \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Updated Schedule Name",
    "max_retries": 5
  }'
```

### Toggle Schedule On/Off

```bash
curl -X PATCH http://localhost:8012/api/v1/schedules/1/toggle \
  -H "Content-Type: application/json" \
  -d '{
    "is_active": false
  }'
```

### Delete Schedule

```bash
curl -X DELETE http://localhost:8012/api/v1/schedules/1
```

## Manual Execution

Trigger a schedule immediately without waiting for the next scheduled time:

```bash
curl -X POST http://localhost:8012/api/v1/schedules/1/trigger
```

Response:
```json
{
  "run_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending"
}
```

## Viewing Execution History

### Get Schedule History

```bash
curl http://localhost:8012/api/v1/schedules/1/history
```

Response:
```json
{
  "schedule_id": 1,
  "total_runs": 42,
  "history": [
    {
      "run_id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "completed",
      "total_tests": 5,
      "passed": 5,
      "failed": 0,
      "skipped": 0,
      "start_time": 1704067200000,
      "end_time": 1704067500000,
      "total_duration": 300000,
      "retry_count": 0,
      "created_at": "2024-01-01T09:00:00Z"
    }
  ]
}
```

## Cron Expression Reference

Cron expressions have 5 fields:

```
┌───────────── minute (0 - 59)
│ ┌─────────── hour (0 - 23)
│ │ ┌───────── day of month (1 - 31)
│ │ │ ┌─────── month (1 - 12)
│ │ │ │ ┌───── day of week (0 - 6) (Sunday = 0)
│ │ │ │ │
* * * * *
```

### Examples

| Expression | Description |
|------------|-------------|
| `0 * * * *` | Every hour at minute 0 |
| `0 0 * * *` | Every day at midnight |
| `0 9 * * 1-5` | 9am, Monday to Friday |
| `*/30 * * * *` | Every 30 minutes |
| `0 */2 * * *` | Every 2 hours |
| `0 0 1 * *` | On the 1st of every month |
| `0 0 * * 0` | Every Sunday at midnight |
| `0 9,17 * * *` | 9am and 5pm every day |
| `0 0 1 1 *` | January 1st at midnight |

### Online Tools

- [Cron Generator](https://crontab.guru/)
- [Cron Expression Editor](https://www.freeformatter.com/cron-expression-generator-quartz.html)

## Configuration

### Environment Variables

In `docker-compose/.env`:

```bash
# Celery Beat Configuration
CELERY_BEAT_LOG_LEVEL=info
CELERY_BEAT_SYNC_INTERVAL_SECONDS=300
CELERY_BEAT_OVERDUE_CHECK_INTERVAL_SECONDS=60
TEST_RUN_RETENTION_DAYS=30
```

### Retry Configuration

```bash
curl -X POST http://localhost:8012/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Retry Schedule",
    "schedule_type": "single",
    "test_definition_id": 1,
    "cron_expression": "0 9 * * *",
    "max_retries": 3,
    "retry_interval_seconds": 60
  }'
```

- `max_retries`: Number of retry attempts (0-10)
- `retry_interval_seconds`: Seconds between retries (10-3600)

### Concurrency Control

```bash
curl -X POST http://localhost:8012/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Concurrent Schedule",
    "schedule_type": "single",
    "test_definition_id": 1,
    "cron_expression": "0 9 * * *",
    "allow_concurrent": false
  }'
```

- `allow_concurrent: false`: Prevents new execution if previous run hasn't finished
- `allow_concurrent: true`: Allows overlapping executions

## Environment Overrides

Pass environment variables to test executions:

```bash
curl -X POST http://localhost:8012/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Health Check",
    "schedule_type": "single",
    "test_definition_id": 1,
    "cron_expression": "0 * * * *",
    "environment_overrides": {
      "BASE_URL": "https://production.example.com",
      "API_KEY": "prod-key-123",
      "TIMEOUT": "30000"
    }
  }'
```

## Troubleshooting

### Schedule Not Executing

1. Check schedule is active:
```bash
curl http://localhost:8012/api/v1/schedules/1 | jq '.is_active'
```

2. Check Celery Beat is running:
```bash
docker compose logs -f scheduler-beat
```

3. Check worker is processing tasks:
```bash
docker compose logs -f scheduler-worker
```

4. Verify next run time:
```bash
curl http://localhost:8012/api/v1/schedules/1 | jq '.next_run_time'
```

### High Memory Usage

Reduce worker concurrency:
```yaml
# docker-compose.yml
scheduler-worker:
  command: celery -A app.core.celery_app worker --loglevel=info --concurrency=1
```

### Database Growing Large

Old test runs are automatically cleaned up after 30 days (configurable). To manually cleanup:

```bash
# Adjust retention in .env
TEST_RUN_RETENTION_DAYS=7
```

### Missing Test Results

Check test execution logs:
```bash
docker compose logs -f scheduler-worker | grep "run_id"
```

View detailed error in test run:
```bash
curl http://localhost:8012/api/v1/schedules/1/history | jq '.history[0]'
```

## API Reference

See `/docs` endpoint for interactive API documentation (Swagger UI).

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/schedules/` | Create schedule |
| GET | `/api/v1/schedules/` | List schedules |
| GET | `/api/v1/schedules/{id}` | Get schedule |
| PUT | `/api/v1/schedules/{id}` | Update schedule |
| DELETE | `/api/v1/schedules/{id}` | Delete schedule |
| PATCH | `/api/v1/schedules/{id}/toggle` | Toggle active |
| POST | `/api/v1/schedules/{id}/trigger` | Manual trigger |
| GET | `/api/v1/schedules/{id}/history` | Execution history |
| GET | `/api/v1/schedules/presets` | List presets |

## Best Practices

### 1. Organize Tests into Suites

Group related tests into suites for easier management:
```json
{
  "name": "Checkout Flow Tests",
  "test_definition_ids": [10, 11, 12, 13, 14],
  "tags": {"category": "checkout", "priority": "critical"}
}
```

### 2. Use Tags for Dynamic Grouping

Add descriptive tags to test suites:
```json
{
  "tags": {
    "category": "authentication",
    "priority": "high",
    "team": "backend",
    "environment": "production"
  }
}
```

Then filter by tags:
```json
{
  "schedule_type": "tag_filter",
  "tag_filter": "priority:high"
}
```

### 3. Set Appropriate Retries

For critical tests:
```json
{
  "max_retries": 3,
  "retry_interval_seconds": 60
}
```

For non-critical tests:
```json
{
  "max_retries": 0
}
```

### 4. Avoid Concurrent Executions

For tests that modify shared state:
```json
{
  "allow_concurrent": false
}
```

### 5. Use Timezones Correctly

Always specify timezone:
```json
{
  "cron_expression": "0 9 * * *",
  "timezone": "America/New_York"
}
```

Common timezones:
- `UTC`: Coordinated Universal Time
- `America/New_York`: Eastern Time
- `America/Los_Angeles`: Pacific Time
- `Europe/London`: GMT
- `Asia/Shanghai`: China Standard Time

### 6. Monitor Execution History

Regularly check schedule history:
```bash
# Get recent runs
curl http://localhost:8012/api/v1/schedules/1/history?limit=10

# Check for failures
curl http://localhost:8012/api/v1/schedules/1/history | \
  jq '.history[] | select(.status == "failed")'
```

## Advanced Usage

### Complex Cron Expressions

Run every 6 hours:
```json
{
  "cron_expression": "0 */6 * * *"
}
```

Run on weekdays at 9am and 5pm:
```json
{
  "cron_expression": "0 9,17 * * 1-5"
}
```

Run on first Monday of each month:
```json
{
  "cron_expression": "0 0 1-7 * 1"
}
```

### Dynamic Environment Configuration

```json
{
  "environment_overrides": {
    "BASE_URL": "https://{{ENV}}.example.com",
    "DB_HOST": "{{ENV}}-db.example.com"
  }
}
```

### Conditional Execution

Use tags to create conditional schedules:

```bash
# Schedule only smoke tests
curl -X POST http://localhost:8012/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Smoke Tests",
    "schedule_type": "tag_filter",
    "tag_filter": "type:smoke",
    "cron_expression": "*/15 * * * *"
  }'

# Schedule only regression tests
curl -X POST http://localhost:8012/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Regression Tests",
    "schedule_type": "tag_filter",
    "tag_filter": "type:regression",
    "cron_expression": "0 2 * * *"
  }'
```

## Migration from Manual Execution

If you're currently running tests manually:

1. Identify frequently-run tests
2. Create test suites for related tests
3. Add appropriate tags
4. Create schedules with appropriate intervals
5. Start with non-critical schedules to validate
6. Gradually migrate all manual runs to schedules

## Support

For issues or questions:
1. Check logs: `docker compose logs -f scheduler-service`
2. Review API docs: `http://localhost:8012/docs`
3. Verify schedule configuration
4. Check Celery Beat and Worker logs
