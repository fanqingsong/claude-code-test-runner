# Test Runner Microservices Architecture Design

> **Design Date:** 2026-04-22
> **Author:** Claude Sonnet 4.6
> **Status:** Design Phase - Awaiting User Approval

---

## Executive Summary

将现有的单体CLI测试工具重构为基于微服务的架构，包含三个核心服务：

1. **测试用例管理服务** - 提供Web UI和API进行测试用例CRUD操作
2. **测试执行调度服务** - 负责测试调度、执行和结果收集
3. **Dashboard展示服务** - 保留现有功能，展示测试分析

使用Docker Compose进行容器编排，PostgreSQL作为共享数据库，FastAPI/Python作为后端技术栈。

---

## Architecture Overview

### System Architecture Diagram

```
                    ┌─────────────────────────────────────┐
                    │        Docker Compose管理            │
                    │   ┌─────────────────────────────┐   │
                    │   │    Nginx (端口 80/443)      │   │
                    │   │  /api/tests/* → 测试管理    │   │
                    │   │  /api/runs/*  → 调度服务    │   │
                    │   │  /api/dashboard/* → Dashboard│   │
                    │   │  /              → React SPA  │   │
                    │   └──────────────┬──────────────┘   │
                    │                  │                  │
        ┌───────────┼──────────────────┼──────────────┐  │
        │           │                  │              │  │
┌───────▼────┐ ┌───▼──────┐  ┌────────▼────────┐   │  │
│ 测试用例    │ │ 调度服务  │  │ Dashboard服务    │   │  │
│ 管理服务    │ │          │  │ (现有功能保留)   │   │  │
│            │ │          │  │                 │   │  │
│ 端口 3001  │ │ 端口 3002│  │ 端口 3000       │   │  │
└──────┬─────┘ └───┬──────┘  └────────┬────────┘   │  │
       │           │                  │              │
       └───────────┼──────────────────┘              │
                   │                                 │
           ┌───────▼────────┐                        │
           │  PostgreSQL    │                        │
           │  端口 5432     │                        │
           │  共享数据库     │                        │
           └────────────────┘                        │
                                            └─────────┘
```

### Technology Stack

**测试用例管理服务:**
- FastAPI 0.104+ (Python 3.11+)
- SQLAlchemy 2.0+ (ORM)
- Alembic (数据库迁移)
- Pydantic v2 (数据验证)
- React 18 + TypeScript (前端)
- asyncpg (PostgreSQL驱动)

**测试执行调度服务:**
- FastAPI 0.104+ (Python 3.11+)
- Celery 5.3+ (分布式任务队列)
- Redis 7 (消息代理)
- Playwright-Python (浏览器自动化)
- APScheduler (定时任务)

**Dashboard展示服务:**
- Node.js 20+ / Bun
- Express.js
- EJS模板
- Chart.js

**基础设施:**
- Docker Compose (容器编排)
- Nginx (反向代理)
- PostgreSQL 15 (共享数据库)
- Redis 7 (消息队列)

---

## Service Responsibilities

### 1. Test Case Management Service

**端口:** 3001 (容器内8000)

**职责:**
- 测试用例的CRUD管理
- 测试步骤编辑
- 版本历史和回滚
- JSON文件导入导出
- 标签和分类
- Web界面提供友好操作

**核心API端点:**
```
GET    /api/tests/v1/definitions           - 列出所有测试
GET    /api/tests/v1/definitions/{id}      - 获取测试详情
POST   /api/tests/v1/definitions           - 创建新测试
PUT    /api/tests/v1/definitions/{id}      - 更新测试（创建新版本）
DELETE /api/tests/v1/definitions/{id}      - 删除测试
GET    /api/tests/v1/definitions/{id}/versions - 获取版本历史
POST   /api/tests/v1/definitions/{id}/versions/{version}/rollback - 回滚版本
POST   /api/tests/v1/import               - 批量导入JSON文件
GET    /api/tests/v1/export               - 导出所有测试
```

**数据库表:**
- `test_definitions` - 测试定义主表
- `test_steps` - 测试步骤表
- `test_versions` - 版本历史表

### 2. Test Execution Scheduler Service

**端口:** 3002 (容器内8000)

**职责:**
- 手动/定时/Webhook触发测试
- 任务队列管理（Celery + Redis）
- Worker进程池执行测试
- 并发控制和失败重试
- 实时日志流（SSE）
- 定时任务管理（Cron）

**核心API端点:**
```
POST   /api/runs/v1/execute                  - 手动触发测试
GET    /api/runs/v1/execute/{run_id}         - 获取运行状态
GET    /api/runs/v1/execute/{run_id}/logs    - 实时日志流(SSE)
DELETE /api/runs/v1/execute/{run_id}         - 取消运行
GET    /api/runs/v1/history                  - 查询历史记录
POST   /api/runs/v1/schedules                - 创建定时任务
GET    /api/runs/v1/schedules                - 列出定时任务
POST   /api/runs/v1/webhooks                 - 创建webhook
GET    /api/runs/v1/status                   - 服务状态
```

**核心功能:**
- **任务队列**: Celery + Redis，支持优先级和重试
- **Worker池**: 3个并发worker，进程隔离
- **失败重试**: 最多3次，指数退避
- **定时任务**: APScheduler + Celery Beat
- **实时日志**: Server-Sent Events (SSE)

**数据库表:**
- `test_runs` - 测试运行记录
- `test_cases` - 测试用例执行结果
- `test_step_results` - 测试步骤执行结果
- `schedules` - 定时任务配置
- `webhooks` - Webhook配置

### 3. Dashboard Service

**端口:** 3000

**职责:**
- 保留现有所有功能
- 6个关键指标分析
- Chart.js可视化
- REST API数据查询
- 从PostgreSQL读取数据（只读）

---

## Database Schema

### PostgreSQL Schema

```sql
-- 测试定义表
CREATE TABLE test_definitions (
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

-- 测试步骤表
CREATE TABLE test_steps (
  id SERIAL PRIMARY KEY,
  test_definition_id INTEGER REFERENCES test_definitions(id) ON DELETE CASCADE,
  step_number INTEGER NOT NULL,
  description TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  params JSONB NOT NULL,
  expected_result TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 版本历史表
CREATE TABLE test_versions (
  id SERIAL PRIMARY KEY,
  test_definition_id INTEGER REFERENCES test_definitions(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,
  change_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by VARCHAR(100) DEFAULT 'system'
);

-- 测试运行记录表
CREATE TABLE test_runs (
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

-- 测试用例执行结果表
CREATE TABLE test_cases (
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

-- 测试步骤执行结果表
CREATE TABLE test_step_results (
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

-- 定时任务表
CREATE TABLE schedules (
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

-- Webhook配置表
CREATE TABLE webhooks (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  url VARCHAR(500) NOT NULL,
  secret VARCHAR(255),
  test_definition_ids INTEGER[],
  events TEXT[] NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

## Test Execution Flow

### Complete Workflow

```
1. 触发阶段
   手动/API/定时/Webhook → POST /api/runs/v1/execute
   请求体: { test_ids: [...], environment: "staging" }

2. 验证和准备
   - 验证test_ids存在且激活
   - 从PostgreSQL获取测试定义
   - 创建test_run记录 (status=pending)
   - 返回: run_id + 预估队列位置

3. 任务排队
   - Celery任务队列 (Redis)
   - 按priority排序 (high > normal > low)
   - 并发控制 (最多3个worker同时运行)

4. Worker执行 (进程隔离)
   for each test_id:
     a. 获取测试定义
     b. 启动Playwright browser context
     c. 创建test_case记录
     d. for each step:
        - 执行步骤
        - 创建test_step_result
        - 截图 (如配置启用)
        - 失败立即停止或继续
     e. 更新test_case状态
     f. 清理browser context

5. 结果收集
   - 更新test_run统计
   - 所有结果写入PostgreSQL
   - 截图保存到文件系统
   - 发送完成事件 (webhook通知)

6. 实时状态推送 (可选)
   SSE: GET /api/runs/v1/execute/{run_id}/logs
   事件流: started, step_completed, step_failed, completed
```

### Error Handling

- **超时处理**: 配置timeout，自动终止
- **失败重试**: Celery自动重试，最多3次，指数退避
- **异常捕获**: 所有异常记录到数据库
- **进程隔离**: 单个测试崩溃不影响其他测试

---

## Deployment Architecture

### Docker Compose Configuration

完整配置见 `docker-compose.yml`，包含以下服务：

1. **postgres** - PostgreSQL 15数据库
2. **redis** - Redis 7消息队列
3. **test-case-management** - FastAPI测试管理服务
4. **test-scheduler** - FastAPI调度服务
5. **celery-worker** - Celery工作进程（3个并发）
6. **celery-beat** - Celery定时任务调度器
7. **test-dashboard** - 现有Dashboard服务
8. **nginx** - 反向代理和路由
9. **flower** (可选) - Celery监控界面

### Startup Commands

```bash
# 开发环境
docker-compose -f docker-compose.dev.yml up

# 生产环境
docker-compose up -d

# 查看日志
docker-compose logs -f celery-worker

# 扩展worker
docker-compose up -d --scale celery-worker=5

# 停止服务
docker-compose down
```

### Nginx Routing

```
/api/tests/*     → test-case-management:8000
/api/runs/*      → test-scheduler:8000
/api/dashboard/* → test-dashboard:3000
/                → React SPA (托管在test-case-management)
```

---

## Security Design

### Authentication & Authorization

- **JWT Token认证**: 24小时有效期
- **简单用户名密码**: admin/admin (可配置)
- **Bearer Token**: 所有API需要认证 (除登录)

### API Security

- **安全HTTP头**: X-Content-Type-Options, X-Frame-Options, HSTS
- **CORS配置**: 可配置允许的源
- **速率限制**: 100请求/60秒 (可调整)
- **SQL注入防护**: SQLAlchemy参数化查询

### Webhook Security

- **HMAC签名验证**: GitHub/GitLab风格
- **Secret密钥**: 环境变量配置

### Docker Security

- **非root用户**: 容器内运行在appuser (uid=1000)
- **最小化镜像**: 基于python:3.11-slim
- **健康检查**: 所有服务配置/health端点

---

## Monitoring & Operations

### Logging

- **JSON格式日志**: 结构化日志，包含timestamp、level、service、message
- **日志轮转**: 10MB文件大小，保留5个备份
- **控制台输出**: Docker logs收集

### Health Checks

所有服务提供 `/health` 端点：
- 数据库连接状态
- Redis连接状态
- Worker状态

### Backup Strategy

```bash
# 每日备份PostgreSQL
pg_dump -U testuser claude_code_tests | gzip > backup.sql.gz

# 保留最近30天
find /backup -name "*.sql.gz" -mtime +30 -delete

# 备份截图文件
rsync -av --delete /screenshots/ /backup/screenshots/
```

### Monitoring Metrics (Optional)

Prometheus格式指标：
- `test_executions_total` - 测试执行计数
- `test_execution_duration_seconds` - 执行时间
- `celery_queue_length` - 队列长度
- `celery_worker_status` - Worker状态

---

## Testing Strategy

### Test Pyramid

```
        E2E Tests (少量)
         集成测试 (中等)
       单元测试 (大量)
```

### Unit Tests

- 每个服务的单元测试
- API端点测试
- 数据模型验证测试
- 异步任务测试

### Integration Tests

- 数据库集成测试
- Redis集成测试
- API集成测试
- 完整执行流程测试

### E2E Tests

- 创建测试 → 执行 → 查看结果完整流程
- 跨服务交互测试
- 用户界面操作测试

---

## Migration Strategy

### Phase 1: 准备阶段 (1-2天)

- 备份SQLite数据库
- 设置PostgreSQL数据库
- 创建schema和表
- 配置Docker Compose环境

### Phase 2: 双写阶段 (3-5天)

- 新旧系统同时运行
- 测试结果同时写入SQLite和PostgreSQL
- 验证数据一致性
- Dashboard从PostgreSQL读取（测试）

### Phase 3: 数据迁移 (1天)

- 运行迁移脚本
- 验证迁移数据完整性
- 导入JSON测试文件到PostgreSQL
- 更新服务配置切换到PostgreSQL

### Phase 4: 切换和验证 (2-3天)

- 完全切换到新系统
- 保留SQLite作为备份（1周）
- 监控系统稳定性和性能
- 收集用户反馈并修复问题

### Phase 5: 清理阶段 (1天)

- 确认系统稳定后，移除SQLite相关代码
- 更新文档和配置
- 归档SQLite数据库

### Rollback Strategy

- 配置文件保留双写模式开关
- 快速回滚到SQLite
- 保留完整备份

---

## React Frontend Design

### Technology Stack

- React 18 + TypeScript
- React Router v6
- Zustand (状态管理)
- React Hook Form + Zod (表单验证)
- TanStack Table (数据表格)
- TailwindCSS + shadcn/ui (UI组件)
- Vite (构建工具)

### Key Pages

1. **TestListPage** - 测试列表，支持搜索、过滤、批量操作
2. **TestDetailPage** - 测试详情和编辑
3. **TestCreatePage** - 创建新测试
4. **ExecutionHistoryPage** - 执行历史记录
5. **SchedulePage** - 定时任务管理

### Key Components

- **TestTable** - 测试列表表格
- **StepEditor** - 步骤编辑器（拖拽排序）
- **ExecutionMonitor** - 实时执行监控（WebSocket）
- **LogViewer** - 日志查看器

---

## Development Workflow

### Project Structure

```
docker-compose/
├── docker-compose.yml
├── nginx/nginx.conf
├── test-case-management/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── models/
│   │   ├── routers/
│   │   ├── schemas/
│   │   └── database.py
│   └── alembic/
├── test-scheduler/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── workers/
│   │   ├── tasks/
│   │   └── scheduler/
│   └── tests/
└── test-dashboard/
    ├── Dockerfile
    └── (现有的CLI代码)
```

### Development Commands

```bash
# 启动所有服务（开发模式）
docker-compose -f docker-compose.dev.yml up

# 运行测试
docker exec cc-test-case-mgmt pytest tests/unit/
docker exec cc-test-scheduler pytest tests/integration/

# 创建数据库迁移
docker exec cc-test-case-mgmt alembic revision --autogenerate -m "description"
docker exec cc-test-case-mgmt alembic upgrade head

# 查看日志
docker-compose logs -f celery-worker

# 健康检查
curl http://localhost/api/tests/v1/definitions
curl http://localhost/api/runs/v1/status
```

---

## Success Criteria

### Functional Requirements

- ✅ 测试用例可以通过Web UI管理（CRUD）
- ✅ 支持手动、定时、Webhook三种触发方式
- ✅ 测试执行结果正确存储到PostgreSQL
- ✅ Dashboard正确显示PostgreSQL数据
- ✅ 支持测试版本历史和回滚
- ✅ 实时查看测试执行日志

### Non-Functional Requirements

- ✅ 系统可用性 > 99%
- ✅ API响应时间 < 200ms (P95)
- ✅ 支持至少3个测试并发执行
- ✅ 数据持久化，无数据丢失
- ✅ 一键部署和启动（Docker Compose）
- ✅ 完整的日志和监控

### Migration Requirements

- ✅ 现有SQLite数据成功迁移到PostgreSQL
- ✅ 现有JSON测试文件成功导入
- ✅ Dashboard功能不受影响
- ✅ 平滑迁移，最小化停机时间

---

## Risks and Challenges

### Technical Risks

1. **数据迁移复杂性**
   - 风险: SQLite到PostgreSQL的schema映射可能出问题
   - 缓解: 充分测试迁移脚本，保留备份

2. **服务间通信**
   - 风险: 服务间HTTP调用可能导致延迟
   - 缓解: 使用异步处理，添加超时和重试

3. **并发控制**
   - 风险: Celery worker并发可能导致资源竞争
   - 缓解: 限制并发数，使用锁机制

### Operational Risks

1. **Docker环境复杂性**
   - 风险: 容器编排配置复杂，部署困难
   - 缓解: 详细文档，自动化脚本

2. **性能问题**
   - 风险: PostgreSQL可能成为瓶颈
   - 缓解: 添加索引，优化查询，必要时缓存

### Migration Risks

1. **停机时间**
   - 风险: 迁移可能导致服务中断
   - 缓解: 使用双写模式，最小化停机

2. **数据不一致**
   - 风险: 迁移过程中数据可能不一致
   - 缓解: 验证脚本，回滚机制

---

## Next Steps

一旦设计获得批准，将创建详细的实现计划，包括：

1. **Phase 1**: 基础设施搭建（PostgreSQL、Redis、Docker Compose）
2. **Phase 2**: 测试用例管理服务（FastAPI + React）
3. **Phase 3**: 测试调度服务（FastAPI + Celery + Playwright）
4. **Phase 4**: 数据迁移和集成
5. **Phase 5**: 测试和优化
6. **Phase 6**: 部署和文档

每个阶段将包含具体的任务、验收标准和时间估算。

---

**设计文档版本:** 1.0
**最后更新:** 2026-04-22
**状态:** 待用户审批
