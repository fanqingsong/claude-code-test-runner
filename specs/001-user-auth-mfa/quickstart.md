# Developer Quickstart: Authentication Feature

**Feature**: User Authentication System with MFA
**Last Updated**: 2026-05-06

## Overview

This guide helps developers quickly get started with implementing and testing the authentication feature.

---

## Prerequisites

### Required Software
- Docker & Docker Compose
- Python 3.11+
- Node.js 18+
- Git

### Environment Setup

```bash
# Clone repository
git clone <repository-url>
cd claude-code-test-runner

# Start infrastructure services
cd docker-compose
docker-compose up -d postgres redis

# Verify services are running
docker-compose ps
```

---

## Local Development Setup

### 1. Authentication Service (Backend)

```bash
cd service/auth-service

# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
export DATABASE_URL=postgresql://cc_test_user:password@localhost:5433/cc_test_db
export REDIS_URL=redis://localhost:6380/0
export SECRET_KEY=your-secret-key-here
export JWT_SECRET_KEY=your-jwt-secret-here

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --port 8010
```

**Verify**: Open http://localhost:8010/docs for API documentation

### 2. Dashboard Service (Frontend)

```bash
cd service/dashboard-service

# Install dependencies
npm install

# Start backend
npm run dev

# Start frontend (new terminal)
npm run frontend:dev
```

**Verify**: Open http://localhost:8013 for dashboard

---

## Testing the Authentication Flow

### User Story 1: Registration & Email Verification

#### 1. Register a New User

```bash
curl -X POST http://localhost:8010/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!"
  }'
```

**Expected Response**:
```json
{
  "message": "Registration successful. Please check your email to verify your account.",
  "user_id": 1
}
```

#### 2. Verify Email

```bash
# Get verification token from Celery worker logs or test email
curl -X POST http://localhost:8010/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{
    "token": "<verification-token-from-email>"
  }'
```

**Expected Response**:
```json
{
  "message": "Email verified successfully. You can now log in."
}
```

### User Story 2: Login with Remember Me

#### 3. Login with Remember Me

```bash
# Login with remember_me = true (30-day session)
curl -X POST http://localhost:8010/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "SecurePass123!",
    "remember_me": true
  }' \
  -c cookies.txt
```

**Expected Response**:
```json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh_token": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "session_token": "xYz123...",
  "user": {
    "id": 1,
    "email": "test@example.com",
    "is_verified": true,
    "created_at": "2026-05-06T20:00:00Z"
  }
}
```

#### 4. Test Remember Me Functionality

```bash
# Check session expiry (should be 30 days from now for remember_me=true)
# For session-only (remember_me=false), expiry should be 24 hours
curl -X GET http://localhost:8010/api/v1/auth/sessions \
  -H "X-Session-Token: $(grep session_token cookies.txt | cut -f7)"
```

**Expected Response** (array of sessions):
```json
[
  {
    "id": 1,
    "session_token": "xYz123...",
    "user_agent": "curl/7.68.0",
    "ip_address": "127.0.0.1",
    "last_active": "2026-05-06T20:05:00Z",
    "expires_at": "2026-06-05T20:05:00Z",
    "created_at": "2026-05-06T20:05:00Z"
  }
]
```

#### 5. Test Concurrent Session Limit

```bash
# Simulate 6 concurrent logins from different IPs
for i in {1..6}; do
  curl -X POST http://localhost:8010/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -H "X-Forwarded-For: 192.168.1.$i" \
    -d '{
      "email": "test@example.com",
      "password": "SecurePass123!",
      "remember_me": false
    }' \
    -s | grep -q "access_token" && echo "Login $i: SUCCESS" || echo "Login $i: FAILED"
done

# Check that only 5 sessions exist (oldest terminated)
curl -X GET http://localhost:8010/api/v1/auth/sessions \
  -H "X-Session-Token: $(grep session_token cookies.txt | cut -f7)" \
  | jq '. | length'
```

**Expected Result**: Should show 5 sessions (oldest session automatically terminated)

#### 6. Test Session Termination

```bash
# Terminate a specific session
SESSION_ID=2
curl -X DELETE http://localhost:8010/api/v1/auth/sessions/$SESSION_ID \
  -H "X-Session-Token: $(grep session_token cookies.txt | cut -f7)"
```

**Expected Response**:
```json
{
  "message": "Session terminated successfully"
}
```

#### 7. Test Logout

```bash
curl -X POST http://localhost:8010/api/v1/auth/logout \
  -H "X-Session-Token: $(grep session_token cookies.txt | cut -f7)"
```

**Expected Response**:
```json
{
  "message": "Logged out successfully"
}
```

### User Story 3: MFA Setup (Future)

#### 8. Setup MFA

```bash
curl -X POST http://localhost:8010/api/v1/auth/mfa/setup \
  -H "X-Session-Token: $(grep session_token cookies.txt | cut -f7)"
```

**Expected Response**:
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qr_code_url": "otpauth://totp/..."
}
```

---

## Database Queries

### Key Tables

```sql
-- View users
SELECT id, email, is_verified, status, mfa_enabled
FROM user_accounts;

-- View sessions
SELECT id, user_id, ip_address, expires_at
FROM user_sessions;

-- View audit logs
SELECT event_type, ip_address, created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 20;
```

---

## Testing

### Unit Tests

```bash
# Backend
cd service/auth-service
pytest tests/ -v

# Frontend
cd service/dashboard-service
npm test
```

### E2E Tests

```bash
# Run Playwright tests
npm run test:e2e

# Run accessibility tests
npm run test:a11y
```

---

## Troubleshooting

### Common Issues

**Email not received**
```bash
# Check Celery worker logs
docker logs cc-test-auth-service-worker

# Check email queue in Redis
docker exec -it cc-test-redis redis-cli
> KEYS celery-task-meta-*
> LLEN email_tasks

# Verify SMTP configuration
docker exec cc-test-auth-service env | grep SMTP

# Test email delivery manually
docker exec cc-test-auth-service python -c "
import smtplib
s = smtplib.SMTP('smtp.gmail.com', 587)
s.starttls()
# Check if connection succeeds
s.quit()
"
```

**Database connection error**
```bash
# Verify PostgreSQL is running
docker-compose ps postgres

# Test connection
docker exec cc-test-postgres psql -U cc_test_user -d cc_test_db -c "SELECT 1;"

# Check database migrations
docker exec cc-test-auth-service alembic current

# Run migrations if needed
docker exec cc-test-auth-service alembic upgrade head
```

**Rate limiting blocking tests**
```bash
# Clear specific rate limit
docker exec -it cc-test-redis redis-cli
> DEL ratelimit:login:127.0.0.1
> DEL ratelimit:register:127.0.0.1

# View all rate limit keys
> KEYS ratelimit:*

# Flush all Redis data (CAUTION: clears all data)
> FLUSHDB
```

**MFA verification failing**
```bash
# Check if MFA is enabled for user
docker exec cc-test-postgres psql -U cc_test_user -d cc_test_db -c "
SELECT u.email, m.enabled, m.verified_at
FROM user_accounts u
LEFT JOIN mfa_secrets m ON u.id = m.user_id
WHERE u.email = 'test@example.com';
"

# Verify TOTP secret exists
docker exec cc-test-postgres psql -U cc_test_user -d cc_test_db -c "
SELECT secret, enabled, verified_at
FROM mfa_secrets
WHERE user_id = 1;
"

# Check backup codes
docker exec cc-test-postgres psql -U cc_test_user -d cc_test_db -c "
SELECT code, used_at
FROM recovery_codes
WHERE user_id = 1;
"
```

**Session validation errors**
```bash
# Check active sessions
docker exec cc-test-postgres psql -U cc_test_user -d cc_test_db -c "
SELECT id, ip_address, expires_at, created_at
FROM user_sessions
WHERE user_id = 1
ORDER BY created_at DESC;
"

# Verify Redis cache
docker exec -it cc-test-redis redis-cli
> GET session:valid:<session_token>

# Clear session cache
> DEL session:valid:*
```

**Account locked out**
```bash
# Check failed login attempts
docker exec cc-test-postgres psql -U cc_test_user -d cc_test_db -c "
SELECT email, failed_login_attempts, account_locked_until
FROM user_accounts
WHERE email = 'test@example.com';
"

# Clear lockout (admin only)
docker exec cc-test-postgres psql -U cc_test_user -d cc_test_db -c "
UPDATE user_accounts
SET failed_login_attempts = 0, account_locked_until = NULL
WHERE email = 'test@example.com';
"
```

**Password reset token expired**
```bash
# Check token expiry
docker exec cc-test-postgres psql -U cc_test_user -d cc_test_db -c "
SELECT token, expires_at, used_at
FROM email_tokens
WHERE user_id = 1 AND token_type = 'password_reset'
ORDER BY created_at DESC
LIMIT 5;
"

# Token validity period is 1 hour
# Generate new reset token if expired
```

**Celery worker not processing tasks**
```bash
# Check worker status
docker exec cc-test-auth-service-worker celery -A app.core.celery_app inspect active

# Check registered tasks
docker exec cc-test-auth-service-worker celery -A app.core.celery_app inspect registered

# View worker logs
docker logs cc-test-auth-service-worker --tail 100

# Restart worker
docker-compose restart auth-service-worker
```

**Audit logs not being created**
```bash
# Check audit service configuration
docker exec cc-test-auth-service env | grep AUDIT

# Verify audit_logs table exists
docker exec cc-test-postgres psql -U cc_test_user -d cc_test_db -c "\d audit_logs"

# Check recent audit entries
docker exec cc-test-postgres psql -U cc_test_user -d cc_test_db -c "
SELECT event_type, ip_address, created_at
FROM audit_logs
ORDER BY created_at DESC
LIMIT 10;
"
```

**Frontend authentication errors**
```bash
# Check browser console for CORS errors
# Verify CORS origins configuration
docker exec cc-test-auth-service env | grep CORS_ORIGINS

# Check session token in browser
# Application > Local Storage > session_token

# Verify API connectivity
curl http://localhost:8010/health
curl http://localhost:8010/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "wrong"}'
```

**Performance issues**
```bash
# Check database query performance
docker exec cc-test-postgres psql -U cc_test_user -d cc_test_db -c "
EXPLAIN ANALYZE
SELECT * FROM user_accounts WHERE email = 'test@example.com';
"

# Check Redis memory usage
docker exec cc-test-redis redis-cli INFO memory

# Check Celery queue depth
docker exec cc-test-redis redis-cli
> LLEN email_tasks
> LLEN maintenance

# Monitor worker CPU/memory
docker stats cc-test-auth-service-worker
```

### Debug Mode

Enable detailed logging:

```bash
# Set environment variable
docker exec cc-test-auth-service bash -c "export LOG_LEVEL=DEBUG && uvicorn app.main:app --reload"

# Or update docker-compose.yml
environment:
  LOG_LEVEL: DEBUG
```

### Health Checks

```bash
# Auth service health
curl http://localhost:8010/health

# Database health
docker exec cc-test-postgres pg_isready -U cc_test_user

# Redis health
docker exec cc-test-redis redis-cli ping

# Celery worker health
docker exec cc-test-auth-service-worker celery -A app.core.celery_app inspect ping
```

---

## Security Checklist

Before deploying to production:

- [ ] Change all default passwords and secrets
- [ ] Enable HTTPS (TLS/SSL certificates)
- [ ] Set strong SECRET_KEY and JWT_SECRET_KEY
- [ ] Configure CORS for production domain only
- [ ] Enable rate limiting
- [ ] Review audit log retention policy
- [ ] Test brute-force protection
- [ ] Verify email deliverability
- [ ] Test MFA recovery flow
- [ ] Run accessibility audit (WCAG 2.1 AA)
- [ ] Review OWASP Top 10 vulnerabilities
- [ ] Enable security headers (HSTS, CSP, etc.)

---

## Resources

### Documentation
- [Feature Specification](spec.md)
- [Data Model](data-model.md)
- [API Contract](contracts/auth-api.yaml)
- [Research Decisions](research.md)

### External References
- [OWASP Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [React Documentation](https://react.dev/)

---

**Happy coding! 🚀**
