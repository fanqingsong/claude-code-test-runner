# Test Scheduling - Quick Start Guide

## Prerequisites

- Docker and Docker Compose installed
- Test definitions already created in test-case-service
- Ports 8011-8013 available

## 5-Minute Setup

### Step 1: Start Services

```bash
cd docker-compose
docker compose up -d

# Wait for services to be healthy (about 30 seconds)
docker compose ps
```

### Step 2: Verify Services

```bash
# Check API is accessible
curl http://localhost:8012/health

# View API documentation
open http://localhost:8012/docs  # macOS
xdg-open http://localhost:8012/docs  # Linux
```

### Step 3: Create Your First Schedule

```bash
# Schedule a test to run every hour
curl -X POST http://localhost:8012/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My First Schedule",
    "schedule_type": "single",
    "test_definition_id": 1,
    "cron_expression": "0 * * * *",
    "is_active": true
  }'
```

### Step 4: Trigger Manually (Optional)

```bash
# Get the schedule ID from previous response
SCHEDULE_ID=1

# Trigger immediately
curl -X POST http://localhost:8012/api/v1/schedules/$SCHEDULE_ID/trigger
```

### Step 5: View Execution History

```bash
curl http://localhost:8012/api/v1/schedules/$SCHEDULE_ID/history
```

## Common Schedules

### Daily at 9 AM

```bash
curl -X POST http://localhost:8012/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Daily 9AM Check",
    "schedule_type": "single",
    "test_definition_id": 1,
    "cron_expression": "0 9 * * *",
    "timezone": "UTC"
  }'
```

### Every 30 Minutes

```bash
curl -X POST http://localhost:8012/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Frequent Health Check",
    "schedule_type": "single",
    "test_definition_id": 1,
    "cron_expression": "*/30 * * * *"
  }'
```

### Weekdays at 8 AM and 5 PM

```bash
curl -X POST http://localhost:8012/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Business Hours Check",
    "schedule_type": "single",
    "test_definition_id": 1,
    "cron_expression": "0 8,17 * * 1-5"
  }'
```

## Managing Test Suites

### Create Test Suite

```bash
curl -X POST http://localhost:8012/api/v1/test-suites/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Critical Tests",
    "description": "High-priority tests",
    "test_definition_ids": [1, 2, 3, 4, 5],
    "tags": {"priority": "critical"}
  }'
```

### Schedule Test Suite

```bash
# Use the suite_id from previous response
curl -X POST http://localhost:8012/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Weekly Critical Tests",
    "schedule_type": "suite",
    "test_suite_id": 1,
    "cron_expression": "0 2 * * 0"
  }'
```

## Checking Status

### List All Schedules

```bash
curl http://localhost:8012/api/v1/schedules/ | jq
```

### Get Schedule Details

```bash
curl http://localhost:8012/api/v1/schedules/1 | jq
```

### View Recent Executions

```bash
curl http://localhost:8012/api/v1/schedules/1/history | jq '.history[:5]'
```

### Toggle Schedule On/Off

```bash
# Turn off
curl -X PATCH http://localhost:8012/api/v1/schedules/1/toggle \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'

# Turn on
curl -X PATCH http://localhost:8012/api/v1/schedules/1/toggle \
  -H "Content-Type: application/json" \
  -d '{"is_active": true}'
```

## Troubleshooting

### Schedule Not Running?

```bash
# 1. Check schedule is active
curl http://localhost:8012/api/v1/schedules/1 | jq '.is_active'

# 2. Check next run time
curl http://localhost:8012/api/v1/schedules/1 | jq '.next_run_time'

# 3. Check Celery Beat logs
docker compose logs -f scheduler-beat

# 4. Check worker logs
docker compose logs -f scheduler-worker
```

### View All Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f scheduler-service
docker compose logs -f scheduler-beat
docker compose logs -f scheduler-worker
```

### Restart Services

```bash
docker compose restart scheduler-beat scheduler-worker
```

## Next Steps

1. Read the [Complete User Guide](test-scheduling-guide.md)
2. Explore [API Documentation](http://localhost:8012/docs)
3. Set up monitoring and alerts
4. Configure retention policies
5. Integrate with CI/CD pipeline

## Example Use Cases

### Health Check Every Minute

```bash
curl -X POST http://localhost:8012/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Health Check",
    "schedule_type": "single",
    "test_definition_id": 1,
    "cron_expression": "* * * * *",
    "allow_concurrent": false
  }'
```

### Nightly Regression Suite

```bash
curl -X POST http://localhost:8012/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nightly Regression",
    "schedule_type": "suite",
    "test_suite_id": 1,
    "cron_expression": "0 2 * * *",
    "max_retries": 2,
    "environment_overrides": {
      "ENV": "staging"
    }
  }'
```

### Business Hours Monitoring

```bash
curl -X POST http://localhost:8012/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Business Hours Monitor",
    "schedule_type": "tag_filter",
    "tag_filter": "monitoring:production",
    "cron_expression": "0 9-17 * * 1-5",
    "timezone": "America/New_York"
  }'
```

## Getting Help

- API Docs: http://localhost:8012/docs
- Logs: `docker compose logs -f`
- Database: Connect to postgres on port 5433
- Redis: Connect to redis on port 6380
