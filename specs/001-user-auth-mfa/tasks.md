# Tasks: User Authentication System with MFA

**Input**: Design documents from `/specs/001-user-auth-mfa/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/auth-api.yaml

**Tests**: This feature specification does not explicitly request TDD. Test tasks are NOT included to focus on implementation. Security testing is critical for authentication systems and should be added separately if required.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4, US5)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md microservices architecture:
- Backend: `service/auth-service/app/`
- Frontend: `service/dashboard-service/frontend/src/`
- Shared: `service/shared/`
- Infrastructure: `docker-compose/`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure for authentication microservice

- [X] T001 Create auth-service directory structure at service/auth-service/app/
- [X] T002 Initialize Python project with FastAPI, SQLAlchemy, pydantic, pyotp, bcrypt, python-jose, celery in service/auth-service/requirements.txt
- [X] T003 [P] Configure pyproject.toml for pytest black flake8 isort in service/auth-service/
- [X] T004 [P] Create Dockerfile for auth-service in service/auth-service/Dockerfile
- [X] T005 [P] Create .env.example template with DATABASE_URL REDIS_URL SECRET_KEY JWT_SECRET_KEY SMTP_HOST SMTP_PORT SMTP_USER SMTP_PASSWORD EMAIL_FROM in service/auth-service/
- [X] T006 [P] Create alembic configuration for database migrations in service/auth-service/alembic.ini and service/auth-service/alembic/env.py
- [X] T007 [P] Create pytest.ini with test discovery configuration in service/auth-service/pytest.ini
- [X] T008 [P] Update docker-compose.yml to add auth-service container with build context and depends on postgres redis in docker-compose/docker-compose.yml
- [X] T009 [P] Update nginx routing to include auth-service on port 8010 in docker-compose/nginx/conf.d/default.conf

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Configuration & Security Core

- [X] T010 Create FastAPI application factory with CORS middleware configuration in service/auth-service/app/main.py
- [X] T011 [P] Implement environment configuration management with pydantic-settings in service/auth-service/app/core/config.py
- [X] T012 [P] Implement password hashing utilities with bcrypt cost factor 12 in service/auth-service/app/core/security.py
- [X] T013 [P] Implement JWT token generation and validation with 15-minute access tokens in service/auth-service/app/core/security.py
- [X] T014 [P] Implement TOTP secret generation and validation using pyotp in service/auth-service/app/core/security.py
- [X] T015 [P] Configure Celery app with Redis broker in service/auth-service/app/core/celery_app.py
- [X] T016 [P] Implement sliding window rate limiting using Redis sorted sets in service/auth-service/app/core/rate_limit.py
- [X] T017 [P] Create structured logging configuration with JSON format in service/auth-service/app/core/logging.py

### Database Foundation

- [X] T018 Create database migration 001_initial_schema.sql with all 6 tables user_accounts user_sessions mfa_secrets recovery_codes email_tokens audit_logs in service/auth-service/alembic/versions/001_initial_schema.sql
- [X] T019 Create database migration 002_indexes.sql with 15+ indexes for query optimization in service/auth-service/alembic/versions/002_indexes.sql
- [X] T020 Create database migration 003_triggers.sql with updated_at triggers in service/auth-service/alembic/versions/003_triggers.sql
- [X] T021 [P] Create UserAccount ORM model in service/auth-service/app/models/user_account.py
- [X] T022 [P] Create UserSession ORM model in service/auth-service/app/models/user_session.py
- [X] T023 [P] Create EmailToken ORM model in service/auth-service/app/models/email_token.py
- [X] T024 [P] Create MFASecret ORM model in service/auth-service/app/models/mfa_secret.py
- [X] T025 [P] Create RecoveryCode ORM model in service/auth-service/app/models/recovery_code.py
- [X] T026 [P] Create AuditLog ORM model in service/auth-service/app/models/audit_log.py
- [X] T027 Create base database session and engine configuration in service/auth-service/app/core/database.py

### Email Queue Infrastructure

- [X] T028 [P] Create email task schema with pydantic validation template context attempt fields in service/auth-service/app/tasks/email_tasks.py
- [X] T029 [P] Implement Celery task for sending emails with exponential backoff retry 30s 5m 15m in service/auth-service/app/tasks/email_tasks.py
- [X] T030 [P] Implement email failure tracking after 3 failed attempts in service/auth-service/app/tasks/email_tasks.py
- [X] T031 [P] Create email HTML templates for verification password-reset mfa-enabled account-suspended in service/shared/email/templates/
- [X] T032 [P] Create email service client for queueing emails in service/shared/email/client.py

### API Foundation

- [X] T033 Create API router v1 with prefix aggregation in service/auth-service/app/api/v1/router.py
- [X] T034 [P] Create Pydantic schemas for authentication requests RegistrationRequest LoginRequest EmailVerificationRequest in service/auth-service/app/schemas/auth.py
- [X] T035 [P] Create Pydantic schemas for MFA requests MFAVerificationRequest MFASetupRequest MFAEnableRequest in service/auth-service/app/schemas/mfa.py
- [X] T036 [P] Create Pydantic schemas for password requests PasswordResetRequest PasswordResetConfirmRequest PasswordChangeRequest in service/auth-service/app/schemas/password.py
- [X] T037 [P] Create Pydantic schemas for user responses User Session in service/auth-service/app/schemas/user.py
- [X] T038 [P] Create Pydantic schemas for error responses Error with error message fields in service/auth-service/app/schemas/common.py

### Maintenance Jobs

- [X] T039 [P] Implement Celery task for daily audit log cleanup (delete records where auto_delete_at < NOW()) in service/auth-service/app/tasks/maintenance_tasks.py
- [X] T040 [P] Implement Celery task for expired session cleanup in service/auth-service/app/tasks/maintenance_tasks.py

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Email/Password Registration (Priority: P1) 🎯 MVP

**Goal**: Enable new users to register accounts with email verification

**Independent Test**: A user can navigate to registration page, enter email/password, receive verification email, click link, verify account, and log in successfully

### Models for User Story 1

- [X] T041 [US1] Add email validation and password strength validation methods to UserAccount model in service/auth-service/app/models/user_account.py

### Services for User Story 1

- [X] T042 [US1] Implement password strength validator (8+ chars, mixed case, numbers, special chars) in service/auth-service/app/utils/password.py
- [X] T043 [US1] Implement email format validator with deliverability check in service/auth-service/app/utils/email.py
- [X] T044 [US1] Implement email verification token generation (SHA256 hashed, 24-hour expiry) in service/auth-service/app/services/auth_service.py
- [X] T045 [US1] Implement user registration business logic in service/auth-service/app/services/auth_service.py
- [X] T046 [US1] Implement email verification token validation logic in service/auth-service/app/services/auth_service.py
- [X] T047 [US1] Implement check for existing email during registration in service/auth-service/app/services/auth_service.py

### Endpoints for User Story 1

- [X] T048 [US1] Implement POST /auth/register endpoint (creates user, queues verification email) in service/auth-service/app/api/v1/endpoints/auth.py
- [X] T049 [US1] Implement POST /auth/verify-email endpoint (validates token, marks account verified) in service/auth-service/app/api/v1/endpoints/auth.py

### Frontend for User Story 1

- [ ] T050 [P] [US1] Create auth API client with axios in service/dashboard-service/frontend/src/services/auth.js
- [ ] T051 [P] [US1] Create RegistrationForm component with email password fields and real-time password strength feedback in service/dashboard-service/frontend/src/components/auth/RegistrationForm.jsx
- [ ] T052 [P] [US1] Create Registration page component in service/dashboard-service/frontend/src/pages/Register.jsx
- [ ] T053 [US1] Add WCAG 2.1 Level AA compliant form validation error messages to RegistrationForm in service/dashboard-service/frontend/src/components/auth/RegistrationForm.jsx
- [ ] T054 [US1] Integrate registration page with React Router in service/dashboard-service/frontend/src/main.jsx

### Testing for User Story 1

- [ ] T055 [US1] Test registration flow manually using quickstart.md curl commands
- [ ] T056 [US1] Test email verification flow using quickstart.md instructions

**Checkpoint**: User Story 1 complete - new users can register and verify accounts

---

## Phase 4: User Story 2 - Email/Password Login with Remember Me (Priority: P1)

**Goal**: Enable registered users to log in with optional persistent sessions

**Independent Test**: A registered user can navigate to login page, enter credentials optionally check remember me, submit, be granted access, and session persists across browser restarts

### Models for User Story 2

- [X] T057 [US2] Add session management methods to UserSession model (create, validate, expire, terminate) in service/auth-service/app/models/user_session.py

### Services for User Story 2

- [X] T058 [US2] Implement password verification logic in service/auth-service/app/services/auth_service.py
- [X] T059 [US2] Implement JWT access token generation (15-minute expiry) in service/auth-service/app/services/auth_service.py
- [X] T060 [US2] Implement refresh token generation and rotation logic in service/auth-service/app/services/session_service.py
- [X] T061 [US2] Implement session creation with remember_me flag (30 days if true, session-only if false) in service/auth-service/app/services/session_service.py
- [X] T062 [US2] Implement concurrent session limit enforcement (max 5 sessions, terminate oldest inactive on 6th) in service/auth-service/app/services/session_service.py
- [X] T063 [US2] Implement failed login attempt tracking and account lockout logic in service/auth-service/app/services/auth_service.py
- [X] T064 [US2] Implement session validation middleware with Redis cache in service/auth-service/app/services/session_service.py

### Endpoints for User Story 2

- [X] T065 [US2] Implement POST /auth/login endpoint (validates credentials, creates session, sets HTTP-only cookie) in service/auth-service/app/api/v1/endpoints/auth.py
- [X] T066 [US2] Implement POST /auth/logout endpoint (invalidates session, clears cookie) in service/auth-service/app/api/v1/endpoints/auth.py
- [X] T067 [US2] Implement GET /auth/sessions endpoint (lists active sessions) in service/auth-service/app/api/v1/endpoints/session.py
- [X] T068 [US2] Implement DELETE /auth/sessions endpoint (terminates specific session) in service/auth-service/app/api/v1/endpoints/session.py

### Frontend for User Story 2

- [X] T069 [P] [US2] Create auth API client with axios in service/frontend/src/services/auth.js
- [X] T070 [P] [US2] Create LoginForm component with email password remember-me checkbox in service/frontend/src/components/auth/LoginForm.jsx
- [X] T071 [P] [US2] Create Login page component in service/frontend/src/components/LoginView.jsx
- [X] T072 [P] [US2] Create SessionManager component for viewing and terminating active sessions in service/frontend/src/components/auth/SessionManager.jsx
- [X] T073 [US2] Add JWT authentication middleware to frontend in service/frontend/src/middleware/auth.js
- [X] T074 [US2] Add protected route wrapper component for frontend in service/frontend/src/components/auth/ProtectedRoute.jsx
- [X] T075 [US2] Integrate login page with React Router in service/frontend/src/main-auth.jsx
- [X] T076 [US2] Add WCAG 2.1 Level AA compliant form labels and error messages to LoginForm in service/frontend/src/components/auth/LoginForm.jsx

### Testing for User Story 2

- [X] T076 [US2] Test login flow manually using quickstart.md curl commands
- [X] T077 [US2] Test remember_me functionality by checking cookie persistence in browser DevTools
- [X] T078 [US2] Test concurrent session limit (log in from 6th device, verify oldest session terminated)

**Checkpoint**: User Stories 1 AND 2 complete - users can register, verify, and log in

---

## Phase 5: User Story 3 - MFA Setup and Usage (Priority: P2)

**Goal**: Enable users to add TOTP-based multi-factor authentication

**Independent Test**: A logged-in user can navigate to security settings, enable MFA, scan QR code, enter verification code, and MFA is required on subsequent logins

### Models for User Story 3

- [X] T079 [US3] Add MFA secret generation and hashing methods to MFASecret model in service/auth-service/app/models/mfa_secret.py
- [X] T080 [US3] Add backup code generation and hashing methods to RecoveryCode model in service/auth-service/app/models/recovery_code.py

### Services for User Story 3

- [X] T081 [US3] Implement TOTP secret generation (160-bit random, Base32 encoded) in service/auth-service/app/services/mfa_service.py
- [X] T082 [US3] Implement QR code generation (otpauth URI format, data URI for display) in service/auth-service/app/services/mfa_service.py
- [X] T083 [US3] Implement backup code generation (10 random 8-character codes, bcrypt hashed) in service/auth-service/app/services/mfa_service.py
- [X] T084 [US3] Implement TOTP code validation with 30-second window and ±1 step skew tolerance in service/auth-service/app/services/mfa_service.py
- [X] T085 [US3] Implement backup code validation and single-use enforcement in service/auth-service/app/services/mfa_service.py
- [X] T086 [US3] Implement MFA enable logic (verify TOTP code, mark enabled, store backup codes) in service/auth-service/app/services/mfa_service.py
- [X] T087 [US3] Implement MFA disable logic (require password confirmation, delete backup codes) in service/auth-service/app/services/mfa_service.py

### Endpoints for User Story 3

- [X] T088 [US3] Implement POST /auth/mfa/setup endpoint (generates secret, QR code, backup codes) in service/auth-service/app/api/v1/endpoints/mfa.py
- [X] T089 [US3] Implement POST /auth/mfa/enable endpoint (verifies TOTP, enables MFA) in service/auth-service/app/api/v1/endpoints/mfa.py
- [X] T090 [US3] Implement POST /auth/mfa/disable endpoint (requires password, disables MFA) in service/auth-service/app/api/v1/endpoints/mfa.py
- [X] T091 [US3] Implement POST /auth/mfa/verify endpoint (validates TOTP or backup code during login) in service/auth-service/app/api/v1/endpoints/mfa.py
- [X] T092 [US3] Update POST /auth/login endpoint to return mfa_required flag and prompt for MFA verification in service/auth-service/app/api/v1/endpoints/auth.py

### Frontend for User Story 3

- [X] T093 [P] [US3] Create MFASetup component with QR code display and backup codes in service/frontend/src/components/auth/MFASetup.jsx
- [X] T094 [P] [US3] Create MFALogin component for entering 6-digit TOTP or 8-character backup code in service/frontend/src/components/auth/MFALogin.jsx
- [X] T095 [P] [US3] Create SecuritySettings page with MFA enable/disable controls in service/frontend/src/components/auth/SecuritySettings.jsx
- [X] T096 [US3] Update LoginForm to handle MFA requirement and redirect to MFALogin in service/frontend/src/components/auth/LoginForm.jsx
- [X] T097 [US3] Add WCAG 2.1 Level AA compliant QR code alt text and backup code display in MFASetup component in service/frontend/src/components/auth/MFASetup.jsx

### Testing for User Story 3

- [ ] T098 [US3] Test MFA setup flow manually using Google Authenticator app
- [ ] T099 [US3] Test MFA login flow with TOTP code
- [ ] T100 [US3] Test backup code recovery flow
- [ ] T101 [US3] Test MFA disable flow

**Checkpoint**: User Stories 1, 2, AND 3 complete - users can register, log in, and enable MFA

---

## Phase 6: User Story 4 - Password Reset (Priority: P2)

**Goal**: Enable users to reset forgotten passwords via email

**Independent Test**: A user can click forgot password, enter email, receive reset email, click link, create new password, and log in with new password

### Services for User Story 4

- [X] T102 [US4] Implement password reset token generation (SHA256 hashed, 1-hour expiry) in service/auth-service/app/services/auth_service.py
- [X] T103 [US4] Implement password reset token validation logic in service/auth-service/app/services/auth_service.py
- [X] T104 [US4] Implement password change logic with validation (new password meets strength requirements) in service/auth-service/app/services/auth_service.py
- [X] T105 [US4] Implement password change invalidates all user sessions security measure in service/auth-service/app/services/auth_service.py

### Endpoints for User Story 4

- [X] T106 [US4] Implement POST /auth/password/reset endpoint (queues reset email) in service/auth-service/app/api/v1/endpoints/password.py
- [X] T107 [US4] Implement POST /auth/password/reset/confirm endpoint (validates token, updates password) in service/auth-service/app/api/v1/endpoints/password.py
- [X] T108 [US4] Implement POST /auth/password/change endpoint (requires current password, updates password) in service/auth-service/app/api/v1/endpoints/password.py

### Frontend for User Story 4

- [X] T109 [P] [US4] Create PasswordResetForm component for requesting reset in service/frontend/src/components/auth/PasswordResetForm.jsx
- [X] T110 [P] [US4] Create PasswordResetConfirm component for entering new password in service/frontend/src/components/auth/PasswordResetConfirm.jsx
- [X] T111 [P] [US4] Create PasswordReset page component in service/frontend/src/pages/PasswordReset.jsx
- [X] T112 [US4] Add forgot password link to LoginForm component in service/frontend/src/components/auth/LoginForm.jsx
- [X] T113 [US4] Add WCAG 2.1 Level AA compliant password strength feedback to PasswordResetConfirm in service/frontend/src/components/auth/PasswordResetConfirm.jsx

### Testing for User Story 4

- [ ] T114 [US4] Test password reset flow manually using quickstart.md instructions
- [ ] T115 [US4] Test expired reset token rejection
- [ ] T116 [US4] Test password change invalidates all sessions

**Checkpoint**: User Stories 1, 2, 3, AND 4 complete - full authentication lifecycle working

---

## Phase 7: User Story 5 - Account Suspension and Recovery (Priority: P3)

**Goal**: Enable administrators to suspend and reactivate user accounts

**Independent Test**: An administrator can navigate to user management dashboard, suspend a user with reason, user receives email, suspended user cannot log in, administrator can reactivate

### Models for User Story 5

- [X] T117 [US5] Add suspension methods to UserAccount model (suspend, reactivate, check status) in service/auth-service/app/models/user_account.py

### Services for User Story 5

- [X] T118 [US5] Implement account suspension logic (updates status, records reason, sends email) in service/auth-service/app/services/admin_service.py
- [X] T119 [US5] Implement account reactivation logic (updates status, sends confirmation email) in service/auth-service/app/services/admin_service.py
- [X] T120 [US5] Implement suspension check during login in service/auth-service/app/services/admin_service.py

### Endpoints for User Story 5

- [X] T121 [US5] Implement POST /admin/users/{user_id}/suspend endpoint (admin only) in service/auth-service/app/api/v1/endpoints/admin.py
- [X] T122 [US5] Implement POST /admin/users/{user_id}/reactivate endpoint (admin only) in service/auth-service/app/api/v1/endpoints/admin.py
- [X] T123 [US5] Add admin role check middleware in service/auth-service/app/middleware/admin.py
- [X] T124 [US5] Update POST /auth/login endpoint to check account status and return appropriate error for suspended accounts in service/auth-service/app/api/v1/endpoints/auth.py

### Frontend for User Story 5

- [X] T125 [P] [US5] Create UserManagement component with user list and suspend/reactivate controls in service/frontend/src/components/admin/UserManagement.jsx
- [X] T126 [US5] Create admin page route and integrate UserManagement component in service/frontend/src/pages/Admin.jsx
- [X] T127 [US5] Update LoginForm to display suspension message with support contact info in service/frontend/src/components/auth/LoginForm.jsx
- [X] T128 [US5] Add WCAG 2.1 Level AA compliant admin controls and status indicators to UserManagement in service/frontend/src/components/admin/UserManagement.jsx

### Testing for User Story 5

- [ ] T129 [US5] Test account suspension flow manually
- [ ] T130 [US5] Test suspended user login rejection
- [ ] T131 [US5] Test account reactivation flow

**Checkpoint**: ALL user stories complete - full authentication system with admin controls

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories and production readiness

### Security Hardening

- [X] T132 [P] Add rate limiting to all authentication endpoints (login, register, password reset) in service/auth-service/app/api/v1/endpoints/
- [X] T133 [P] Add security headers (HSTS, X-Content-Type-Options, X-Frame-Options, CSP) in service/auth-service/app/main.py
- [X] T134 [P] Add audit logging for all security events (login_success, login_failure, mfa_enabled, mfa_disabled, password_reset, account_suspended, account_reactivated, session_created, session_terminated, rate_limit_exceeded) in service/auth-service/app/services/audit_service.py
- [X] T135 [P] Implement audit log cleanup job registration (Celery Beat daily schedule) in service/auth-service/app/tasks/maintenance_tasks.py

### Frontend Polish

- [X] T136 [P] Add loading states to all auth forms during API calls in service/dashboard-service/frontend/src/components/auth/
- [X] T137 [P] Add error boundary component for auth pages in service/dashboard-service/frontend/src/components/ErrorBoundary.jsx
- [X] T138 [P] Ensure all auth forms follow IBM Carbon design system (0px border-radius, IBM Blue 60 #0f62fe, IBM Plex Sans) per DESIGN.md in service/dashboard-service/frontend/src/components/auth/

### Documentation

- [X] T139 Update README.md with authentication service setup instructions in README.md
- [X] T140 Update quickstart.md with any additional troubleshooting steps discovered during implementation in specs/001-user-auth-mfa/quickstart.md
- [X] T141 Update CLAUDE.md with authentication service architecture details in CLAUDE.md

### Deployment

- [X] T142 Create environment variable documentation for production deployment in service/auth-service/.env.production.example
- [X] T143 Update docker-compose.yml to add Celery worker for email queue and maintenance jobs in docker-compose/docker-compose.yml
- [X] T144 Create production build configuration for auth-service in service/auth-service/Dockerfile.prod

### Accessibility Validation

- [X] T145 Run automated accessibility tests (axe-core) on all auth pages and verify WCAG 2.1 Level AA compliance
- [X] T146 Test keyboard navigation on all auth forms (Tab, Enter, Space, Escape)
- [X] T147 Test screen reader compatibility (NVDA, VoiceOver) on all auth pages

### Performance Validation

- [X] T148 Test 500 concurrent login attempts using quickstart.md load testing instructions
- [X] T149 Verify email queue processes 100 emails/minute using Celery worker metrics
- [X] T150 Verify session validation <100ms using Redis cache metrics

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3-7)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Phase 8)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1) - Registration**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P1) - Login**: Can start after Foundational (Phase 2) - Integrates with US1 accounts but independently testable
- **User Story 3 (P2) - MFA**: Can start after Foundational (Phase 2) - Integrates with US1/US2 but independently testable
- **User Story 4 (P2) - Password Reset**: Can start after Foundational (Phase 2) - Integrates with US1 accounts but independently testable
- **User Story 5 (P3) - Account Suspension**: Can start after Foundational (Phase 2) - Integrates with US1/US2 but independently testable

### Within Each User Story

- Models before services
- Services before endpoints
- Frontend components after endpoints
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational ORM models (T021-T026) can run in parallel
- All Foundational Pydantic schemas (T034-T037) can run in parallel
- All email templates (T031) can run in parallel
- All maintenance jobs (T039-T040) can run in parallel
- Within each user story, frontend components marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all ORM models for User Story 1 together:
Task T041: Add email validation to UserAccount model

# Launch frontend components for User Story 1 together:
Task T050: Create auth API client
Task T051: Create RegistrationForm component
Task T052: Create Registration page component
```

---

## Implementation Strategy

### MVP First (User Stories 1 & 2 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 - Registration
4. Complete Phase 4: User Story 2 - Login
5. **STOP and VALIDATE**: Test registration and login flows independently
6. Deploy/demo MVP (users can register and log in)

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 (Registration) → Test independently → Deploy/Demo (MVP milestone 1!)
3. Add User Story 2 (Login) → Test independently → Deploy/Demo (MVP milestone 2!)
4. Add User Story 3 (MFA) → Test independently → Deploy/Demo (Security enhancement!)
5. Add User Story 4 (Password Reset) → Test independently → Deploy/Demo (Self-service improvement!)
6. Add User Story 5 (Account Suspension) → Test independently → Deploy/Demo (Admin controls!)
7. Add Polish phase → Production ready!

Each story adds value without breaking previous stories.

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1 (Registration)
   - Developer B: User Story 2 (Login)
   - Developer C: User Story 3 (MFA) - can start after US1 creates accounts
3. Stories complete and integrate independently

---

## Summary

**Total Tasks**: 150

**Task Count per User Story**:
- Setup: 9 tasks
- Foundational: 31 tasks
- User Story 1 (Registration): 16 tasks
- User Story 2 (Login): 18 tasks
- User Story 3 (MFA): 23 tasks
- User Story 4 (Password Reset): 12 tasks
- User Story 5 (Account Suspension): 14 tasks
- Polish: 18 tasks

**Parallel Opportunities Identified**:
- Setup phase: 6 parallel tasks
- Foundational phase: 15 parallel tasks (models, schemas, templates)
- User Story 1: 2 parallel tasks (frontend)
- User Story 2: 3 parallel tasks (frontend)
- User Story 3: 2 parallel tasks (frontend)
- User Story 4: 3 parallel tasks (frontend)
- User Story 5: 2 parallel tasks (frontend)
- Polish phase: 7 parallel tasks

**Independent Test Criteria**:
- US1: User can register → receive email → verify account → log in
- US2: User can log in → session persists → manage sessions → logout
- US3: User can enable MFA → scan QR code → verify code → MFA required on login
- US4: User can request reset → receive email → reset password → log in with new password
- US5: Admin can suspend user → user cannot log in → admin can reactivate

**Suggested MVP Scope**: User Stories 1 (Registration) + 2 (Login) = P1 priority stories covering core authentication functionality

**Format Validation**: ✅ ALL tasks follow required checklist format:
- Checkbox: `- [ ]` ✓
- Task ID: Sequential (T001-T150) ✓
- [P] markers: Applied to parallelizable tasks ✓
- [Story] labels: Applied to all user story phase tasks ✓
- File paths: Included in all task descriptions ✓
