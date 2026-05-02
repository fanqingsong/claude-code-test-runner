# Claude Code Test Runner - Project

**What This Is:** AI-powered E2E testing framework with natural language test definitions

**Last updated:** 2026-05-02 after initialization

## Core Value

Enable anyone to create and execute end-to-end tests using plain English descriptions. The system uses Claude's AI to understand test intent and performs browser automation via Playwright MCP.

## Context

### Target Users

- **QA Engineers:** Create comprehensive test suites without coding
- **Developers:** Quickly add E2E tests to CI/CD pipelines
- **Product Teams:** Validate user workflows in natural language

### What Problem It Solves

Traditional E2E testing requires:
- Writing/maintaining fragile selectors
- Programming knowledge (JavaScript, Python, etc.)
- Constant updates when UI changes
- Complex async handling

Claude Code Test Runner eliminates these by:
- Understanding natural language test steps
- Using AI to find elements robustly
- Self-healing when UI changes
- Handling async automatically

## Architecture

### Deployment Models

**1. CLI Tool (`cli/`)**
- Bun runtime
- Claude Code SDK + Anthropic API
- Playwright MCP for browser control
- Test State MCP for result tracking

**2. Microservices (`docker-compose/`)**
- Frontend: React/Vite dashboard
- Test Case API: FastAPI (:8001)
- Scheduler API: FastAPI (:8002)
- Dashboard Service: Express (:8003)
- PostgreSQL: Test results storage
- Redis: Celery task queue
- Nginx: Reverse proxy (:8080)

### Key Technologies

- **Frontend:** React, Vite, IBM Carbon Design System
- **Backend:** FastAPI (Python), Express (Node.js)
- **Database:** PostgreSQL
- **Queue:** Redis + Celery
- **Browser:** Playwright
- **AI:** Claude Code SDK + Anthropic API
- **Auth:** Casdoor SSO (newly implemented)

## Requirements

### Validated

- ✓ Natural language test definition execution
- ✓ CLI test runner with Playwright
- ✓ Microservices architecture
- ✓ PostgreSQL result storage
- ✓ Celery-based test scheduling
- ✓ Web dashboard for test results
- ✓ Hot-reload development environment
- ✓ Casdoor SSO authentication
- ✓ Role-based access control

### Active

- [ ] User management functionality (current goal)
- [ ] Team collaboration features
- [ ] Test result analytics
- [ ] Performance optimization

### Out of Scope

- Mobile testing (desktop browsers only)
- API testing (E2E UI focus)
- Load testing (functional testing only)
- Visual regression testing

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Casdoor SSO | Centralized auth for all services | Implemented |
| PostgreSQL | Complex query needs for analytics | In production |
| Celery workers | Scalable test execution | In production |
| IBM Carbon Design | Enterprise UI consistency | Migration in progress |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition:**
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted
