# Security Tools Integration Guide

This document describes the security scanning tools integrated into the Claude Code Test Runner project.

## Tools

### SonarQube (SAST)
- **Purpose**: Static Application Security Testing and code quality analysis
- **Access**: http://localhost:9000 or http://localhost:8080/sonarqube/
- **Default Credentials**: admin / admin (change immediately)

### OWASP ZAP (DAST)
- **Purpose**: Dynamic Application Security Testing
- **Access**: http://localhost:9080 or http://localhost:8080/zap/
- **API Key**: Configured in .env file

## Prerequisites

### Linux Kernel Parameters
SonarQube requires increased virtual memory mapping:

```bash
# Set vm.max_map_count (required for SonarQube)
sysctl -w vm.max_map_count=262144

# Make permanent
echo "vm.max_map_count=262144" | sudo tee -a /etc/sysctl.conf
```

### Environment Configuration
Copy and configure environment variables:

```bash
cd service
cp .env.example .env
# Edit .env with your configuration
```

## Usage

### Starting Security Tools

#### Start All Services (including SonarQube)
```bash
cd service
docker-compose up -d
```

#### Start Security Tools Only
```bash
cd service
docker-compose up -d sonarqube
```

#### Start OWASP ZAP (on-demand)
```bash
cd service
docker-compose --profile security up -d zap
```

### Running Scans

#### Manual SonarQube Scan (Backend)
```bash
cd service/backend
sonar-scanner \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.login=admin \
  -Dsonar.password=admin
```

#### Manual SonarQube Scan (CLI)
```bash
cd cli
sonar-scanner \
  -Dsonar.host.url=http://localhost:9000 \
  -Dsonar.login=admin \
  -Dsonar.password=admin
```

#### OWASP ZAP Scan
```bash
# Start ZAP if not running
docker-compose --profile security up -d zap

# Run spider scan
docker-compose exec zap zap-cli spider http://backend:8001/api/v1/

# Run active scan
docker-compose exec zap zap-cli active-scan -r http://backend:8001/api/v1/

# Generate report
docker-compose exec zap zap-cli report -o /zap/wrk/report.html -f html
```

## CI/CD Integration

Security scans run automatically on:
- Push to `main` or `develop` branches
- Pull requests to `main` or `develop`
- Manual trigger via GitHub Actions

### Required Secrets

Configure these in GitHub repository settings:

1. **SONAR_TOKEN**: SonarQube authentication token
   - Generate at: http://localhost:9000/account/security
   - Settings → Secrets → New secret → SONAR_TOKEN

2. **SONAR_HOST_URL**: SonarQube server URL
   - For local: http://localhost:9000
   - For production: https://sonarqube.example.com

## Configuration

### SonarQube Project Keys
- Backend: `claude-code-test-runner:backend`
- CLI: `claude-code-test-runner:cli`

### Quality Gates
- Enabled for both projects
- Blocks merge on critical vulnerabilities
- 300-second timeout

### ZAP Scan Rules
Configured in `service/zap/zap.yaml`:
- Max spider duration: 60 seconds
- Max scan duration: 120 seconds
- Excludes low-risk informational alerts

## Troubleshooting

### SonarQube Won't Start
```bash
# Check kernel parameter
sysctl vm.max_map_count

# Check logs
docker-compose logs sonarqube
docker-compose logs sonarqube-db

# Verify database connection
docker-compose exec sonarqube-db psql -U sonarqube -d sonarqube
```

### ZAP Scan Fails
```bash
# Check if service is running
docker-compose ps zap

# View logs
docker-compose logs zap

# Restart ZAP
docker-compose restart zap
```

### Nginx Proxy Issues
```bash
# Validate configuration
docker-compose exec nginx nginx -t

# Reload nginx
docker-compose exec nginx nginx -s reload

# Check logs
docker-compose logs nginx
```

## Security Best Practices

1. **Change Default Passwords**: Update SonarQube admin password immediately
2. **Use Strong API Keys**: Generate random ZAP API keys
3. **Limit Exposure**: Keep security tools on internal networks
4. **Regular Updates**: Keep SonarQube and ZAP images updated
5. **Review Alerts**: Address critical security findings promptly

## Data Persistence

Security tool data is stored in Docker volumes:
- `sonarqube_db_data`: SonarQube database
- `sonarqube_data`: SonarQube application data
- `sonarqube_extensions`: Installed plugins
- `sonarqube_logs`: Application logs
- `zap_data`: ZAP scan data and reports

### Backup Data
```bash
# Backup SonarQube
docker run --rm \
  -v cc-test_sonarqube_data:/data \
  -v $(pwd)/backup:/backup \
  alpine tar czf /backup/sonarqube-data-$(date +%Y%m%d).tar.gz -C /data .

# Backup ZAP
docker run --rm \
  -v cc-test_zap_data:/data \
  -v $(pwd)/backup:/backup \
  alpine tar czf /backup/zap-data-$(date +%Y%m%d).tar.gz -C /data .
```

## Resources

- [SonarQube Documentation](https://docs.sonarsource.com/sonarqube/latest/)
- [OWASP ZAP Documentation](https://www.zaproxy.org/docs/)
- [Docker Compose Reference](https://docs.docker.com/compose/)
