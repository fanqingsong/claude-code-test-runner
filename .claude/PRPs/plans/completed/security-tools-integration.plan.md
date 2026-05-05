# Plan: Security Tools Integration - SonarQube & OWASP ZAP

## Summary
Integrate SonarQube (static code analysis/SAST) and OWASP ZAP (dynamic application security testing) as Docker container services into the existing microservices architecture. This will provide continuous security scanning, code quality metrics, and automated vulnerability detection for the Claude Code Test Runner platform.

## User Story
As a DevOps engineer, I want automated security scanning and code quality analysis integrated into the CI/CD pipeline, so that security vulnerabilities and code quality issues are detected early and continuously monitored.

## Problem → Solution
**Current State**: No automated security scanning or code quality analysis. Security vulnerabilities and code quality issues are only discovered during manual reviews or production incidents.

**Desired State**: Automated SAST (SonarQube) and DAST (OWASP ZAP) scanning integrated into the development workflow, providing continuous security monitoring and code quality metrics with dashboard visualization.

## Metadata
- **Complexity**: Medium
- **Source PRD**: N/A (standalone feature request)
- **PRD Phase**: N/A
- **Estimated Files**: 12 files
- **Estimated Implementation Time**: 4-6 hours

---

## UX Design

### Before
```
┌─────────────────────────────────────┐
│  Developer pushes code              │
│           ↓                         │
│  CI/CD builds & tests               │
│           ↓                         │
│  Deploy to production               │
│           ↓                         │
│  Security incident occurs ❌        │
└─────────────────────────────────────┘
```

### After
```
┌─────────────────────────────────────┐
│  Developer pushes code              │
│           ↓                         │
│  CI/CD builds & tests               │
│           ↓                         │
│  SonarQube scans (SAST)             │
│           ↓                         │
│  OWASP ZAP scans (DAST)             │
│           ↓                         │
│  Quality gate checks ✓              │
│           ↓                         │
│  Deploy to production               │
│           ↓                         │
│  Monitor security dashboards        │
└─────────────────────────────────────┘
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| CI/CD Pipeline | Build → Test → Deploy | Build → Test → SonarQube Scan → ZAP Scan → Quality Gate → Deploy | Security gates prevent vulnerable code deployment |
| Development Workflow | Manual code reviews | Automated quality metrics + security reports | Developers get immediate feedback |
| Monitoring | Application metrics only | Application + Security + Code Quality metrics | Comprehensive observability |
| Dashboard | Test results only | Test results + Security findings + Code quality | Unified view in security section |

---

## Mandatory Reading

Files that MUST be read before implementing:

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 (critical) | `service/docker-compose.yml` | All | Understanding existing service architecture, networking, and volume patterns |
| P0 (critical) | `service/.env` | All | Environment variable pattern for service configuration |
| P1 (important) | `service/backend/Dockerfile` | All | Understanding multi-stage build and health check patterns |
| P1 (important) | `.github/workflows/build-and-publish.yml` | All | CI/CD workflow patterns for integrating security scans |
| P2 (reference) | `service/nginx/nginx.conf` | All | Reverse proxy configuration patterns for exposing security tools |

## External Documentation

| Topic | Source | Key Takeaway |
|---|---|---|
| SonarQube Docker Setup | https://docs.sonarsource.com/sonarqube/latest/setup/install-server/ | Requires PostgreSQL, community edition supports up to 100k LOC |
| OWASP ZAP Docker | https://www.zaproxy.org/docs/docker/ | Headless mode for CI/CD, API for automated scanning |
| SonarQube Scanners | https://docs.sonarsource.com/sonarqube/latest/analysis/scan/sonarscanner/ | Separate scanners for different languages (Python, JavaScript) |
| ZAP API Basics | https://www.zaproxy.org/docs/api/ | REST API for spider, scan, and report generation |

---

## Patterns to Mirror

Code patterns discovered in the codebase. Follow these exactly.

### DOCKER_COMPOSE_SERVICE_PATTERN
// SOURCE: service/docker-compose.yml:2-23
```yaml
postgres:
  image: postgres:15-alpine
  container_name: cc-test-postgres
  environment:
    POSTGRES_DB: ${POSTGRES_DB}
    POSTGRES_USER: ${POSTGRES_USER}
    POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  volumes:
    - postgres_data:/var/lib/postgresql/data
  ports:
    - "5433:5432"
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
    interval: 10s
    timeout: 5s
    retries: 5
  networks:
    - test-network
  restart: unless-stopped
```

### ENVIRONMENT_VARIABLE_PATTERN
// SOURCE: service/.env:1-4
```bash
# Service-specific configuration
POSTGRES_DB=cc_test_db
POSTGRES_USER=cc_test_user
POSTGRES_PASSWORD=test_password_123
```

### HEALTHCHECK_PATTERN
// SOURCE: service/backend/Dockerfile:61-62
```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8001/health')"
```

### NETWORK_PATTERN
// SOURCE: service/docker-compose.yml:214-216
```yaml
networks:
  test-network:
    driver: bridge
```

### VOLUME_PATTERN
// SOURCE: service/docker-compose.yml:209-212
```yaml
volumes:
  postgres_data:
  redis_data:
  casdoor_postgres_data:
```

### DEPENDS_ON_PATTERN
// SOURCE: service/docker-compose.yml:86-90
```yaml
depends_on:
  postgres:
    condition: service_healthy
  redis:
    condition: service_healthy
```

---

## Files to Change

| File | Action | Justification |
|---|---|---| New SonarQube service definition |
| `service/docker-compose.yml` | UPDATE | Add SonarQube service, network, and volume |
| `service/docker-compose.yml` | UPDATE | Add OWASP ZAP service (conditional for CI/CD) |
| `service/.env` | UPDATE | Add SonarQube and ZAP configuration variables |
| `service/nginx/nginx.conf` | UPDATE | Add reverse proxy routes for /sonarqube and /zap |
| `.github/workflows/build-and-publish.yml` | UPDATE | Add SonarQube scan step before build |
| `.github/workflows/security-scan.yml` | CREATE | Dedicated workflow for security scanning |
| `service/backend/sonar-project.properties` | CREATE | SonarQube project configuration for Python backend |
| `cli/sonar-project.properties` | CREATE | SonarQube project configuration for TypeScript CLI |
| `service/zap/zap.yaml` | CREATE | OWASP ZAP configuration file |
| `service/zap/spider-scan.js` | CREATE | ZAP spider script for API discovery |
| `service/zap/scripts/report-html.py` | CREATE | ZAP report generation script |

## NOT Building

- SonarQube enterprise edition features (security hotspots, code coverage)
- Automated remediation of security issues
- Integration with external issue trackers (Jira, GitHub Issues)
- Real-time alerting/notifications for security issues
- Authentication/SSO for security dashboards (exposed internally only)
- Persistent vulnerability database (using SonarQube/ZAP embedded storage)

---

## Step-by-Step Tasks

### Task 1: Add SonarQube Service to Docker Compose
- **ACTION**: Add SonarQube service with PostgreSQL database to docker-compose.yml
- **IMPLEMENT**: Add sonarqube-db (PostgreSQL) and sonarqube services following existing postgres pattern
- **MIRROR**: DOCKER_COMPOSE_SERVICE_PATTERN, DEPENDS_ON_PATTERN
- **IMPORTS**: N/A (YAML configuration)
- **GOTCHA**: SonarQube requires specific vm.max_map_count kernel parameter (document in setup instructions)
- **VALIDATE**: `docker-compose config` validates YAML syntax, `docker-compose up sonarqube` starts successfully

### Task 2: Add OWASP ZAP Service to Docker Compose
- **ACTION**: Add OWASP ZAP service for on-demand DAST scanning
- **IMPLEMENT**: Add zap service using stable OWASP/ZAP image, configure for daemon mode
- **MIRROR**: DOCKER_COMPOSE_SERVICE_PATTERN
- **IMPORTS**: N/A (YAML configuration)
- **GOTCHA**: ZAP should not auto-start with compose (add profile: security) - only run during security scans
- **VALIDATE**: `docker-compose --profile security up zap` starts ZAP daemon

### Task 3: Configure Environment Variables
- **ACTION**: Add SonarQube and ZAP configuration to .env
- **IMPLEMENT**: Add SONARQUBE_JDBC_URL, SONARQUBE_ADMIN_PASSWORD, ZAP_PORT, ZAP_API_KEY
- **MIRROR**: ENVIRONMENT_VARIABLE_PATTERN
- **IMPORTS**: N/A (environment configuration)
- **GOTCHA**: Use strong random passwords in production (document in .env.example)
- **VALIDATE**: Source .env file without errors, variables are accessible in shell

### Task 4: Create SonarQube Configuration Files
- **ACTION**: Create sonar-project.properties for Python backend and TypeScript CLI
- **IMPLEMENT**: Configure project keys, source paths, exclusions, and quality gate settings
- **MIRROR**: N/A (new configuration files, follow SonarQube documentation)
- **IMPORTS**: N/A (SonarQube configuration format)
- **GOTCHA**: Ensure correct relative paths for source code directories
- **VALIDATE**: `sonar-scanner --help` runs successfully, config file syntax is valid

### Task 5: Configure Nginx Reverse Proxy
- **ACTION**: Add routes for /sonarqube and /zap in nginx.conf
- **IMPLEMENT**: Add location blocks proxying to sonarqube:9000 and zap:8080
- **MIRROR**: N/A (follow nginx best practices, similar to existing backend routes)
- **IMPORTS**: N/A (nginx configuration format)
- **GOTCHA**: WebSocket support required for ZAP API, configure proxy_read_timeout
- **VALIDATE**: `nginx -t` validates configuration without errors

### Task 6: Create CI/CD Workflow for SonarQube Scanning
- **ACTION**: Add SonarQube scanner step to build-and-publish.yml workflow
- **IMPLEMENT**: Add step after checkout to install sonar-scanner and run analysis
- **MIRROR**: .github/workflows/build-and-publish.yml pattern (steps, uses actions)
- **IMPORTS**: uses: SonarSource/sonarqube-scan-action@master
- **GOTCHA**: Must pass SONAR_TOKEN and SONAR_HOST_URL as secrets
- **VALIDATE**: Workflow syntax validates with `act -l`, manual trigger succeeds

### Task 7: Create Dedicated Security Scan Workflow
- **ACTION**: Create security-scan.yml for comprehensive security scanning
- **IMPLEMENT**: Workflow that triggers on push/PR, runs SonarQube scan and ZAP DAST scan
- **MIRROR**: .github/workflows/build-and-publish.yml pattern (jobs, steps, permissions)
- **IMPORTS**: uses: actions/checkout@v4, owasp-zap/zap-scan-action
- **GOTCHA**: ZAP scan requires running application - use docker-compose to start services first
- **VALIDATE**: Workflow runs end-to-end, generates reports as artifacts

### Task 8: Create ZAP Configuration and Scripts
- **ACTION**: Create ZAP configuration, spider script, and report generation script
- **IMPLEMENT**: Configure zap.yaml for API discovery, create spider-scan.js for endpoint crawling
- **MIRROR**: N/A (follow ZAP documentation and script patterns)
- **IMPORTS**: N/A (ZAP script format)
- **GOTCHA**: Spider script must handle authentication if APIs are protected
- **VALIDATE**: ZAP daemon accepts configuration, spider script executes without errors

### Task 9: Add SonarQube Scanner to Backend Dockerfile
- **ACTION**: Install sonar-scanner in backend Docker image for on-demand scanning
- **IMPLEMENT**: Add RUN apt-get install && wget sonar-scanner install in Dockerfile
- **MIRROR**: service/backend/Dockerfile:7-41 (system dependencies installation pattern)
- **IMPORTS**: N/A (Dockerfile commands)
- **GOTCHA**: Sonar-scanner requires Java runtime, add to image
- **VALIDATE**: `docker-compose exec backend sonar-scanner --help` runs successfully

### Task 10: Create Security Dashboard Integration
- **ACTION**: Add security section to frontend dashboard
- **IMPLEMENT**: Create SecurityDashboard.jsx component with links to SonarQube and ZAP dashboards
- **MIRROR**: N/A (follow existing frontend component structure in service/frontend/src)
- **IMPORTS**: React, Link from react-router-dom
- **GOTCHA**: Use hash routing for consistency with existing frontend
- **VALIDATE**: Frontend compiles, security section is accessible via /#/security

### Task 11: Document Setup and Usage
- **ACTION**: Create SECURITY_TOOLS.md with setup instructions and usage guidelines
- **IMPLEMENT**: Document prerequisites, docker-compose commands, CI/CD integration, troubleshooting
- **MIRROR**: N/A (follow existing documentation style in CLAUDE.md, DEPLOYMENT.md)
- **IMPORTS**: N/A (Markdown documentation)
- **GOTCHA**: Include kernel parameter setup for SonarQube (vm.max_map_count=262144)
- **VALIDATE**: All commands in documentation are tested and work as described

### Task 12: Update Main README
- **ACTION**: Add security tools section to main README.md
- **IMPLEMENT**: Add architecture diagram update, quick start links, security badges
- **MIRROR**: N/A (follow existing README.md structure)
- **IMPORTS**: N/A (Markdown documentation)
- **GOTCHA**: Keep security badges separate from main CI/CD badges
- **VALIDATE**: README renders correctly, all links work

---

## Testing Strategy

### Unit Tests

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| SonarQube service startup | docker-compose up sonarqube | Service healthy on port 9000 | Database connection failure |
| ZAP service startup | docker-compose --profile security up zap | ZAP API accessible on port 8080 | Insufficient memory |
| Nginx proxy routing | curl http://localhost/sonarqube | SonarQube UI loads | WebSocket timeout |
| SonarQube scanner execution | sonar-scanner in backend | Analysis report uploaded | Invalid project key |
| ZAP scan execution | zap-cli quick-scan | HTML report generated | API authentication |

### Integration Tests

| Test | Scenario | Expected Result | Validation |
|---|---|---|---|
| CI/CD SonarQube scan | Push to main branch | SonarQube analysis runs, quality gate passes/fails | Check GitHub Actions logs |
| CI/CD ZAP scan | PR created | ZAP scans application, reports vulnerabilities | Download artifacts |
| Multi-service scan | Full stack running | SonarQube scans backend, ZAP scans APIs | Check dashboards |

### Edge Cases Checklist
- [ ] SonarQube database connection failure during startup
- [ ] Insufficient disk space for SonarQube data volume
- [ ] ZAP scan timeout on large applications
- [ ] Nginx proxy buffer overflow for large reports
- [ ] SonarQube scanner network timeout
- [ ] Concurrent ZAP scans causing port conflicts
- [ ] Memory exhaustion during ZAP spidering
- [ ] Authentication failures for protected APIs

---

## Validation Commands

### Static Analysis
```bash
# Validate docker-compose syntax
cd service && docker-compose config

# Validate nginx configuration
docker-compose exec nginx nginx -t

# Validate SonarQube properties
cat service/backend/sonar-project.properties | grep -E "^[a-z]"
```
EXPECT: Zero syntax errors, valid configuration files

### Service Health Checks
```bash
# Start security services
cd service && docker-compose up -d sonarqube
docker-compose --profile security up -d zap

# Check service health
docker-compose ps
curl -f http://localhost:9000/api/system/status  # SonarQube
curl -f http://localhost:9080/UI  # ZAP UI

# Check logs
docker-compose logs sonarqube
docker-compose logs zap
```
EXPECT: All services healthy, APIs accessible

### Scanner Validation
```bash
# Test SonarQube scanner in backend
docker-compose exec backend sonar-scanner --version

# Test ZAP CLI
docker-compose exec zap zap-cli -v

# Run manual SonarQube scan
cd service/backend && sonar-scanner -Dsonar.host.url=http://sonarqube:9000
```
EXPECT: Scanners execute successfully, reports generated

### CI/CD Workflow Validation
```bash
# Validate GitHub Actions workflow syntax
act -l .github/workflows/security-scan.yml

# Test workflow locally (requires act)
act -W .github/workflows/security-scan.yml --dryrun
```
EXPECT: Workflow syntax valid, steps execute in correct order

### Manual Validation
- [ ] Access SonarQube dashboard at http://localhost:9000 (default: admin/admin)
- [ ] Create SonarQube project and view quality gate
- [ ] Access ZAP dashboard at http://localhost:9080
- [ ] Run ZAP spider scan against backend API
- [ ] Trigger security scan workflow via GitHub Actions
- [ ] Download and review scan reports from workflow artifacts
- [ ] Verify security section in frontend dashboard
- [ ] Test nginx reverse proxy routes for /sonarqube and /zap

---

## Acceptance Criteria
- [ ] All 12 tasks completed
- [ ] SonarQube service starts successfully and is accessible via nginx proxy
- [ ] OWASP ZAP service starts in daemon mode and API is accessible
- [ ] SonarQube scanner analyzes Python backend and TypeScript CLI code
- [ ] ZAP performs DAST scans on running application
- [ ] CI/CD workflows execute security scans automatically
- [ ] Security dashboards are linked from frontend application
- [ ] Documentation is complete and accurate
- [ ] All validation commands pass
- [ ] No syntax errors in docker-compose or nginx configurations
- [ ] Services follow existing patterns (healthchecks, networks, volumes)

## Completion Checklist
- [ ] Code follows discovered docker-compose patterns
- [ ] Service configurations match existing service patterns
- [ ] Nginx configuration follows reverse proxy best practices
- [ ] CI/CD workflows follow existing GitHub Actions patterns
- [ ] No hardcoded credentials (use environment variables)
- [ ] Documentation updated (SECURITY_TOOLS.md, README.md)
- [ ] Security tools are optional (can run without core services)
- [ ] Services are properly isolated (profiles, dependencies)
- [ ] Health checks implemented for all new services
- [ ] Self-contained — no questions needed during implementation

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| SonarQube startup failure due to kernel parameters | Medium | High | Document vm.max_map_count requirement in setup instructions |
| ZAP scan causes application instability | Low | Medium | Configure scan rate limits, run during off-peak hours |
| SonarQube database volume corruption | Low | High | Implement regular volume backups, document recovery procedure |
| Nginx proxy WebSocket issues for ZAP | Medium | Low | Configure explicit WebSocket upgrade headers |
| CI/CD workflow timeout on large codebases | Medium | Medium | Configure appropriate timeout values, use incremental scans |
| Memory exhaustion during ZAP spidering | Low | Medium | Set ZAP memory limits in docker-compose, use spider depth limits |
| SonarQube license limitations (100k LOC) | Low | Low | Monitor LOC count, document upgrade path to enterprise edition |

## Notes
- SonarQube Community Edition is sufficient for current project size (~5k LOC)
- ZAP should be run conditionally (profile: security) to avoid resource consumption during normal development
- Consider adding SonarQube quality gate as a required check before merging to main branch
- Security scans should run in parallel with existing tests to minimize CI/CD pipeline duration
- Future enhancement: Integrate security findings into Jira/GitHub Issues for tracking
- Document the decision to use embedded databases for simplicity (can migrate to external databases if needed)
- Consider adding scheduled nightly security scans for comprehensive coverage
