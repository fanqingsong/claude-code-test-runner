# Implementation Plan: User Authentication System with MFA

**Branch**: `001-user-auth-mfa` | **Date**: 2026-05-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-user-auth-mfa/spec.md`

## Summary

Implement a comprehensive user authentication system for the Claude Code Test Runner platform supporting email/password registration, secure login with session management, TOTP-based MFA, password reset via email, and administrative account suspension. The system will integrate with the existing microservices architecture (PostgreSQL, Redis) and follow the IBM Carbon-inspired design system for frontend components.

## Technical Context

**Language/Version**: Python 3.11+ (backend), TypeScript/JavaScript (frontend)
**Primary Dependencies**:
- Backend: FastAPI 0.104+, SQLAlchemy 2.0+, pyotp 2.9+ (TOTP), bcrypt 4.1+, python-jose[cryptography] 3.3+ (JWT), pydantic 2.5+, celery 5.3+ (email queue), redis 5.0+
- Frontend: React 18+, Vite 5+, React Router 6+, Axios 1.6+
**Storage**: PostgreSQL 15+ (user data, sessions, audit logs), Redis 7+ (session cache, rate limiting, email queue)
**Testing**: pytest (backend), Vitest/Jest (frontend), Playwright (E2E)
**Target Platform**: Linux containers (Docker Compose deployment)
**Project Type**: Web service (microservices architecture)
**Performance Goals**:
- 500 concurrent login attempts with <500ms response time (p95)
- Email queue processing: 100 emails/minute
- Session validation: <100ms (cached in Redis)
- Audit log cleanup: Daily batch job
**Constraints**:
- WCAG 2.1 Level AA compliance for all authentication UI
- HTTP-only, secure cookies for session tokens
- 30-day automatic audit log deletion (GDPR compliance)
- Maximum 5 concurrent sessions per user
- Rate limiting: 5 login attempts per 15 minutes per IP
**Scale/Scope**:
- Initial: 10,000 users, 500 concurrent logins
- Target: 100,000 users, 5,000 concurrent logins
- Email volume: 1,000 emails/day (registration + password reset + MFA)
- Audit logs: ~50,000 events/day (30-day retention = 1.5M records)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Status**: ✅ PASS - No project constitution defined. Template constitution detected with no enforced principles.

**Notes**:
- No specific gates to validate
- Following industry best practices for authentication systems (OWASP guidelines)
- Test-Driven Development will be applied for critical security paths
- Accessibility (WCAG 2.1 AA) is enforced via clarifications

## Project Structure

### Documentation (this feature)

```text
specs/001-user-auth-mfa/
├── plan.md              # This file
├── research.md          # Phase 0: Technology research and decisions
├── data-model.md        # Phase 1: Database schema and relationships
├── quickstart.md        # Phase 1: Developer onboarding guide
├── contracts/           # Phase 1: API contracts
│   ├── auth-api.yaml    # OpenAPI spec for authentication endpoints
│   └── email-service.yaml # Email service interface contract
└── tasks.md             # Phase 2: Implementation tasks (created by /speckit-tasks)
```

### Source Code (repository root)

```text
service/
├── auth-service/                    # NEW: Authentication microservice
│   ├── app/
│   │   ├── api/
│   │   │   ├── v1/
│   │   │   │   ├── endpoints/
│   │   │   │   │   ├── auth.py      # Login, registration, logout
│   │   │   │   │   ├── mfa.py       # MFA setup, verify, disable
│   │   │   │   │   ├── password.py  # Password reset, change
│   │   │   │   │   ├── session.py   # Session management, list, terminate
│   │   │   │   │   └── admin.py     # Account suspension (admin only)
│   │   │   │   └── router.py        # API route aggregation
│   │   ├── core/
│   │   │   ├── config.py            # Configuration, environment variables
│   │   │   ├── security.py          # JWT, password hashing, TOTP
│   │   │   ├── celery_app.py        # Celery configuration
│   │   │   └── rate_limit.py        # Rate limiting logic
│   │   ├── models/
│   │   │   ├── user_account.py      # User account ORM model
│   │   │   ├── email_token.py       # Email verification/reset tokens
│   │   │   ├── user_session.py      # User session management
│   │   │   ├── mfa_secret.py        # MFA TOTP secrets
│   │   │   ├── recovery_code.py     # Backup recovery codes
│   │   │   └── audit_log.py         # Security audit logging
│   │   ├── schemas/
│   │   │   ├── auth.py              # Request/response schemas
│   │   │   ├── mfa.py
│   │   │   └── user.py
│   │   ├── services/
│   │   │   ├── auth_service.py      # Authentication business logic
│   │   │   ├── email_service.py     # Email queue management
│   │   │   ├── mfa_service.py       # MFA operations
│   │   │   ├── session_service.py   # Session lifecycle
│   │   │   └── audit_service.py     # Audit logging
│   │   ├── tasks/
│   │   │   ├── email_tasks.py       # Celery tasks for email queue
│   │   │   └── maintenance_tasks.py # Audit log cleanup, session expiration
│   │   ├── utils/
│   │   │   ├── password.py          # Password validation
│   │   │   └── email.py             # Email templates, formatting
│   │   └── main.py                  # FastAPI application
│   ├── tests/
│   │   ├── test_auth_endpoints.py   # Authentication API tests
│   │   ├── test_mfa_endpoints.py
│   │   ├── test_password_endpoints.py
│   │   ├── test_session_endpoints.py
│   │   ├── test_admin_endpoints.py
│   │   ├── test_services.py         # Business logic tests
│   │   └── test_security.py         # Security-focused tests
│   ├── alembic/                     # Database migrations
│   │   ├── versions/
│   │   └── env.py
│   ├── alembic.ini
│   ├── Dockerfile
│   ├── requirements.txt
│   └── pytest.ini
│
├── dashboard-service/               # EXISTING: Update for auth integration
│   ├── src/
│   │   ├── middleware/
│   │   │   └── auth.js              # NEW: JWT validation middleware
│   │   └── db.js                    # UPDATE: Add user queries
│   └── frontend/src/
│       ├── components/
│       │   ├── auth/                # NEW: Authentication UI components
│       │   │   ├── LoginForm.jsx
│       │   │   ├── RegistrationForm.jsx
│       │   │   ├── PasswordResetForm.jsx
│       │   │   ├── MFASetup.jsx
│       │   │   ├── MFALogin.jsx
│       │   │   └── SessionManager.jsx
│       │   └── admin/               # NEW: Admin user management
│       │       └── UserManagement.jsx
│       ├── pages/
│       │   ├── Login.jsx            # NEW: Login page
│       │   ├── Register.jsx         # NEW: Registration page
│       │   ├── PasswordReset.jsx    # NEW: Password reset flow
│       │   └── SecuritySettings.jsx # NEW: MFA, session management
│       └── services/
│           └── auth.js              # NEW: Auth API client
│
├── shared/                          # NEW: Shared utilities
│   ├── email/
│   │   ├── templates/               # Email HTML templates
│   │   │   ├── verification.html
│   │   │   ├── password-reset.html
│   │   │   ├── mfa-enabled.html
│   │   │   └── account-suspended.html
│   │   └── client.py                # Email service client
│   └── types/
│       └── auth.py                  # Shared type definitions
│
└── nginx/                           # EXISTING: Update routing
    └── conf.d/
        └── default.conf             # UPDATE: Add auth-service routes

tests/
├── e2e/
│   └── auth/
│       ├── registration.spec.js     # E2E tests for auth flows
│       ├── login.spec.js
│       ├── mfa.spec.js
│       └── password-reset.spec.js
└── accessibility/
    └── auth-a11y.spec.js            # WCAG 2.1 AA compliance tests
```

**Structure Decision**: Microservices architecture following the existing project pattern. New `auth-service` handles all authentication logic independently, while `dashboard-service` frontend consumes the auth API and `shared/` contains email templates and common utilities. This separation allows the auth service to be consumed by other future services (CLI tools, mobile apps, etc.).

## Complexity Tracking

> **No constitutional violations to justify. All design decisions follow standard industry practices for authentication systems.**
