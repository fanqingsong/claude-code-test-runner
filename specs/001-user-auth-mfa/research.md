# Phase 0: Research & Technology Decisions

**Feature**: User Authentication System with MFA
**Date**: 2026-05-06
**Status**: Complete

## Overview

This document captures research findings and technology decisions for implementing the authentication system. All critical technical choices have been resolved to support Phase 1 design.

---

## 1. Password Hashing Algorithm

### Decision: bcrypt with cost factor 12

**Rationale**:
- Proven security track record since 1999
- Adaptive work factor increases resistance to brute-force attacks as hardware improves
- Built-in salt generation prevents rainbow table attacks
- Industry standard for password storage (used by WordPress, Django, Stripe)
- Better memory-hardness alternatives (argon2, scrypt) not required for current threat model

**Alternatives Considered**:
- **Argon2**: Winner of Password Hashing Competition 2015, more resistant to GPU/ASIC attacks. Rejected due to higher computational cost and complexity for current threat model.
- **scrypt**: Memory-hard algorithm, good for GPU resistance. Rejected due to higher memory requirements and simpler bcrypt being sufficient.
- **PBKDF2**: NIST-standard, widely supported. Rejected due to weaker resistance against GPU attacks compared to bcrypt.

**Implementation Notes**:
- Use bcrypt library (4.1+) with `rounds=12` (~300ms per hash on modern CPU)
- Store as `bcrypt.hash(password, rounds=12)` resulting in 60-character string
- No separate salt storage needed (bcrypt includes salt in hash output)

---

## 2. JWT Token Strategy

### Decision: Stateless access tokens + Refresh token rotation

**Rationale**:
- Access tokens (short-lived: 15 minutes) stored in HTTP-only cookies
- Refresh tokens (long-lived: 30 days) for "remember me" functionality
- Refresh token rotation on each use prevents replay attacks
- Stateless access tokens scale horizontally without session storage lookups
- Redis caching for optional token revocation (suspended users, password changes)

**Alternatives Considered**:
- **Pure stateful sessions**: All sessions in database. Rejected due to scalability concerns (database load on every request).
- **Pure JWT without refresh**: Single long-lived token. Rejected due to inability to revoke tokens efficiently.
- **Session IDs only**: Traditional server-side sessions. Rejected due to microservices architecture requiring cross-service authentication.

**Implementation Notes**:
- Access token payload: `{"user_id": int, "email": str, "mfa_enabled": bool, "exp": timestamp}`
- Refresh token stored in database with user association and device fingerprint
- Refresh token rotation: Issue new refresh token on every use, invalidate old one
- Logout: Delete refresh token from database, add access token to Redis blacklist (optional)

---

## 3. TOTP Library Selection

### Decision: pyotp (Python) + otpauth URI format

**Rationale**:
- Pure Python implementation, no external C dependencies
- Supports both TOTP (time-based) and HOTP (counter-based)
- Compatible with all major authenticator apps (Google Authenticator, Authy, 1Password, etc.)
- Simple API: `pyotp.TOTP(secret).now()`, `pyotp.totp.TOTP(secret).verify(code)`
- otpauth URI format: `otpauth://totp/Service:email?secret=BASE32SECRET&issuer=Service`

**Alternatives Considered**:
- **Custom TOTP implementation**: Direct HMAC-SHA1 with time steps. Rejected due to risk of implementation bugs in security-critical code.
- **passlib**: Comprehensive password hashing library with TOTP support. Rejected due to heavier dependency footprint for just TOTP.

**Implementation Notes**:
- Generate random 160-bit secret (20 bytes) → Base32 encoding → 32-character string
- QR code generation: `qrcode` library with otpauth URI
- Time step: 30 seconds (standard), window: ±1 step (allow 90 seconds total for clock skew)
- Backup codes: Generate 10 random 8-character codes, hash with bcrypt before storage

---

## 4. Email Queue Architecture

### Decision: Celery + Redis with exponential backoff retry

**Rationale**:
- Celery already in project for scheduler service
- Redis as message broker (already in project for caching)
- Exponential backoff: 30s, 5m, 15m retries (total ~20 minutes)
- Dead letter queue for permanently failed emails
- Monitoring: Track failure rates, alert if >10% emails failing

**Alternatives Considered**:
- **Synchronous sending**: Block request until email sent. Rejected due to poor UX (slow page loads, email service outages block registration).
- **Background threads**: Python threading in web process. Rejected due to reliability issues (process restart loses queue).
- **AWS SES/SNS**: Managed service. Rejected due to vendor lockout and additional infrastructure complexity.

**Implementation Notes**:
- Email task schema: `{"template": str, "to": str, "context": dict, "attempt": int}`
- Retry strategy: `countdown=2**attempt * 30` (exponential backoff)
- After 3 failed attempts: Store failure in database, notify user on next login
- Rate limiting: Max 10 emails per hour per user (prevent abuse)

---

## 5. Rate Limiting Strategy

### Decision: Sliding window rate limiter in Redis

**Rationale**:
- Sliding window more accurate than fixed window or token bucket
- Redis provides fast atomic operations (O(1) per request)
- Key format: `ratelimit:{action}:{user_id or ip}` with sorted set by timestamp
- Cleanup: Expire keys automatically after window duration

**Alternatives Considered**:
- **Fixed window**: Counter reset on minute boundary. Rejected due to allowing burst at boundary (2x rate).
- **Token bucket**: Allow burst then steady rate. Rejected due to complexity and not needed for login (should not allow bursts).
- **Cloudflare API**: Edge rate limiting. Rejected due to not protecting against application-layer attacks (distributed brute force).

**Implementation Notes**:
- Login attempts: 5 per 15 minutes per IP
- Registration attempts: 3 per hour per IP
- Password reset: 3 per hour per email
- Redis operation: `ZREMRANGEBYSCORE key (now - window) +inf` then `ZCARD key` to count
- Response on limit: `429 Too Many Requests` with `Retry-After: seconds` header

---

## 6. Session Storage Strategy

### Decision: Hybrid - PostgreSQL source of truth + Redis cache

**Rationale**:
- PostgreSQL provides durable storage, audit trail, and relational queries
- Redis cache provides fast session validation (<1ms vs 50ms database)
- Cache-aside pattern: Check Redis first, fall back to PostgreSQL, populate cache on miss
- Write-through: Update both Redis and PostgreSQL on session changes
- Cache TTL: 5 minutes (balances freshness with load)

**Alternatives Considered**:
- **PostgreSQL only**: Simpler architecture. Rejected due to performance requirements (500 concurrent logins).
- **Redis only**: Fast but no audit trail. Rejected due to compliance requirements (audit logs for security events).
- **Memcached**: Alternative to Redis. Rejected due to lack of persistence (server restart loses all sessions).

**Implementation Notes**:
- Redis key format: `session:{session_id}` → JSON with user data, expiry
- Background job: Clean up expired sessions from PostgreSQL daily
- Session limit: Query PostgreSQL for active session count, enforce max 5

---

## 7. Accessibility (WCAG 2.1 Level AA)

### Decision: ARIA labels, keyboard navigation, semantic HTML

**Rationale**:
- WCAG 2.1 Level AA is legal requirement in many jurisdictions
- ARIA attributes: `role="alert"` for errors, `aria-live="polite"` for updates, `aria-label` for form fields
- Keyboard navigation: All interactive elements reachable via Tab, Enter/Space to activate
- Color contrast: Minimum 4.5:1 for normal text, 3:1 for large text (WCAG AA)
- Focus indicators: Visible outline on all focusable elements

**Implementation Notes**:
- Use semantic HTML: `<form>`, `<label>`, `<button>` instead of `<div>` with click handlers
- Screen reader testing: NVDA (Windows), VoiceOver (Mac)
- Keyboard testing: Tab through all forms, verify logical order
- Automated testing: axe-core in Playwright E2E tests

---

## 8. Database Indexing Strategy

### Decision: Composite indexes for common query patterns

**Indexes to Create**:
```sql
-- User lookups
CREATE INDEX idx_users_email ON user_accounts(email);
CREATE INDEX idx_users_status ON user_accounts(status, is_verified);

-- Session queries
CREATE INDEX idx_sessions_user ON user_sessions(user_id, created_at DESC);
CREATE INDEX idx_sessions_expiry ON user_sessions(expires_at);

-- Audit log queries (with time-based partitioning)
CREATE INDEX idx_audit_user_time ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_event_time ON audit_logs(event_type, created_at DESC);

-- Token lookups
CREATE INDEX idx_tokens_hash ON email_tokens(token_hash);
CREATE INDEX idx_tokens_expiry ON email_tokens(expires_at);
```

**Rationale**: B-tree indexes support equality and range queries. Composite indexes optimize common filter combinations (e.g., `WHERE status='active' AND is_verified=true`).

---

## 9. Security Headers & CORS

### Decision: OWASP recommended headers + Strict CORS

**Headers to Set**:
```
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
Cache-Control: no-store, no-cache, must-revalidate (for auth pages)
```

**CORS Policy**:
- Allow only frontend origin (dashboard-service on port 5173/8013)
- Allow methods: GET, POST, PUT, DELETE, OPTIONS
- Allow headers: Content-Type, Authorization
- Credentials: Include (for HTTP-only cookies)

---

## 10. Monitoring & Observability

### Decision: Structured logging + Prometheus metrics

**Log Format** (JSON):
```json
{
  "timestamp": "2026-05-06T10:00:00Z",
  "level": "INFO",
  "event": "login_success",
  "user_id": 123,
  "ip": "192.168.1.1",
  "user_agent": "Mozilla/5.0...",
  "mfa_enabled": true,
  "duration_ms": 150
}
```

**Metrics to Track**:
- `auth_login_attempts_total` (counter by result: success/failure)
- `auth_login_duration_seconds` (histogram)
- `auth_mfa_verifications_total` (counter by result)
- `auth_email_queue_size` (gauge)
- `auth_active_sessions` (gauge)
- `auth_rate_limit_blocks_total` (counter)

**Alerts**:
- >100 failed logins per minute from single IP (brute force)
- Email queue depth >1000 (email service issues)
- MFA verification failure rate >10% (TOTP clock skew or user error)

---

## Summary

All critical technical decisions resolved. No blockers for Phase 1 design.

**Key Takeaways**:
- Security-first approach: bcrypt, JWT with rotation, TOTP, rate limiting
- Scalability: Redis caching, Celery queues, stateless access tokens
- Accessibility: WCAG 2.1 AA compliance required
- Observability: Structured logging, Prometheus metrics, alerting

**Next Phase**: Proceed to Phase 1 (data model, contracts, quickstart)
