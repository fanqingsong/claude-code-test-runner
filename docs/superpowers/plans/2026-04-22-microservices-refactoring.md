# Test Runner Microservices Refactoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有的单体CLI测试工具重构为基于微服务的架构，包含测试用例管理服务、测试执行调度服务和Dashboard展示服务，使用Docker Compose进行容器编排，PostgreSQL作为共享数据库。

**Architecture:** 三个微服务（测试用例管理FastAPI+React、测试调度FastAPI+Celery+Playwright、Dashboard Express.js）通过共享PostgreSQL数据库和HTTP通信，Nginx反向代理路由，Docker Compose统一管理。

**Tech Stack:** FastAPI (Python 3.11), SQLAlchemy 2.0, Celery 5.3, Redis 7, PostgreSQL 15, React 18, Playwright-Python, Docker Compose, Nginx

---

## Phase 1: 基础设施搭建 (1-2天)

### Task 1: 创建Docker Compose项目结构

**Files:**
- Create: `docker-compose/docker-compose.yml`
- Create: `docker-compose/docker-compose.dev.yml`
- Create: `docker-compose/.env.example`
- Create: `docker-compose/nginx/nginx.conf`

- [ ] **Step 1: 创建docker-compose目录结构**

Run: 
```bash
mkdir -p docker-compose/nginx
mkdir -p test-case-management
mkdir -p test-scheduler
```

- [ ] **Step 2: 创建环境变量模板文件**

Create: `docker-compose/.env.example`

```bash
# Database
POSTGRES_DB=claude_code_tests
POSTGRES_USER=testuser
POSTGRES_PASSWORD=testpass_change_this

# Security
SECRET_KEY=change-this-secret-key-in-production
ADMIN_PASSWORD=admin

# Redis
REDIS_PASSWORD=

# Environment
ENVIRONMENT=development
```

- [ ] **Step 3: 创建主docker-compose.yml文件**

Create: `docker-compose/docker-compose.yml`

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: cc-test-postgres
    environment:
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      PGDATA: /var/lib/postgresql/data/pgdata
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - test-network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: cc-test-redis
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5
    networks:
      - test-network
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:

networks:
  test-network:
    driver: bridge
```

- [ ] **Step 4: 创建Nginx配置文件**

Create: `docker-compose/nginx/nginx.conf`

```nginx
events {
    worker_connections 1024;
}

http {
    upstream test_case_management {
        server test-case-management:8000;
    }

    upstream test_scheduler {
        server test-scheduler:8000;
    }

    upstream test_dashboard {
        server test-dashboard:3000;
    }

    server {
        listen 80;
        server_name localhost;

        location /api/tests/ {
            proxy_pass http://test_case_management;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }

        location /api/runs/ {
            proxy_pass http://test_scheduler;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_http_version 1.1;
            proxy_set_header Connection "";
            proxy_buffering off;
            proxy_cache off;
        }

        location /api/dashboard/ {
            proxy_pass http://test_dashboard;
        }

        location / {
            proxy_pass http://test_dashboard;
        }

        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

- [ ] **Step 5: 测试基础服务启动**

Run:
```bash
cd docker-compose
docker-compose up -d postgres redis
docker-compose ps
```

Expected:
```bash
NAME                 STATUS          PORTS
cc-test-postgres     Up 30 seconds   0.0.0.0:5432->5432/tcp
cc-test-redis        Up 30 seconds   0.0.0.0:6379->6379/tcp
```

- [ ] **Step 6: 验证数据库和Redis连接**

Run:
```bash
docker exec cc-test-postgres pg_isready -U testuser
docker exec cc-test-redis redis-cli ping
```

Expected:
```bash
/var/run/postgresql/.s.PGSQL.5432: ok
PONG
```

- [ ] **Step 7: 停止服务**

Run:
```bash
cd docker-compose
docker-compose down
```

- [ ] **Step 8: 提交基础Docker Compose配置**

```bash
git add docker-compose/
git commit -m "feat: add Docker Compose infrastructure

- Add PostgreSQL and Redis services
- Add Nginx reverse proxy configuration
- Add environment variable template
- Add health checks and volume management

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 2: 创建PostgreSQL数据库Schema和迁移

**Files:**
- Create: `docker-compose/scripts/init-db.sql`
- Create: `docker-compose/scripts/migrate_sqlite_to_postgres.py`

- [ ] **Step 1: 创建数据库初始化SQL脚本**

Create: `docker-compose/scripts/init-db.sql`

```sql
-- Claude Code Tests Database Schema
-- This file is automatically run on PostgreSQL container initialization

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Test definitions table
CREATE TABLE IF NOT EXISTS test_definitions (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  test_id VARCHAR(100) UNIQUE NOT NULL,
  url VARCHAR(500),
  environment JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(100) DEFAULT 'system',
  version INTEGER DEFAULT 1,
  is_active BOOLEAN DEFAULT true
);

-- Test steps table
CREATE TABLE IF NOT EXISTS test_steps (
  id SERIAL PRIMARY KEY,
  test_definition_id INTEGER REFERENCES test_definitions(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  params JSONB NOT NULL,
  expected_result TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test versions table
CREATE TABLE IF NOT EXISTS test_versions (
  id SERIAL PRIMARY KEY,
  test_definition_id INTEGER REFERENCES test_definitions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  change_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(100) DEFAULT 'system'
);

-- Test runs table
CREATE TABLE IF NOT EXISTS test_runs (
  id SERIAL PRIMARY KEY,
  run_id VARCHAR(100) UNIQUE NOT NULL,
  test_definition_id INTEGER REFERENCES test_definitions(id),
  start_time BIGINT NOT NULL,
  end_time BIGINT,
  total_tests INTEGER DEFAULT 0,
  passed INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  skipped INTEGER DEFAULT 0,
  total_duration INTEGER DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  environment VARCHAR(100),
  triggered_by VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test cases table
CREATE TABLE IF NOT EXISTS test_cases (
  id SERIAL PRIMARY KEY,
  run_id INTEGER REFERENCES test_runs(id) ON DELETE CASCADE,
  test_definition_id INTEGER REFERENCES test_definitions(id),
  test_id VARCHAR(100) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL,
  duration INTEGER NOT NULL,
  start_time BIGINT NOT NULL,
  end_time BIGINT NOT NULL,
  error_message TEXT,
  screenshot_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test step results table
CREATE TABLE IF NOT EXISTS test_step_results (
  id SERIAL PRIMARY KEY,
  test_case_id INTEGER REFERENCES test_cases(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) NOT NULL,
  error_message TEXT,
  screenshot_path TEXT,
  duration INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Schedules table
CREATE TABLE IF NOT EXISTS schedules (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  test_definition_ids INTEGER[] NOT NULL,
  cron_expression VARCHAR(100) NOT NULL,
  environment VARCHAR(100) DEFAULT 'development',
  is_active BOOLEAN DEFAULT true,
  next_run_time TIMESTAMP WITH TIME ZONE,
  last_run_time TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(100) DEFAULT 'system'
);

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  secret VARCHAR(255),
  test_definition_ids INTEGER[],
  events TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_test_definitions_test_id ON test_definitions(test_id);
CREATE INDEX IF NOT EXISTS idx_test_definitions_tags ON test_definitions USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_test_runs_status ON test_runs(status);
CREATE INDEX IF NOT EXISTS idx_test_runs_start_time ON test_runs(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_test_cases_run_id ON test_cases(run_id);
CREATE INDEX IF NOT EXISTS idx_test_cases_test_definition ON test_cases(test_definition_id);
CREATE INDEX IF NOT EXISTS idx_schedules_next_run ON schedules(next_run_time) WHERE is_active = true;

-- Insert sample data
INSERT INTO test_definitions (name, test_id, description, url) VALUES
('Sample Login Test', 'sample-login-test', 'A sample test for login functionality', 'https://example.com/login')
ON CONFLICT (test_id) DO NOTHING;
```

- [ ] **Step 2: 更新docker-compose.yml以加载初始化脚本**

Modify: `docker-compose/docker-compose.yml`

Add to postgres service:
```yaml
postgres:
  volumes:
    - postgres_data:/var/lib/postgresql/data
    - ./scripts/init-db.sql:/docker-entrypoint-initdb.d/init.sql:ro
```

- [ ] **Step 3: 启动PostgreSQL并验证schema创建**

Run:
```bash
cd docker-compose
docker-compose up -d postgres
sleep 5
docker exec cc-test-postgres psql -U testuser -d claude_code_tests -c "\dt"
```

Expected:
```bash
          List of relations
 Schema |        Name        | Type  |  Owner   
--------+--------------------+-------+----------
 public | test_cases        | table | testuser
 public | test_definitions  | table | testuser
 public | test_runs         | table | testuser
 public | test_step_results | table | testuser
 public | test_steps        | table | testuser
 public | test_versions     | table | testuser
 public | webhooks          | table | testuser
 public | schedules         | table | testuser
```

- [ ] **Step 4: 验证sample数据插入**

Run:
```bash
docker exec cc-test-postgres psql -U testuser -d claude_code_tests -c "SELECT * FROM test_definitions;"
```

Expected: Should see the sample login test

- [ ] **Step 5: 创建SQLite到PostgreSQL迁移脚本**

Create: `docker-compose/scripts/migrate_sqlite_to_postgres.py`

```python
#!/usr/bin/env python3
"""
SQLite to PostgreSQL Migration Script
Migrates existing test data from SQLite to PostgreSQL
"""

import sqlite3
import asyncio
import asyncpg
from datetime import datetime
from pathlib import Path
import sys

async def migrate_data(sqlite_path: str, postgres_url: str):
    """
    Migrate data from SQLite to PostgreSQL
    """
    # Connect to SQLite
    print(f"Connecting to SQLite: {sqlite_path}")
    sqlite_conn = sqlite3.connect(sqlite_path)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()
    
    # Connect to PostgreSQL
    print(f"Connecting to PostgreSQL...")
    pg_conn = await asyncpg.connect(postgres_url)
    
    try:
        # Migrate test_runs
        print("Migrating test_runs...")
        sqlite_cursor.execute("SELECT * FROM test_runs")
        rows = sqlite_cursor.fetchall()
        
        for row in rows:
            await pg_conn.execute("""
                INSERT INTO test_runs 
                (run_id, start_time, end_time, total_tests, passed, failed, 
                 total_duration, environment, status, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                ON CONFLICT (run_id) DO NOTHING
            """, 
            row['run_id'], row['start_time'], row['end_time'],
            row['total_tests'], row['passed'], row['failed'],
            row.get('total_duration', row['end_time'] - row['start_time']),
            row.get('environment', 'development'),
            'completed', 
            datetime.fromtimestamp(row['start_time'] / 1000)
            )
        
        print(f"  ✓ Migrated {len(rows)} test runs")
        
        # Migrate test_cases
        print("Migrating test_cases...")
        sqlite_cursor.execute("SELECT * FROM test_cases")
        rows = sqlite_cursor.fetchall()
        
        for row in rows:
            await pg_conn.execute("""
                INSERT INTO test_cases 
                (run_id, test_id, description, status, duration, 
                 start_time, end_time, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT DO NOTHING
            """,
            row['run_id'], row['test_id'], row['description'],
            row['status'], row['duration'], row['start_time'],
            row['end_time'], 
            datetime.fromtimestamp(row['start_time'] / 1000)
            )
        
        print(f"  ✓ Migrated {len(rows)} test cases")
        
        # Migrate test_steps
        print("Migrating test_steps...")
        sqlite_cursor.execute("SELECT * FROM test_steps")
        rows = sqlite_cursor.fetchall()
        
        for row in rows:
            await pg_conn.execute("""
                INSERT INTO test_steps 
                (case_id, step_number, description, status, error_message)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT DO NOTHING
            """,
            row['case_id'], row['step_number'], row['description'],
            row['status'], row.get('error_message')
            )
        
        print(f"  ✓ Migrated {len(rows)} test steps")
        
        print("\n✅ Migration completed successfully!")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        raise
    finally:
        sqlite_conn.close()
        await pg_conn.close()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python migrate_sqlite_to_postgres.py <path_to_sqlite_db>")
        sys.exit(1)
    
    sqlite_path = sys.argv[1]
    postgres_url = "postgresql://testuser:testpass@localhost:5432/claude_code_tests"
    
    asyncio.run(migrate_data(sqlite_path, postgres_url))
```

- [ ] **Step 6: 使迁移脚本可执行**

Run:
```bash
chmod +x docker-compose/scripts/migrate_sqlite_to_postgres.py
```

- [ ] **Step 7: 提交数据库schema和迁移脚本**

```bash
git add docker-compose/scripts/
git commit -m "feat: add PostgreSQL schema and migration scripts

- Create complete database schema for all services
- Add indexes for performance optimization
- Add SQLite to PostgreSQL migration script
- Include sample data for testing

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 2: 测试用例管理服务 (3-5天)

### Task 3: 创建FastAPI项目结构

**Files:**
- Create: `test-case-management/Dockerfile`
- Create: `test-case-management/requirements.txt`
- Create: `test-case-management/app/__init__.py`
- Create: `test-case-management/app/main.py`
- Create: `test-case-management/app/config.py`
- Create: `test-case-management/app/database.py`
- Create: `test-case-management/app/models/__init__.py`

- [ ] **Step 1: 创建requirements.txt**

Create: `test-case-management/requirements.txt`

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
asyncpg==0.29.0
alembic==1.12.1
pydantic==2.5.0
pydantic-settings==2.1.0
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
python-multipart==0.0.6
httpx==0.25.2
pytest==7.4.3
pytest-asyncio==0.21.1
```

- [ ] **Step 2: 创建Dockerfile**

Create: `test-case-management/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN useradd -m -u 1000 appuser

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: 创建应用配置模块**

Create: `test-case-management/app/config.py`

```python
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    """Application settings"""
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://testuser:testpass@postgres:5432/claude_code_tests"
    
    # Security
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ADMIN_PASSWORD: str = "admin"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24
    
    # CORS
    ALLOWED_ORIGINS: List[str] = ["http://localhost", "http://localhost:3000"]
    
    # Environment
    ENVIRONMENT: str = "development"
    DEBUG: bool = False
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
```

- [ ] **Step 4: 创建数据库连接模块**

Create: `test-case-management/app/database.py`

```python
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import settings

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,
    future=True
)

# Create async session factory
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Base class for models
Base = declarative_base()

# Dependency to get database session
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()
```

- [ ] **Step 5: 创建SQLAlchemy模型**

Create: `test-case-management/app/models/test_definition.py`

```python
from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, ARRAY
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class TestDefinition(Base):
    __tablename__ = "test_definitions"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    test_id = Column(String(100), unique=True, nullable=False, index=True)
    url = Column(String(500))
    environment = Column(JSON)  # Using JSONB type in PostgreSQL
    tags = Column(ARRAY(String), default=[])
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    created_by = Column(String(100), default="system")
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    
    # Relationships
    steps = relationship("TestStep", back_populates="test_definition", cascade="all, delete-orphan")
    versions = relationship("TestVersion", back_populates="test_definition", cascade="all, delete-orphan")
```

Create: `test-case-management/app/models/test_step.py`

```python
from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class TestStep(Base):
    __tablename__ = "test_steps"
    
    id = Column(Integer, primary_key=True)
    test_definition_id = Column(Integer, ForeignKey("test_definitions.id", ondelete="CASCADE"))
    step_number = Column(Integer, nullable=False)
    description = Column(Text, nullable=False)
    type = Column(String(50), nullable=False)
    params = Column(JSON, nullable=False)
    expected_result = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship
    test_definition = relationship("TestDefinition", back_populates="steps")
```

Create: `test-case-management/app/models/test_version.py`

```python
from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class TestVersion(Base):
    __tablename__ = "test_versions"
    
    id = Column(Integer, primary_key=True)
    test_definition_id = Column(Integer, ForeignKey("test_definitions.id", ondelete="CASCADE"))
    version = Column(Integer, nullable=False)
    snapshot = Column(JSON, nullable=False)
    change_description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(String(100), default="system")
    
    # Relationship
    test_definition = relationship("TestDefinition", back_populates="versions")
```

- [ ] **Step 6: 创建Pydantic schemas**

Create: `test-case-management/app/schemas/test_definition.py`

```python
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime

class TestStepBase(BaseModel):
    step_number: int
    description: str
    type: str = Field(..., pattern="^(navigate|click|fill|assert|wait|scroll)$")
    params: Dict[str, Any]
    expected_result: Optional[str] = None

class TestStepCreate(TestStepBase):
    pass

class TestStep(TestStepBase):
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class TestDefinitionBase(BaseModel):
    name: str
    description: Optional[str] = None
    test_id: str
    url: str
    environment: Optional[Dict[str, Any]] = None
    tags: List[str] = []

class TestDefinitionCreate(TestDefinitionBase):
    steps: List[TestStepCreate] = []

class TestDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    url: Optional[str] = None
    environment: Optional[Dict[str, Any]] = None
    tags: Optional[List[str]] = None
    steps: Optional[List[TestStepCreate]] = None

class TestDefinition(TestDefinitionBase):
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: str
    version: int
    is_active: bool
    steps: List[TestStep] = []
    
    class Config:
        from_attributes = True

class TestDefinitionList(BaseModel):
    items: List[TestDefinition]
    total: int
    page: int
    size: int
```

- [ ] **Step 7: 创建main.py应用入口**

Create: `test-case-management/app/main.py`

```python
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from app.config import settings
from app.database import get_db, engine
from app.models import test_definition
from app.schemas.test_definition import TestDefinition, TestDefinitionCreate, TestDefinitionUpdate

# Create FastAPI app
app = FastAPI(
    title="Test Case Management API",
    description="API for managing test cases",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check
@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "test-case-management"}

# Create tables on startup
@app.on_event("startup")
async def startup_event():
    async with engine.begin() as conn:
        await conn.run_sync(test_definition.Base.metadata.create_all, checkfirst=True)

# API Routes
@app.post("/api/tests/v1/definitions", response_model=TestDefinition)
async def create_test(
    test_data: TestDefinitionCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new test definition"""
    # Implementation will be added in next task
    pass

@app.get("/api/tests/v1/definitions", response_model=List[TestDefinition])
async def get_tests(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """Get all test definitions"""
    # Implementation will be added in next task
    pass

@app.get("/api/tests/v1/definitions/{test_id}", response_model=TestDefinition)
async def get_test(
    test_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a single test definition"""
    # Implementation will be added in next task
    pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

- [ ] **Step 8: 更新docker-compose.yml添加测试管理服务**

Modify: `docker-compose/docker-compose.yml`

Add service:
```yaml
  test-case-management:
    build:
      context: ./test-case-management
      dockerfile: Dockerfile
    container_name: cc-test-case-mgmt
    environment:
      DATABASE_URL: postgresql+asyncpg://testuser:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      SECRET_KEY: ${SECRET_KEY}
      ENVIRONMENT: development
    volumes:
      - ./test-case-management:/app
    ports:
      - "3001:8000"
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - test-network
    restart: unless-stopped
```

- [ ] **Step 9: 构建并测试FastAPI服务启动**

Run:
```bash
cd docker-compose
docker-compose build test-case-management
docker-compose up -d test-case-management
docker-compose logs test-case-management
```

Expected: Service should start without errors

- [ ] **Step 10: 验证健康检查端点**

Run:
```bash
curl http://localhost:3001/health
```

Expected:
```json
{"status":"healthy","service":"test-case-management"}
```

- [ ] **Step 11: 停止服务**

Run:
```bash
docker-compose stop test-case-management
```

- [ ] **Step 12: 提交FastAPI项目结构**

```bash
git add test-case-management/
git commit -m "feat: add FastAPI project structure for test case management

- Create Dockerfile and requirements.txt
- Create application config and database modules
- Create SQLAlchemy models for test definitions
- Create Pydantic schemas for API validation
- Create basic FastAPI app with health check
- Add service to docker-compose.yml

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 4: 实现测试用例CRUD API

**Files:**
- Create: `test-case-management/app/routers/test_definitions.py`
- Create: `test-case-management/app/services/test_definition_service.py`
- Create: `test-case-management/tests/test_api.py`

- [ ] **Step 1: 创建测试定义service层**

Create: `test-case-management/app/services/test_definition_service.py`

```python
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime
import json

from app.models.test_definition import TestDefinition as TestDefinitionModel
from app.models.test_step import TestStep as TestStepModel
from app.models.test_version import TestVersion as TestVersionModel
from app.schemas.test_definition import TestDefinitionCreate, TestDefinitionUpdate

class TestDefinitionService:
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create_test(self, test_data: TestDefinitionCreate) -> TestDefinitionModel:
        """Create a new test definition with steps"""
        # Create test definition
        db_test = TestDefinitionModel(
            name=test_data.name,
            description=test_data.description,
            test_id=test_data.test_id,
            url=test_data.url,
            environment=test_data.environment,
            tags=test_data.tags
        )
        
        self.db.add(db_test)
        await self.db.flush()
        
        # Create steps
        for step_data in test_data.steps:
            db_step = TestStepModel(
                test_definition_id=db_test.id,
                step_number=step_data.step_number,
                description=step_data.description,
                type=step_data.type,
                params=step_data.params,
                expected_result=step_data.expected_result
            )
            self.db.add(db_step)
        
        # Create version snapshot
        await self._create_version_snapshot(db_test.id, "Initial version")
        
        await self.db.commit()
        await self.db.refresh(db_test)
        
        return db_test
    
    async def get_tests(self, skip: int = 0, limit: int = 20) -> List[TestDefinitionModel]:
        """Get all test definitions"""
        result = await self.db.execute(
            select(TestDefinitionModel)
            .where(TestDefinitionModel.is_active == True)
            .offset(skip)
            .limit(limit)
            .order_by(TestDefinitionModel.created_at.desc())
        )
        return result.scalars().all()
    
    async def get_test_by_id(self, test_id: int) -> Optional[TestDefinitionModel]:
        """Get a single test definition by ID"""
        result = await self.db.execute(
            select(TestDefinitionModel)
            .where(TestDefinitionModel.id == test_id)
            .where(TestDefinitionModel.is_active == True)
        )
        return result.scalar_one_or_none()
    
    async def update_test(self, test_id: int, test_data: TestDefinitionUpdate) -> Optional[TestDefinitionModel]:
        """Update a test definition (creates new version)"""
        db_test = await self.get_test_by_id(test_id)
        if not db_test:
            return None
        
        # Update fields if provided
        if test_data.name is not None:
            db_test.name = test_data.name
        if test_data.description is not None:
            db_test.description = test_data.description
        if test_data.url is not None:
            db_test.url = test_data.url
        if test_data.environment is not None:
            db_test.environment = test_data.environment
        if test_data.tags is not None:
            db_test.tags = test_data.tags
        
        # Update steps if provided
        if test_data.steps is not None:
            # Delete old steps
            await self.db.execute(
                select(TestStepModel).where(TestStepModel.test_definition_id == test_id)
            )
            for step in result.scalars().all():
                await self.db.delete(step)
            
            # Add new steps
            for step_data in test_data.steps:
                db_step = TestStepModel(
                    test_definition_id=db_test.id,
                    step_number=step_data.step_number,
                    description=step_data.description,
                    type=step_data.type,
                    params=step_data.params,
                    expected_result=step_data.expected_result
                )
                self.db.add(db_step)
        
        # Increment version
        db_test.version += 1
        db_test.updated_at = datetime.utcnow()
        
        # Create version snapshot
        await self._create_version_snapshot(
            db_test.id, 
            f"Version {db_test.version}",
            increment_version=False
        )
        
        await self.db.commit()
        await self.db.refresh(db_test)
        
        return db_test
    
    async def delete_test(self, test_id: int) -> bool:
        """Soft delete a test definition"""
        db_test = await self.get_test_by_id(test_id)
        if not db_test:
            return False
        
        db_test.is_active = False
        await self.db.commit()
        
        return True
    
    async def _create_version_snapshot(
        self, 
        test_definition_id: int, 
        description: str,
        increment_version: bool = True
    ):
        """Create a version snapshot"""
        # Get test definition with steps
        db_test = await self.db.get(TestDefinitionModel, test_definition_id)
        
        # Build snapshot
        snapshot = {
            "name": db_test.name,
            "description": db_test.description,
            "test_id": db_test.test_id,
            "url": db_test.url,
            "environment": db_test.environment,
            "tags": db_test.tags,
            "steps": []
        }
        
        # Add steps to snapshot
        for step in db_test.steps:
            snapshot["steps"].append({
                "step_number": step.step_number,
                "description": step.description,
                "type": step.type,
                "params": step.params,
                "expected_result": step.expected_result
            })
        
        # Create version record
        version = TestVersionModel(
            test_definition_id=test_definition_id,
            version=db_test.version if increment_version else db_test.version,
            snapshot=snapshot,
            change_description=description
        )
        
        self.db.add(version)
```

- [ ] **Step 2: 创建API路由**

Create: `test-case-management/app/routers/test_definitions.py`

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.database import get_db
from app.schemas.test_definition import (
    TestDefinition, 
    TestDefinitionCreate, 
    TestDefinitionUpdate,
    TestDefinitionList
)
from app.services.test_definition_service import TestDefinitionService

router = APIRouter(prefix="/api/tests/v1/definitions", tags=["test-definitions"])

@router.post("", response_model=TestDefinition, status_code=201)
async def create_test(
    test_data: TestDefinitionCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new test definition"""
    service = TestDefinitionService(db)
    
    # Check if test_id already exists
    existing = await service.get_test_by_test_id(test_data.test_id)
    if existing:
        raise HTTPException(status_code=400, detail="Test ID already exists")
    
    try:
        test = await service.create_test(test_data)
        return test
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("", response_model=List[TestDefinition])
async def get_tests(
    skip: int = 0,
    limit: int = 20,
    db: AsyncSession = Depends(get_db)
):
    """Get all test definitions"""
    service = TestDefinitionService(db)
    tests = await service.get_tests(skip=skip, limit=limit)
    return tests

@router.get("/{test_id}", response_model=TestDefinition)
async def get_test(
    test_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Get a single test definition"""
    service = TestDefinitionService(db)
    test = await service.get_test_by_id(test_id)
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    return test

@router.put("/{test_id}", response_model=TestDefinition)
async def update_test(
    test_id: int,
    test_data: TestDefinitionUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a test definition"""
    service = TestDefinitionService(db)
    test = await service.update_test(test_id, test_data)
    
    if not test:
        raise HTTPException(status_code=404, detail="Test not found")
    
    return test

@router.delete("/{test_id}", status_code=204)
async def delete_test(
    test_id: int,
    db: AsyncSession = Depends(get_db)
):
    """Delete a test definition"""
    service = TestDefinitionService(db)
    success = await service.delete_test(test_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Test not found")
    
    return None
```

- [ ] **Step 3: 在main.py中注册路由**

Modify: `test-case-management/app/main.py`

Add:
```python
from app.routers import test_definitions

# Include routers
app.include_router(test_definitions.router)
```

- [ ] **Step 4: 创建单元测试**

Create: `test-case-management/tests/test_api.py`

```python
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.database import get_db
from app.schemas.test_definition import TestDefinitionCreate

@pytest.mark.asyncio
async def test_create_test_definition(db_session: AsyncSession):
    """Test creating a test definition"""
    test_data = TestDefinitionCreate(
        name="Test Login",
        test_id="test-login-001",
        description="Test user login functionality",
        url="https://example.com/login",
        steps=[
            {
                "step_number": 1,
                "description": "Navigate to login page",
                "type": "navigate",
                "params": {"url": "https://example.com/login"}
            }
        ]
    )
    
    service = TestDefinitionService(db_session)
    test = await service.create_test(test_data)
    
    assert test.id is not None
    assert test.test_id == "test-login-001"
    assert test.version == 1
    assert len(test.steps) == 1

@pytest.mark.asyncio
async def test_get_tests(db_session: AsyncSession):
    """Test retrieving all tests"""
    # Create test first
    test_data = TestDefinitionCreate(
        name="Test Login",
        test_id="test-login-002",
        url="https://example.com/login"
    )
    
    service = TestDefinitionService(db_session)
    await service.create_test(test_data)
    
    # Get all tests
    tests = await service.get_tests()
    
    assert len(tests) >= 1
    assert any(t.test_id == "test-login-002" for t in tests)

@pytest.mark.asyncio
async def test_update_test_version_increment(db_session: AsyncSession):
    """Test that updating a test increments version"""
    # Create test
    test_data = TestDefinitionCreate(
        name="Original Name",
        test_id="test-version-001",
        url="https://example.com"
    )
    
    service = TestDefinitionService(db_session)
    test = await service.create_test(test_data)
    original_version = test.version
    
    # Update test
    update_data = TestDefinitionUpdate(name="Updated Name")
    updated_test = await service.update_test(test.id, update_data)
    
    assert updated_test.version == original_version + 1
    assert updated_test.name == "Updated Name"
```

- [ ] **Step 5: 运行单元测试**

Run:
```bash
cd test-case-management
docker exec cc-test-case-mgmt pytest tests/test_api.py -v
```

Expected: All tests pass

- [ ] **Step 6: 测试API端点**

Run:
```bash
# Create a test
curl -X POST http://localhost:3001/api/tests/v1/definitions \
  -H "Content-Type: application/json" \
  -d '{
    "name": "API Test",
    "test_id": "api-test-001",
    "url": "https://example.com",
    "steps": [
      {
        "step_number": 1,
        "description": "Test step",
        "type": "navigate",
        "params": {"url": "https://example.com"}
      }
    ]
  }'

# Get all tests
curl http://localhost:3001/api/tests/v1/definitions
```

Expected: Tests are created and retrieved successfully

- [ ] **Step 7: 提交CRUD API实现**

```bash
git add test-case-management/
git commit -m "feat: implement test case CRUD API

- Add TestDefinitionService with full CRUD operations
- Add API router with all endpoints
- Implement version tracking on updates
- Add unit tests for all operations
- Verify API endpoints with curl

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

**注意:** 由于计划非常长，我已经完成了前两个阶段（基础设施+测试用例管理服务开始）的详细计划。接下来需要继续：

- Phase 2 继续: React前端、认证授权
- Phase 3: 测试调度服务
- Phase 4: Dashboard服务迁移
- Phase 5: 数据迁移和集成
- Phase 6: 测试和部署

但当前计划已经超过15,000字符。让我询问是否继续写完整计划，还是您希望我暂停并review当前进度？

### Task 5: 添加JWT认证和授权

**Files:**
- Create: `test-case-management/app/security/auth.py`
- Create: `test-case-management/app/routers/auth.py`
- Modify: `test-case-management/app/main.py`

- [ ] **Step 1: 创建认证模块**

Create: `test-case-management/app/security/auth.py`

```python
from datetime import datetime, timedelta
from typing import Optional
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.config import settings

security = HTTPBearer()

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm="HS256")
    return encoded_jwt

def verify_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Verify JWT token"""
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.SECRET_KEY,
            algorithms=["HS256"]
        )
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials",
            )
        return username
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
```

- [ ] **Step 2: 创建认证路由**

Create: `test-case-management/app/routers/auth.py`

```python
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.security.auth import create_access_token
from app.config import settings

router = APIRouter(prefix="/api/auth", tags=["authentication"])

class LoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str

@router.post("/login", response_model=TokenResponse)
async def login(login_data: LoginRequest):
    """Authenticate user and return access token"""
    # Simple hardcoded authentication (in production, use database)
    if login_data.username == "admin" and login_data.password == settings.ADMIN_PASSWORD:
        access_token = create_access_token(
            data={"sub": login_data.username}
        )
        return TokenResponse(access_token=access_token, token_type="bearer")
    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
```

- [ ] **Step 3: 保护测试定义路由**

Modify: `test-case-management/app/routers/test_definitions.py`

Add import:
```python
from app.security.auth import verify_token
```

Update route decorators to require auth:
```python
@router.post("", response_model=TestDefinition, status_code=201)
async def create_test(
    test_data: TestDefinitionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: str = Depends(verify_token)  # Add this
):
    """Create a new test definition"""
    # ... rest of implementation
```

- [ ] **Step 4: 在main.py中注册认证路由**

Modify: `test-case-management/app/main.py`

Add:
```python
from app.routers import auth
app.include_router(auth.router)
```

- [ ] **Step 5: 测试认证端点**

Run:
```bash
# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin"}'

# Save token
TOKEN="<returned_token>"

# Try to access protected endpoint
curl http://localhost:3001/api/tests/v1/definitions \
  -H "Authorization: Bearer $TOKEN"
```

Expected: Login returns token, protected endpoints work with token

- [ ] **Step 6: 提交认证实现**

```bash
git add test-case-management/
git commit -m "feat: add JWT authentication

- Add JWT token creation and verification
- Add login endpoint
- Protect test management endpoints
- Add token-based authorization

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 3: 测试调度服务 (5-7天)

### Task 6: 创建FastAPI调度服务框架

**Files:**
- Create: `test-scheduler/Dockerfile`
- Create: `test-scheduler/requirements.txt`
- Create: `test-scheduler/app/main.py`
- Create: `test-scheduler/app/config.py`
- Create: `test-scheduler/worker/worker.py`

- [ ] **Step 1: 创建requirements.txt**

Create: `test-scheduler/requirements.txt`

```txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
asyncpg==0.29.0
celery[redis]==5.3.4
redis==5.0.1
playwright==1.40.0
 APScheduler==3.10.4
pydantic==2.5.0
pydantic-settings==2.1.0
python-multipart==0.0.6
httpx==0.25.2
pytest==7.4.3
pytest-asyncio==0.21.1
```

- [ ] **Step 2: 创建Dockerfile**

Create: `test-scheduler/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies for Playwright
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    && rm -rf /var/lib/apt/lists/*

# Install Playwright browsers
RUN mkdir -p /ms-playwright

# Create non-root user
RUN useradd -m -u 1000 appuser

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Playwright
RUN playwright install chromium
RUN playwright install-deps chromium

# Copy application code
COPY --chown=appuser:appuser . .

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

- [ ] **Step 3: 创建Celery任务定义**

Create: `test-scheduler/app/tasks/test_execution.py`

```python
from celery import Celery
from playwright.async_api import async_playwright
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)

# Create Celery app
celery_app = Celery(
    'test_scheduler',
    broker='redis://redis:6379/0',
    backend='redis://redis:6379/1'
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    task_track_started=True,
    task_time_limit=30 * 60,  # 30 minutes max
    task_soft_time_limit=25 * 60,  # 25 minutes soft limit
    worker_prefetch_multiplier=1,
    worker_max_tasks_per_child=50,
)

@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60
)
async def execute_test(self, run_id: str, test_id: str, environment: str = "development"):
    """
    Execute a single test using Playwright
    """
    logger.info(f"Starting test execution: run_id={run_id}, test_id={test_id}")
    
    try:
        # Get test definition from database
        test_def = await get_test_definition(test_id)
        if not test_def:
            raise ValueError(f"Test definition not found: {test_id}")
        
        # Update run status to running
        await update_run_status(run_id, "running")
        
        # Execute test steps
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                viewport={'width': 1920, 'height': 1080}
            )
            page = await context.new_page()
            
            results = []
            for step in test_def['steps']:
                result = await execute_step(page, step)
                results.append(result)
                
                # Save step result to database
                await save_step_result(run_id, step, result)
                
                if result['status'] == 'failed':
                    logger.error(f"Step failed: {step['description']}")
                    break
            
            await browser.close()
        
        # Update final status
        final_status = 'completed' if all(r['status'] == 'passed' for r in results) else 'failed'
        await update_run_status(run_id, final_status)
        
        logger.info(f"Test execution completed: run_id={run_id}, status={final_status}")
        
        return {'run_id': run_id, 'status': final_status, 'results': results}
        
    except Exception as exc:
        logger.error(f"Test execution failed: run_id={run_id}, error={exc}")
        await update_run_status(run_id, 'failed')
        raise self.retry(exc=exc, countdown=60)

async def execute_step(page, step: Dict[str, Any]) -> Dict[str, Any]:
    """Execute a single test step"""
    step_type = step['type']
    params = step.get('params', {})
    
    try:
        if step_type == 'navigate':
            await page.goto(params['url'])
            await page.wait_for_load_state('networkidle')
            return {'status': 'passed', 'step': step['description']}
        
        elif step_type == 'click':
            await page.click(params['selector'])
            return {'status': 'passed', 'step': step['description']}
        
        elif step_type == 'fill':
            await page.fill(params['selector'], params['value'])
            return {'status': 'passed', 'step': step['description']}
        
        elif step_type == 'assert':
            # Simple assertion - check if element exists
            element = await page.query_selector(params['selector'])
            if element:
                return {'status': 'passed', 'step': step['description']}
            else:
                return {'status': 'failed', 'step': step['description'], 'error': 'Element not found'}
        
        elif step_type == 'wait':
            await page.wait_for_timeout(params.get('timeout', 5000))
            return {'status': 'passed', 'step': step['description']}
        
        else:
            return {'status': 'failed', 'step': step['description'], 'error': f'Unknown step type: {step_type}'}
    
    except Exception as e:
        return {'status': 'failed', 'step': step['description'], 'error': str(e)}
```

- [ ] **Step 4: 创建FastAPI调度服务主应用**

Create: `test-scheduler/app/main.py`

```python
from fastapi import FastAPI, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import uuid

from app.config import settings
from app.database import get_db
from app.tasks.test_execution import execute_test, celery_app
from app.schemas.execution import TestExecutionRequest, ExecutionResponse

# Create FastAPI app
app = FastAPI(
    title="Test Execution Scheduler API",
    description="API for scheduling and managing test execution",
    version="1.0.0"
)

@app.on_event("startup")
async def startup_event():
    """Start Celery beat scheduler"""
    from app.scheduler.beat_scheduler import start_scheduler
    await start_scheduler()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": "test-scheduler",
        "celery_workers": celery_app.control.inspect().active()
    }

@app.post("/api/runs/v1/execute", response_model=ExecutionResponse)
async def trigger_test_execution(
    request: TestExecutionRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    """Trigger test execution"""
    # Generate unique run ID
    run_id = f"run-{uuid.uuid4().hex[:8]}"
    
    # Queue tests for execution
    for test_id in request.test_ids:
        celery_app.send_task(
            'app.tasks.test_execution.execute_test',
            args=[run_id, test_id, request.environment]
        )
    
    return ExecutionResponse(
        run_id=run_id,
        status="queued",
        message=f"Queued {len(request.test_ids)} test(s) for execution"
    )

@app.get("/api/runs/v1/status")
async def get_scheduler_status():
    """Get scheduler and worker status"""
    inspect = celery_app.control.inspect()
    active_workers = inspect.active()
    queued_tasks = inspect.reserved()
    
    return {
        "queue_size": sum(len(tasks) for tasks in (queued_tasks or {}).values()),
        "active_workers": len(active_workers) if active_workers else 0,
        "worker_status": active_workers if active_workers else {}
    }
```

- [ ] **Step 5: 更新docker-compose.yml添加调度服务**

Modify: `docker-compose/docker-compose.yml`

Add services:
```yaml
  test-scheduler:
    build:
      context: ./test-scheduler
      dockerfile: Dockerfile
    container_name: cc-test-scheduler
    environment:
      DATABASE_URL: postgresql+asyncpg://testuser:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      CELERY_BROKER_URL: redis://redis:6379/0
      SECRET_KEY: ${SECRET_KEY}
    volumes:
      - ./test-scheduler:/app
      - screenshots:/app/screenshots
      - playwright_cache:/ms-playwright
    ports:
      - "3002:8000"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - test-network
    restart: unless-stopped

  celery-worker:
    build:
      context: ./test-scheduler
      dockerfile: Dockerfile
    container_name: cc-test-celery-worker
    command: celery -A app.tasks.test_execution worker --loglevel=info --concurrency=3
    environment:
      DATABASE_URL: postgresql+asyncpg://testuser:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      CELERY_BROKER_URL: redis://redis:6379/0
      PLAYWRIGHT_BROWSERS_PATH: /ms-playwright
    volumes:
      - ./test-scheduler:/app
      - screenshots:/app/screenshots
      - playwright_cache:/ms-playwright
    depends_on:
      - postgres
      - redis
    networks:
      - test-network
    restart: unless-stopped

  celery-beat:
    build:
      context: ./test-scheduler
      dockerfile: Dockerfile
    container_name: cc-test-celery-beat
    command: celery -A app.tasks.test_execution beat --loglevel=info
    environment:
      DATABASE_URL: postgresql+asyncpg://testuser:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      CELERY_BROKER_URL: redis://redis:6379/0
    volumes:
      - ./test-scheduler:/app
    depends_on:
      - postgres
      - redis
    networks:
      - test-network
    restart: unless-stopped

volumes:
  screenshots:
  playwright_cache:
```

- [ ] **Step 6: 提交调度服务框架**

```bash
git add test-scheduler/ docker-compose/docker-compose.yml
git commit -m "feat: add test scheduler service framework

- Add FastAPI service with Celery integration
- Add Playwright test execution task
- Add Celery worker and beat services
- Configure task queues and routing
- Add scheduler to docker-compose

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 4: Dashboard服务迁移 (1-2天)

### Task 7: 修改Dashboard服务使用PostgreSQL

**Files:**
- Modify: `test-dashboard/src/db/manager.ts`
- Modify: `test-dashboard/src/reporting/server.ts`
- Create: `test-dashboard/Dockerfile`

- [ ] **Step 1: 创建Dockerfile**

Create: `test-dashboard/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Build application
RUN npm run build

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {if (r.statusCode !== 200) throw new Error('unhealthy')})"

# Start application
CMD ["npm", "start"]
```

- [ ] **Step 2: 更新DatabaseManager以支持PostgreSQL**

**注意:** 由于现有代码使用bun:sqlite，我们需要保持兼容性或迁移。这里假设我们创建一个新的PostgreSQL版本。

Modify: `test-dashboard/src/db/manager.ts`

Add PostgreSQL support while maintaining SQLite backward compatibility during migration:
```typescript
import { Database } from "bun:sqlite";
import { Client } from "pg";

export class DatabaseManager {
  private db: Database | Client;
  private usePostgres: boolean;

  constructor(resultsPath: string, usePostgres: boolean = false) {
    this.usePostgres = usePostgres;
    
    if (usePostgres) {
      this.db = new Client({
        connectionString: process.env.DATABASE_URL
      });
      (this.db as Client).connect();
    } else {
      const dbPath = `${resultsPath}/.analytics/test-results.db`;
      this.db = new Database(dbPath);
      (this.db as Database).exec("PRAGMA foreign_keys = ON");
    }
  }

  getConnection(): Database | Client {
    return this.db;
  }
  
  // ... rest of methods with conditional logic
}
```

- [ ] **Step 3: 添加环境变量配置**

Modify: `test-dashboard/src/reporting/server.ts`

Add:
```typescript
const usePostgres = process.env.USE_POSTGRES === 'true';
const dbPath = usePostgres 
  ? process.env.DATABASE_URL 
  : './results/.analytics/test-results.db';

const dbManager = new DatabaseManager(dbPath, usePostgres);
```

- [ ] **Step 4: 更新docker-compose.yml添加Dashboard服务**

Modify: `docker-compose/docker-compose.yml`

Add service:
```yaml
  test-dashboard:
    build:
      context: ./test-dashboard
      dockerfile: Dockerfile
    container_name: cc-test-dashboard
    environment:
      NODE_ENV: production
      PORT: 3000
      USE_POSTGRES: "true"
      DATABASE_URL: postgresql+asyncpg://testuser:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    volumes:
      - ./test-dashboard:/app
      - dashboard_data:/app/results
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - test-network
    restart: unless-stopped
```

- [ ] **Step 5: 提交Dashboard迁移**

```bash
git add test-dashboard/
git commit -m "feat: migrate dashboard to use PostgreSQL

- Add Dockerfile for containerization
- Update DatabaseManager with PostgreSQL support
- Add environment variable configuration
- Add to docker-compose with PostgreSQL connection

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 5: 数据迁移和集成 (2-3天)

### Task 8: 执行数据迁移

**Files:**
- Use: `docker-compose/scripts/migrate_sqlite_to_postgres.py`
- Create: `docker-compose/scripts/import_json_tests.py`

- [ ] **Step 1: 备份SQLite数据库**

Run:
```bash
cd docker-compose
cp ../results/.analytics/test-results.db ./backup-sqlite.db
```

- [ ] **Step 2: 运行迁移脚本**

Run:
```bash
# Ensure PostgreSQL is running
docker-compose up -d postgres

# Run migration
docker exec cc-test-postgres psql -U testuser -d claude_code_tests -c "\dt"

# Execute migration script
python3 scripts/migrate_sqlite_to_postgres.py ../results/.analytics/test-results.db
```

Expected: Migration completes successfully with counts

- [ ] **Step 3: 验证迁移数据**

Run:
```bash
docker exec cc-test-postgres psql -U testuser -d claude_code_tests -c "
  SELECT 
    (SELECT COUNT(*) FROM test_runs) as test_runs,
    (SELECT COUNT(*) FROM test_cases) as test_cases,
    (SELECT COUNT(*) FROM test_step_results) as test_steps;
"
```

Expected: Counts match SQLite database

- [ ] **Step 4: 导入JSON测试文件**

Create: `docker-compose/scripts/import_json_tests.py`

```python
#!/usr/bin/env python3
"""Import JSON test files into PostgreSQL"""
import json
import asyncio
import asyncpg
from pathlib import Path

async def import_json_tests():
    conn = await asyncpg.connect(
        "postgresql://testuser:testpass@localhost:5432/claude_code_tests"
    )
    
    try:
        json_files = list(Path("../tests").glob("**/*.json"))
        
        for json_file in json_files:
            print(f"Importing {json_file}...")
            with open(json_file, 'r') as f:
                tests = json.load(f)
            
            for test in tests:
                # Create test definition
                test_def_id = await conn.fetchval("""
                    INSERT INTO test_definitions 
                    (test_id, name, description, url, created_by)
                    VALUES ($1, $2, $3, $4, 'json-import')
                    RETURNING id
                """, test['id'], test['name'], test.get('description'), test.get('url'))
                
                # Create steps
                for step in test.get('steps', []):
                    await conn.execute("""
                        INSERT INTO test_steps 
                        (test_definition_id, step_number, description, type, params)
                        VALUES ($1, $2, $3, $4, $5)
                    """, test_def_id, step['id'], step['description'], 
                        step['type'], json.dumps(step.get('params', {})))
        
        print(f"✅ Imported {len(json_files)} test files")
    
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(import_json_tests())
```

Run:
```bash
python3 scripts/import_json_tests.py
```

- [ ] **Step 5: 启动所有服务**

Run:
```bash
cd docker-compose
docker-compose up -d
docker-compose ps
```

Expected: All services running healthy

- [ ] **Step 6: 端到端测试迁移**

Run:
```bash
# Test 1: Create test via API
curl -X POST http://localhost/api/tests/v1/definitions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d @tests/integration-test.json

# Test 2: Execute test via API
curl -X POST http://localhost/api/runs/v1/execute \
  -H "Content-Type: application/json" \
  -d '{"test_ids": ["integration-test-1"], "environment": "development"}'

# Test 3: Check dashboard
curl http://localhost/api/dashboard?days=30
```

Expected: All tests pass successfully

- [ ] **Step 7: 提交迁移和集成**

```bash
git add docker-compose/scripts/
git commit -m "feat: complete data migration and service integration

- Execute SQLite to PostgreSQL migration
- Import JSON test files to database
- Verify data integrity
- Test end-to-end workflows
- All services running in Docker Compose

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Phase 6: 测试和文档 (2-3天)

### Task 9: 编写完整的测试套件

**Files:**
- Create: `test-case-management/tests/integration/test_full_workflow.py`
- Create: `test-scheduler/tests/integration/test_execution.py`
- Create: `tests/e2e/test_complete_system.py`

- [ ] **Step 1: 创建集成测试 - 完整工作流**

Create: `tests/e2e/test_complete_system.py`

```python
import pytest
import asyncio
from httpx import AsyncClient

@pytest.mark.e2e
async def test_create_execute_dashboard_workflow():
    """Test complete workflow: create test → execute → view results"""
    
    async with AsyncClient(base_url="http://localhost") as client:
        # 1. Login
        login_response = await client.post("/api/auth/login", json={
            "username": "admin",
            "password": "admin"
        })
        assert login_response.status_code == 200
        token = login_response.json()["access_token"]
        
        headers = {"Authorization": f"Bearer {token}"}
        
        # 2. Create test
        test_data = {
            "name": "E2E Test",
            "test_id": "e2e-test-001",
            "url": "https://example.com",
            "steps": [
                {
                    "step_number": 1,
                    "description": "Navigate",
                    "type": "navigate",
                    "params": {"url": "https://example.com"}
                }
            ]
        }
        
        create_response = await client.post(
            "/api/tests/v1/definitions",
            json=test_data,
            headers=headers
        )
        assert create_response.status_code == 201
        test_id = create_response.json()["id"]
        
        # 3. Execute test
        exec_response = await client.post(
            "/api/runs/v1/execute",
            json={"test_ids": ["e2e-test-001"]},
            headers=headers
        )
        assert exec_response.status_code == 200
        run_id = exec_response.json()["run_id"]
        
        # 4. Wait for completion
        await asyncio.sleep(10)
        
        # 5. Check results
        results_response = await client.get(
            f"/api/runs/v1/execute/{run_id}",
            headers=headers
        )
        assert results_response.status_code == 200
        status = results_response.json()["status"]
        assert status in ["completed", "failed"]
        
        # 6. Verify dashboard shows the run
        dashboard_response = await client.get("/api/dashboard")
        assert dashboard_response.status_code == 200
```

- [ ] **Step 2: 运行完整测试套件**

Run:
```bash
# Unit tests
docker exec cc-test-case-mgmt pytest tests/unit/ -v
docker exec cc-test-scheduler pytest tests/unit/ -v

# Integration tests
docker exec cc-test-case-mgmt pytest tests/integration/ -v

# E2E tests
pytest tests/e2e/ -v
```

- [ ] **Step 3: 性能测试**

Run:
```bash
# Load test - create 100 concurrent test executions
for i in {1..100}; do
  curl -X POST http://localhost/api/runs/v1/execute \
    -H "Content-Type: application/json" \
    -d '{"test_ids": ["sample-login-test"]}' &
done
wait

# Check dashboard response time
time curl http://localhost/api/dashboard
```

Expected: System handles load gracefully, response times acceptable

- [ ] **Step 4: 提交测试套件**

```bash
git add tests/
git commit -m "test: add comprehensive test suite

- Add E2E workflow tests
- Add integration tests for all services
- Add performance load tests
- Verify system stability under load

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

### Task 10: 编写部署和运维文档

**Files:**
- Create: `README.md` (更新)
- Create: `docs/deployment.md`
- Create: `docs/troubleshooting.md`
- Create: `scripts/ops.sh`

- [ ] **Step 1: 创建部署文档**

Create: `docs/deployment.md`

```markdown
# Test Runner Microservices - Deployment Guide

## Prerequisites

- Docker and Docker Compose
- Git
- 2GB RAM minimum
- 10GB disk space

## Quick Start

1. Clone repository
2. Copy environment file:
   \`\`\`bash
   cd docker-compose
   cp .env.example .env
   # Edit .env with your settings
   \`\`\`

3. Start all services:
   \`\`\`bash
   docker-compose up -d
   \`\`\`

4. Verify services are healthy:
   \`\`\`bash
   docker-compose ps
   curl http://localhost/health
   \`\`\`

## Service Access

- Test Management API: http://localhost:3001
- Test Scheduler API: http://localhost:3002
- Dashboard: http://localhost:3000
- API Docs: http://localhost:3001/docs

## Production Deployment

See deployment.md for production configuration.
```

- [ ] **Step 2: 创建运维脚本**

Create: `scripts/ops.sh`

```bash
#!/bin/bash
# Operations helper script

case "$1" in
  start)
    docker-compose up -d
    ;;
  stop)
    docker-compose down
    ;;
  logs)
    docker-compose logs -f ${2:-""}
    ;;
  backup)
    ./scripts/backup-db.sh
    ;;
  scale)
    docker-compose up -d --scale celery-worker=${2:-3}
    ;;
  *)
    echo "Usage: $0 {start|stop|logs|backup|scale}"
    exit 1
    ;;
esac
```

Make executable:
```bash
chmod +x scripts/ops.sh
```

- [ ] **Step 3: 更新主README**

Update: `README.md`

Add section:
```markdown
## Microservices Architecture

This project runs as a set of microservices managed by Docker Compose:

- **Test Case Management** (port 3001) - API and Web UI for managing tests
- **Test Scheduler** (port 3002) - Orchestrates test execution
- **Dashboard** (port 3000) - Analytics and visualization

All services share a PostgreSQL database and communicate via HTTP APIs.

See [docs/deployment.md](docs/deployment.md) for deployment details.
```

- [ ] **Step 4: 提交文档**

```bash
git add README.md docs/ scripts/
git commit -m "docs: add comprehensive deployment and operations documentation

- Add deployment guide with quick start
- Add operations helper script
- Update main README with architecture overview
- Add troubleshooting guide

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Final Steps

### Task 11: 最终验证和发布

- [ ] **Step 1: 完整系统测试**

Run:
```bash
# Stop all services
docker-compose down -v

# Start fresh
docker-compose up -d

# Run full test suite
pytest tests/e2e/ -v

# Verify all services healthy
curl http://localhost/health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3000/health
```

- [ ] **Step 2: 性能基准测试**

Run:
```bash
# Test API response times
for i in {1..100}; do
  time curl http://localhost/api/tests/v1/definitions
done

# Test dashboard load time
time curl http://localhost/api/dashboard
```

Expected: P95 response times < 200ms

- [ ] **Step 3: 安全审计**

Check:
- [ ] JWT tokens expire correctly
- [ ] SQL injection protection works
- [ ] CORS settings are correct
- [ ] Rate limiting works

- [ ] **Step 4: 创建发布标签**

Run:
```bash
git tag -a v2.0.0 -m "Microservices Architecture Release"
git push origin main --tags
```

- [ ] **Step 5: 提交最终实现**

```bash
git add .
git commit -m "feat: complete microservices architecture implementation

This commit completes the refactoring from CLI tool to microservices architecture:

## Infrastructure
- Docker Compose orchestration
- PostgreSQL shared database
- Redis message queue
- Nginx reverse proxy

## Services
- Test Case Management (FastAPI + React)
- Test Execution Scheduler (FastAPI + Celery + Playwright)
- Dashboard (Express.js, migrated to PostgreSQL)

## Features
- Web UI for test management
- API-based test execution
- Real-time execution monitoring
- Scheduled test runs
- Webhook integration
- Comprehensive analytics dashboard

## Migration
- Complete SQLite to PostgreSQL migration
- JSON test file import
- Zero-downtime deployment strategy

## Quality
- Full test coverage (unit, integration, E2E)
- Production-ready with monitoring and logging
- Comprehensive documentation

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Success Criteria Verification

在完成实现后，验证以下成功标准：

### 功能性要求
- [ ] 测试用例可以通过Web UI管理（CRUD）
- [ ] 支持手动、定时、Webhook三种触发方式
- [ ] 测试执行结果正确存储到PostgreSQL
- [ ] Dashboard正确显示PostgreSQL数据
- [ ] 支持测试版本历史和回滚
- [ ] 实时查看测试执行日志

### 非功能性要求
- [ ] 系统可用性 > 99%
- [ ] API响应时间 < 200ms (P95)
- [ ] 支持至少3个测试并发执行
- [ ] 数据持久化，无数据丢失
- [ ] 一键部署和启动（Docker Compose）
- [ ] 完整的日志和监控

### 迁移要求
- [ ] 现有SQLite数据成功迁移到PostgreSQL
- [ ] 现有JSON测试文件成功导入
- [ ] Dashboard功能不受影响
- [ ] 平滑迁移，最小化停机时间

---

**实施计划版本:** 1.0
**总预估时间:** 15-20个工作日
**复杂度:** 高
**风险等级:** 中等

---

## Next Steps

准备执行？选择执行方式：

1. **Subagent-Driven (推荐)** - 我为每个任务调度新的subagent，任务间进行审查，快速迭代
2. **Inline Execution** - 在当前会话中使用executing-plans执行任务，批量执行并设置检查点

您希望使用哪种执行方式？
