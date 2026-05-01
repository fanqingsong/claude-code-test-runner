---
status: testing
phase: auth-integration
source: [commit 601a8f7]
started: 2026-05-01T00:00:00Z
updated: 2026-05-01T00:00:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Verify all services start correctly after a clean docker-compose down.
  Run: docker-compose down
  Run: docker-compose up -d
  Expected: All containers (test-case-service, scheduler-service, dashboard-service, casdoor, postgres) start without errors.
  Check: docker-compose ps shows all services as "Up".
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: |
  Verify all services start correctly after a clean docker-compose down.
  Run: docker-compose down
  Run: docker-compose up -d
  Expected: All containers (test-case-service, scheduler-service, dashboard-service, casdoor, postgres) start without errors.
  Check: docker-compose ps shows all services as "Up".
result: pending

### 2. Local User Registration
expected: |
  Access http://localhost:8080 - should redirect to login page.
  Click "Local" tab.
  Register a new user with username/email/password.
  Expected: Registration succeeds, user is created in database, can login with credentials.
result: pending

### 3. Local Password Login
expected: |
  On login page, click "Local" tab.
  Login with admin/admin123 (existing admin user).
  Expected: Login succeeds, redirects to dashboard, user info displayed in header.
result: pending

### 4. Casdoor Password Login
expected: |
  On login page, click "Casdoor" tab.
  Login with Casdoor username/password.
  Expected: Login succeeds, redirects to dashboard, token stored from Casdoor.
result: pending

### 5. Casdoor OIDC/SSO Login
expected: |
  On login page, click "SSO" tab.
  Click "Login with SSO (Casdoor)" button.
  Expected: Redirects to Casdoor login page, after authentication redirects back to dashboard with valid token.
result: pending

### 6. Admin Role - View All Test Definitions
expected: |
  Login as admin user.
  Navigate to Test Management page.
  Expected: Admin user sees all test definitions in the system (including those created by other users).
  Header shows "👑 管理员模式 - 显示所有用户的测试用例".
result: pending

### 7. Regular User - View Own Test Definitions Only
expected: |
  Login as regular (non-admin) user.
  Navigate to Test Management page.
  Expected: User sees only test definitions they created (filtered by created_by).
  No admin badge displayed.
result: pending

### 8. Create Test Definition - User Association
expected: |
  Login as any user.
  Click "创建测试" button.
  Fill out form and submit.
  Expected: Test created successfully, created_by field set to current user's ID in database.
result: pending

### 9. Logout and Token Clearing
expected: |
  Login with any auth method.
  Click "退出登录" button.
  Expected: User logged out, tokens cleared from localStorage, redirected to login page.
  Subsequent API calls return 401 Unauthorized.
result: pending

### 10. Protected API - No Token
expected: |
  Logout (ensure no token).
  Access API endpoint directly: http://localhost:8080/api/v1/test-definitions/
  Expected: Returns 401 Unauthorized error.
result: pending

### 11. Token Refresh - Casdoor
expected: |
  Login via Casdoor (password or SSO).
  Wait for token to approach expiration (or manually expire).
  Trigger an API call.
  Expected: Token automatically refreshes using refresh_token, user remains authenticated.
result: pending

### 12. Schedule Management - Role-Based Access
expected: |
  Login as admin user.
  Navigate to Schedule Configuration page.
  Expected: Admin sees all schedules (system-wide).
  Login as regular user.
  Expected: Regular user sees only their own schedules.
result: pending

### 13. Dashboard Statistics - Role-Based Filtering
expected: |
  Login as admin.
  View dashboard stats cards.
  Expected: Statistics show data from all users (total tests, runs, etc.).
  Login as regular user.
  Expected: Statistics show only own data.
result: pending

## Summary

total: 13
passed: 0
issues: 0
pending: 13
skipped: 0

## Gaps

[none yet]
