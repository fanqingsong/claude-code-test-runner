# Phase 1: Data Model

**Feature**: User Authentication System with MFA
**Date**: 2026-05-06
**Status**: Complete

## Overview

This document defines the database schema for the authentication system. All entities are stored in PostgreSQL with Redis caching for performance optimization.

---

## Entity Relationship Diagram

```
┌─────────────────┐
│  user_accounts  │
├─────────────────┤
│ id (PK)         │──┐
│ email           │  │
│ password_hash   │  │
│ is_verified     │  │     ┌──────────────┐
│ status          │  │────│user_sessions │
│ mfa_enabled     │  │     └──────────────┘
│ failed_logins   │  │           │
│ created_at      │  │           │
│ last_login      │  │     ┌─────┴─────┐
│ updated_at      │  │     │           │
└─────────────────┘  │     │           │
        │            │  ┌──┴──────┐  ┌──▼─────────────┐
        │            │  │         │  │ mfa_secrets    │
        │            │  │         │  ├────────────────┤
        │            │  │         │  │ id (PK)        │
        │            │  │         │  │ user_id (FK)   │
        │            │  │         │  │ secret_hash    │
        │            │  │         │  │ is_enabled     │
        │            │  │         │  │ created_at     │
        │            │  │         │  └────────────────┘
        │            │  │         │
        │            │  │         │
        │            │  │         │
        ▼            │  ▼         ▼
┌───────────────┐  │  ┌────────────────┐
│  email_tokens │  │  │recovery_codes │
├───────────────┤  │  ├────────────────┤
│ id (PK)       │  │  │ id (PK)        │
│ user_id (FK)  │  │  │ mfa_id (FK)    │
│ token_hash    │  │  │ code_hash      │
│ token_type    │  │  │ is_used        │
│ expires_at    │  │  │ used_at        │
│ created_at    │  │  └────────────────┘
│ used_at       │  │
└───────────────┘  │
                   │
                   │
                   ▼
         ┌─────────────────┐
         │   audit_logs    │
         ├─────────────────┤
         │ id (PK)         │
         │ user_id (FK)    │
         │ event_type      │
         │ ip_address      │
         │ user_agent      │
         │ metadata        │
         │ created_at      │
         │ auto_delete_at  │
         └─────────────────┘
```

---

## Table Definitions

### 1. user_accounts

Core user entity storing authentication credentials and account status.

```sql
CREATE TABLE user_accounts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(60) NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'active',
    suspension_reason TEXT,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON user_accounts(email);
CREATE INDEX idx_users_status ON user_accounts(status, is_verified);
CREATE INDEX idx_users_created ON user_accounts(created_at DESC);

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON user_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

**Validation Rules**:
- `email`: Valid email format, lowercase, trimmed
- `password_hash`: bcrypt hash (cost factor 12, 60 chars)
- `status`: ENUM ('active', 'suspended', 'admin_suspended')
- `failed_login_attempts`: Resets to 0 on successful login
- `locked_until`: NULL when not locked, future timestamp after repeated failures

**State Transitions**:
```
[unverified] --verify email--> [active]
[active] --suspend--> [suspended]
[suspended] --reactivate--> [active]
[any] --failed logins--> [temporarily_locked] --wait--> [previous_state]
```

---

### 2. user_sessions

Active user sessions with device tracking for concurrent session management.

```sql
CREATE TABLE user_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    device_fingerprint VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    is_remember_me BOOLEAN DEFAULT FALSE,
    last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id, created_at DESC);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_sessions_expiry ON user_sessions(expires_at);
```

**Validation Rules**:
- `session_token`: Cryptographically random 256-bit token (base64 encoded, 43 chars)
- `device_fingerprint`: SHA256 hash of user agent + IP (optional)
- `expires_at`:
  - 30 days if `is_remember_me = TRUE`
  - Session end if `is_remember_me = FALSE`
- Max 5 active sessions per user (application-level enforcement)

**Cleanup Strategy**:
- Daily background job: `DELETE FROM user_sessions WHERE expires_at < NOW()`
- Soft delete: Mark expired, keep for audit

---

### 3. mfa_secrets

TOTP secrets for multi-factor authentication.

```sql
CREATE TABLE mfa_secrets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
    secret_hash VARCHAR(255) NOT NULL,
    is_enabled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    enabled_at TIMESTAMP NULL
);

CREATE INDEX idx_mfa_user ON mfa_secrets(user_id);
CREATE INDEX idx_mfa_enabled ON mfa_secrets(is_enabled);
```

**Validation Rules**:
- `secret_hash`: bcrypt hash of raw TOTP secret
- Raw secret: 20 random bytes → Base32 → 32 chars
- One secret per user (UNIQUE on `user_id`)
- `is_enabled = FALSE` during setup, requires TOTP verification

**Security Notes**:
- Store hashed secret (defense in depth)
- QR code displayed during setup, never stored
- Backup codes in separate table

---

### 4. recovery_codes

One-time backup codes for MFA recovery.

```sql
CREATE TABLE recovery_codes (
    id SERIAL PRIMARY KEY,
    mfa_id INTEGER NOT NULL REFERENCES mfa_secrets(id) ON DELETE CASCADE,
    code_hash VARCHAR(60) NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_recovery_mfa ON recovery_codes(mfa_id, is_used);
```

**Validation Rules**:
- Exactly 10 codes per MFA secret
- Code format: 8 alphanumeric chars (e.g., `A1B2C3D4`)
- Single-use only
- User can regenerate (old codes invalidated)

**Regeneration**:
```sql
BEGIN;
UPDATE recovery_codes SET is_used = TRUE WHERE mfa_id = ? AND is_used = FALSE;
INSERT INTO recovery_codes (mfa_id, code_hash) VALUES (?, ?), ...;
COMMIT;
```

---

### 5. email_tokens

Time-limited tokens for email verification and password reset.

```sql
CREATE TABLE email_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    token_type VARCHAR(20) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tokens_hash ON email_tokens(token_hash);
CREATE INDEX idx_tokens_user_type ON email_tokens(user_id, token_type);
CREATE INDEX idx_tokens_expiry ON email_tokens(expires_at);
```

**Validation Rules**:
- `token`: 256-bit random (64 hex chars)
- `token_hash`: SHA256 for fast lookup
- `token_type`: ENUM ('verification', 'password_reset')
- `expires_at`:
  - 24 hours for verification
  - 1 hour for password reset
- Single-use only

**Cleanup**:
- Daily: `DELETE FROM email_tokens WHERE expires_at < NOW() - INTERVAL '7 days'`

---

### 6. audit_logs

Security event logging for compliance and incident response.

```sql
CREATE TABLE audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES user_accounts(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    auto_delete_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_audit_user_time ON audit_logs(user_id, created_at DESC);
CREATE INDEX idx_audit_event_time ON audit_logs(event_type, created_at DESC);
CREATE INDEX idx_audit_auto_delete ON audit_logs(auto_delete_at);
```

**Event Types**:
```python
EVENT_TYPES = [
    'login_success', 'login_failure', 'logout',
    'registration_completed', 'email_verified',
    'password_reset', 'password_changed',
    'mfa_enabled', 'mfa_disabled', 'mfa_verified',
    'mfa_recovery_code_used',
    'account_suspended', 'account_reactivated',
    'session_created', 'session_terminated',
    'rate_limit_exceeded',
]
```

**Metadata Examples**:
```json
// login_failure
{"reason": "invalid_password", "failed_attempts": 3}

// mfa_verified
{"method": "totp"} or {"method": "recovery_code", "code_id": 123}

// account_suspended
{"suspended_by": "admin@example.com", "reason": "policy_violation"}

// session_created
{"device": "Chrome on Windows", "location": "San Francisco, CA"}
```

**Cleanup**:
- Daily: `DELETE FROM audit_logs WHERE auto_delete_at < NOW()`
- Partitioning: Monthly partitions for faster deletion

---

## Redis Data Structures

### Session Cache

```
Key: session:{session_id}
Type: Hash
TTL: 300 seconds (5 minutes)
Fields:
  - user_id: INTEGER
  - email: STRING
  - mfa_enabled: BOOLEAN
  - is_remember_me: BOOLEAN
  - expires_at: TIMESTAMP
```

### Rate Limiting

```
Key: ratelimit:{action}:{identifier}
Type: Sorted Set (timestamp as score)
TTL: 900 seconds (15 minutes)
```

### Email Queue

```
Key: celery (default Celery key)
Type: List
```

---

## Database Migrations

### Migration Order

1. **001_initial_schema.sql**: Create all tables
2. **002_indexes.sql**: Create indexes
3. **003_triggers.sql**: Create update_at triggers
4. **004_seed_data.sql**: Insert admin accounts
5. **005_audit_log_partitioning.sql**: Set up partitioning

---

## Summary

**Total Tables**: 6
**Total Indexes**: 15+
**Redis Keys**: 3 patterns
**Estimated Storage**:
- 10,000 users: ~50 MB
- 100,000 users: ~500 MB
- Audit logs (30-day): ~750 MB

**Performance**:
- Session validation: <1ms (Redis)
- User lookup: <50ms (PostgreSQL)
- Audit log insertion: <10ms (async)
- Concurrent logins: 500+
