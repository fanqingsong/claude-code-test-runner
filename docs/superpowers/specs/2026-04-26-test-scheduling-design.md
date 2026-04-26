# 测试用例定时触发功能设计文档

**日期**: 2026-04-26
**作者**: Claude Sonnet 4.6
**状态**: 设计阶段

## 1. 概述

### 1.1 目标
为测试管理系统添加完整的定时触发功能，支持：
- 单个测试用例的独立调度
- 测试组的批量调度（静态测试套件 + 动态标签过滤）
- 灵活的调度配置（预设选项 + 自定义cron表达式）
- 完整的执行历史记录和状态管理
- 执行限制和自动重试机制

### 1.2 设计原则
- **最小化改动**: 在现有架构基础上扩展，复用Celery Beat基础设施
- **数据库驱动**: 所有配置存储在数据库中，便于通过dashboard管理
- **向后兼容**: 不影响现有的手动测试执行功能
- **可扩展性**: 支持未来添加更多调度策略和通知方式

## 2. 系统架构

### 2.1 整体架构图

```
┌─────────────────────────────────────────────────────────────┐
│                     Dashboard Service                        │
│              (管理界面 + API调用)                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Scheduler Service                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Schedules API                            │  │
│  │  (创建/更新/删除/查询定时计划)                          │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Schedule Manager                          │  │
│  │  (同步数据库配置到Celery Beat)                         │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Execution Service                         │  │
│  │  (执行限制、历史记录、状态管理)                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Celery Beat                               │
│              (定时触发器)                                      │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                  Celery Workers                              │
│           (执行测试任务)                                        │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 核心组件

#### 2.2.1 Schedule Manager
- 负责从数据库读取调度配置
- 验证cron表达式有效性
- 动态更新Celery Beat的beat_schedule配置
- 计算并更新下次执行时间

#### 2.2.2 Execution Service
- 执行前置检查（并发限制）
- 解析目标测试用例（单个/套件/标签过滤）
- 合并环境配置
- 管理执行状态和历史记录
- 处理重试逻辑

## 3. 数据模型设计

### 3.1 测试套件表 (test_suites)

用于静态测试分组。

```sql
CREATE TABLE test_suites (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    test_definition_ids INTEGER[] NOT NULL,
    tags JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system'
);
```

**字段说明**:
- `test_definition_ids`: 测试用例ID数组，支持多选
- `tags`: 可选的标签元数据，便于分类管理

### 3.2 定时计划表 (schedules)

存储所有调度配置。

```sql
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    schedule_type VARCHAR(20) NOT NULL, -- 'single' 或 'suite'

    -- 目标配置（互斥）
    test_definition_id INTEGER,
    test_suite_id INTEGER,
    tag_filter VARCHAR(100), -- 动态标签过滤

    -- 调度配置
    preset_type VARCHAR(50), -- 'hourly', 'daily', 'weekly', 'custom'
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(50) DEFAULT 'UTC',

    -- 环境配置
    environment_overrides JSONB DEFAULT '{}',

    -- 执行配置
    is_active BOOLEAN DEFAULT true,
    allow_concurrent BOOLEAN DEFAULT false,
    max_retries INTEGER DEFAULT 0,
    retry_interval_seconds INTEGER DEFAULT 60,

    -- 时间戳
    next_run_time TIMESTAMP,
    last_run_time TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100) DEFAULT 'system'
);
```

**字段说明**:
- `schedule_type`: 'single'表示单个测试，'suite'表示测试套件
- `test_definition_id` / `test_suite_id` / `tag_filter`: 根据type使用其中一个
- `preset_type`: 预设选项类型，便于UI展示
- `environment_overrides`: 覆盖或扩展测试用例的默认环境配置
- `allow_concurrent`: 是否允许同一schedule的多次执行并发运行

### 3.3 执行历史表 (test_runs)

记录每次执行的详细信息。

```sql
CREATE TABLE test_runs (
    id SERIAL PRIMARY KEY,
    schedule_id INTEGER REFERENCES schedules(id),
    test_definition_id INTEGER,
    run_id VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'pending', 'running', 'passed', 'failed', 'skipped'

    -- 执行信息
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    total_duration_ms BIGINT,

    -- 结果统计
    total_tests INTEGER DEFAULT 0,
    passed INTEGER DEFAULT 0,
    failed INTEGER DEFAULT 0,
    skipped INTEGER DEFAULT 0,

    -- 详细结果
    test_cases JSONB,
    error_message TEXT,

    -- 重试信息
    retry_count INTEGER DEFAULT 0,
    is_retry BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**索引**:
- `(schedule_id, created_at)`: 用于快速查询某个schedule的执行历史
- `(status, created_at)`: 用于统计和监控
- `run_id`: 唯一索引，防止重复

## 4. API设计

### 4.1 测试套件管理

```python
# 创建测试套件
POST   /api/v1/test-suites/
Request: {
  "name": "回归测试套件",
  "description": "核心功能的回归测试",
  "test_definition_ids": [1, 2, 3, 5, 8],
  "tags": {"category": "regression", "priority": "high"}
}
Response: TestSuiteResponse

# 列出测试套件
GET    /api/v1/test-suites/?skip=0&limit=100
Response: [TestSuiteResponse]

# 获取测试套件详情
GET    /api/v1/test-suites/{id}
Response: TestSuiteResponse

# 更新测试套件
PUT    /api/v1/test-suites/{id}
Request: { ... }  # 同创建
Response: TestSuiteResponse

# 删除测试套件
DELETE /api/v1/test-suites/{id}
Status: 204
```

### 4.2 定时计划管理

```python
# 创建定时计划
POST   /api/v1/schedules/
Request: {
  "name": "每日回归测试",
  "schedule_type": "suite",
  "test_suite_id": 1,
  "preset_type": "daily",
  "cron_expression": "0 9 * * *",
  "timezone": "Asia/Shanghai",
  "environment_overrides": {
    "BASE_URL": "https://staging.example.com"
  },
  "is_active": true,
  "allow_concurrent": false,
  "max_retries": 2,
  "retry_interval_seconds": 120
}
Response: ScheduleResponse

# 列出定时计划
GET    /api/v1/schedules/?is_active=true&skip=0&limit=100
Response: [ScheduleResponse]

# 获取定时计划详情
GET    /api/v1/schedules/{id}
Response: ScheduleResponse

# 更新定时计划
PUT    /api/v1/schedules/{id}
Request: { ... }  # 同创建
Response: ScheduleResponse

# 删除定时计划
DELETE /api/v1/schedules/{id}
Status: 204

# 启用/禁用定时计划
POST   /api/v1/schedules/{id}/toggle
Request: { "is_active": true }
Response: ScheduleResponse

# 手动触发执行
POST   /api/v1/schedules/{id}/trigger
Response: { "run_id": "...", "status": "pending" }
```

### 4.3 执行历史管理

```python
# 获取定时计划的执行历史
GET    /api/v1/schedules/{id}/runs?status=failed&limit=50
Response: [TestRunResponse]

# 获取所有执行记录
GET    /api/v1/test-runs/?skip=0&limit=100
Response: [TestRunResponse]

# 获取执行详情
GET    /api/v1/test-runs/{run_id}
Response: TestRunResponse (包含完整的test_cases数组)

# 获取执行统计
GET    /api/v1/schedules/{id}/stats
Response: {
  "total_runs": 100,
  "success_rate": 0.95,
  "avg_duration_ms": 45000,
  "last_run_status": "passed",
  "next_run_time": "2026-04-26T09:00:00Z"
}
```

### 4.4 预设选项

```python
# 获取可用的预设选项
GET    /api/v1/schedules/presets
Response: {
  "presets": [
    {
      "type": "hourly",
      "name": "每小时",
      "cron": "0 * * * *",
      "description": "每小时的第0分钟执行"
    },
    {
      "type": "daily",
      "name": "每天",
      "cron": "0 9 * * *",
      "description": "每天早上9点执行"
    },
    {
      "type": "weekly",
      "name": "每周一",
      "cron": "0 9 * * 1",
      "description": "每周一早上9点执行"
    },
    {
      "type": "monthly",
      "name": "每月1号",
      "cron": "0 9 1 * *",
      "description": "每月1号早上9点执行"
    }
  ]
}
```

## 5. 核心业务逻辑

### 5.1 Schedule Manager - 配置同步

**职责**: 定期从数据库同步调度配置到Celery Beat

```python
class ScheduleManager:
    def __init__(self, db_session, celery_app):
        self.db = db_session
        self.celery_app = celery_app

    async def sync_schedules(self):
        """同步所有激活的调度配置到Celery Beat"""
        schedules = await self.get_active_schedules()

        beat_schedule = {}
        for schedule in schedules:
            # 验证cron表达式
            if not self.validate_cron(schedule.cron_expression):
                logger.warning(f"Invalid cron for schedule {schedule.id}")
                continue

            # 构建Celery Beat任务配置
            task_name = f"scheduled_test_{schedule.id}"
            beat_schedule[task_name] = {
                'task': 'app.tasks.test_execution.execute_scheduled_test',
                'schedule': Crontab(
                    *parse_cron(schedule.cron_expression)
                ),
                'args': [schedule.id],
                'options': {
                    'expires': 300  # 5分钟后过期，防止积压
                }
            }

            # 更新下次执行时间
            await self.update_next_run_time(schedule)

        # 应用到Celery配置
        self.celery_app.conf.beat_schedule = beat_schedule

    async def update_next_run_time(self, schedule):
        """计算并更新下次执行时间"""
        from croniter import croniter
        from datetime import datetime

        cron = croniter(schedule.cron_expression, datetime.utcnow())
        next_time = cron.get_next(datetime)
        schedule.next_run_time = next_time
        await self.db.commit()
```

**调用频率**: 每分钟同步一次（通过Celery Beat自身的周期任务）

### 5.2 Execution Service - 目标解析

**职责**: 根据调度类型解析要执行的测试用例

```python
class ExecutionService:
    async def resolve_target_tests(self, schedule):
        """解析调度目标，返回测试用例ID列表"""
        if schedule.schedule_type == 'single':
            return [schedule.test_definition_id]

        elif schedule.schedule_type == 'suite':
            suite = await self.get_suite(schedule.test_suite_id)
            return suite.test_definition_ids

        elif schedule.schedule_type == 'tag_filter':
            # 动态标签过滤
            tests = await self.db.execute(
                select(TestDefinition).where(
                    TestDefinition.tags.contains([schedule.tag_filter])
                )
            )
            return [t.id for t in tests.scalars().all()]

        else:
            raise ValueError(f"Unknown schedule_type: {schedule.schedule_type}")

    def build_environment(self, schedule, test_definition):
        """构建最终执行环境（合并配置）"""
        base_env = test_definition.environment or {}
        overrides = schedule.environment_overrides or {}

        # overrides优先级更高
        return {**base_env, **overrides}
```

### 5.3 执行限制检查

**职责**: 防止并发执行冲突

```python
async def check_execution_limit(db: AsyncSession, schedule_id: int) -> bool:
    """检查是否允许执行"""
    schedule = await get_schedule(db, schedule_id)

    # 如果允许并发，直接通过
    if schedule.allow_concurrent:
        return True

    # 检查是否有正在运行的任务
    stmt = select(func.count(TestRun.id)).where(
        TestRun.schedule_id == schedule_id,
        TestRun.status.in_(['pending', 'running'])
    )
    result = await db.execute(stmt)
    running_count = result.scalar()

    return running_count == 0
```

### 5.4 自动重试逻辑

**职责**: 失败后的自动重试

```python
@celery_app.task(bind=True, max_retries=5)
def execute_with_retry(self, schedule_id: int, test_definition_id: int,
                      environment: dict, run_id: str):
    """带重试的测试执行"""
    schedule = get_schedule(schedule_id)
    db = get_db()

    try:
        # 执行测试
        result = execute_test(test_definition_id, run_id, environment)

        # 检查是否需要重试
        if result['status'] == 'failed':
            current_retry = get_retry_count(db, schedule_id, run_id)

            if current_retry < schedule.max_retries:
                # 更新重试次数
                increment_retry_count(db, run_id)
                # 安排延迟重试
                raise self.retry(
                    countdown=schedule.retry_interval_seconds,
                    exc=Exception(f"Test failed, retry {current_retry + 1}/{schedule.max_retries}")
                )

        # 保存最终结果
        save_test_run_result(db, schedule_id, run_id, result)
        return result

    except Exception as e:
        # 达到最大重试次数或其他错误
        save_final_failure(db, schedule_id, run_id, str(e))
        raise
```

### 5.5 状态机管理

执行状态转换：

```
pending -> running -> passed
                    -> failed
                    -> skipped (超时/取消)

failed -> pending (重试)
```

```python
async def update_run_status(db: AsyncSession, run_id: str, status: str):
    """更新执行状态"""
    run = await get_run(db, run_id)

    # 验证状态转换合法性
    valid_transitions = {
        'pending': ['running', 'skipped'],
        'running': ['passed', 'failed', 'skipped'],
        'failed': ['pending']  # 仅在重试时
    }

    current_status = run.status
    if status not in valid_transitions.get(current_status, []):
        raise ValueError(f"Invalid status transition: {current_status} -> {status}")

    run.status = status
    if status == 'running':
        run.start_time = datetime.utcnow()
    elif status in ['passed', 'failed', 'skipped']:
        run.end_time = datetime.utcnow()

    await db.commit()
```

## 6. 技术实现细节

### 6.1 ORM模型

**TestSuite模型** (`scheduler-service/app/models/test_suite.py`):

```python
from sqlalchemy import ARRAY, Integer, String, Text, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

class TestSuite(Base):
    __tablename__ = "test_suites"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    test_definition_ids: Mapped[list[int]] = mapped_column(
        ARRAY(Integer), nullable=False
    )
    tags: Mapped[dict] = mapped_column(JSONB, default={})
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    created_by: Mapped[str] = mapped_column(String(100), default="system")
```

**Schedule模型** (`scheduler-service/app/models/schedule.py`):

```python
class Schedule(Base):
    __tablename__ = "schedules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    schedule_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # 目标配置
    test_definition_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    test_suite_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tag_filter: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # 调度配置
    preset_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    cron_expression: Mapped[str] = mapped_column(String(100), nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC")

    # 环境和执行配置
    environment_overrides: Mapped[dict] = mapped_column(JSONB, default={})
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    allow_concurrent: Mapped[bool] = mapped_column(Boolean, default=False)
    max_retries: Mapped[int] = mapped_column(Integer, default=0)
    retry_interval_seconds: Mapped[int] = mapped_column(Integer, default=60)

    # 时间戳
    next_run_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_run_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
    created_by: Mapped[str] = mapped_column(String(100), default="system")
```

**TestRun模型** (`scheduler-service/app/models/test_run.py`):

```python
class TestRun(Base):
    __tablename__ = "test_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    schedule_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("schedules.id"), nullable=True
    )
    test_definition_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    run_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False)

    # 执行信息
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    total_duration_ms: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    # 结果统计
    total_tests: Mapped[int] = mapped_column(Integer, default=0)
    passed: Mapped[int] = mapped_column(Integer, default=0)
    failed: Mapped[int] = mapped_column(Integer, default=0)
    skipped: Mapped[int] = mapped_column(Integer, default=0)

    # 详细结果
    test_cases: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 重试信息
    retry_count: Mapped[int] = mapped_column(Integer, default=0)
    is_retry: Mapped[bool] = mapped_column(Boolean, default=False)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
```

### 6.2 Pydantic Schemas

**ScheduleCreate**:

```python
class ScheduleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    schedule_type: Literal["single", "suite", "tag_filter"]

    # 目标配置（根据type提供相应字段）
    test_definition_id: Optional[int] = None
    test_suite_id: Optional[int] = None
    tag_filter: Optional[str] = None

    # 调度配置
    preset_type: Optional[str] = None
    cron_expression: str = Field(..., pattern=r"^[\d\*\/\-,]+\s[\d\*\/\-,]+\s[\d\*\/\-,]+\s[\d\*\/\-,]+\s[\d\*\/\-,]+$")
    timezone: str = Field(default="UTC", pattern=r"^[A-Za-z]+/[A-Za-z_]+$")

    # 环境和执行配置
    environment_overrides: dict = Field(default_factory=dict)
    is_active: bool = Field(default=True)
    allow_concurrent: bool = Field(default=False)
    max_retries: int = Field(default=0, ge=0, le=10)
    retry_interval_seconds: int = Field(default=60, ge=10, le=3600)

    @model_validator
    def validate_target_config(cls, values):
        """验证目标配置的完整性"""
        schedule_type = values.get('schedule_type')
        test_def_id = values.get('test_definition_id')
        suite_id = values.get('test_suite_id')
        tag = values.get('tag_filter')

        if schedule_type == 'single' and not test_def_id:
            raise ValueError('schedule_type=single requires test_definition_id')
        if schedule_type == 'suite' and not suite_id:
            raise ValueError('schedule_type=suite requires test_suite_id')
        if schedule_type == 'tag_filter' and not tag:
            raise ValueError('schedule_type=tag_filter requires tag_filter')

        return values
```

### 6.3 Celery任务

**执行调度测试任务**:

```python
@celery_app.task(bind=True, name='app.tasks.test_execution.execute_scheduled_test')
def execute_scheduled_test(self, schedule_id: int):
    """执行定时调度的测试"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(
            _execute_scheduled_test_async(schedule_id)
        )
        return result
    finally:
        loop.close()

async def _execute_scheduled_test_async(schedule_id: int):
    """异步执行定时测试"""
    db = get_db()

    try:
        # 1. 获取调度配置
        schedule = await get_schedule(db, schedule_id)
        if not schedule.is_active:
            return {"status": "skipped", "reason": "Schedule is inactive"}

        # 2. 检查执行限制
        if not await check_execution_limit(db, schedule_id):
            return {"status": "skipped", "reason": "Concurrent execution not allowed"}

        # 3. 解析目标测试
        test_ids = await resolve_target_tests(schedule)

        # 4. 为每个测试创建执行记录并执行
        results = []
        for test_id in test_ids:
            run_id = f"{schedule_id}_{test_id}_{datetime.utcnow().timestamp()}"

            # 创建执行记录
            test_run = TestRun(
                schedule_id=schedule_id,
                test_definition_id=test_id,
                run_id=run_id,
                status='pending'
            )
            db.add(test_run)
            await db.commit()

            # 更新状态为running
            await update_run_status(db, run_id, 'running')

            # 获取测试定义并构建环境
            test_def = await get_test_definition(db, test_id)
            environment = build_environment(schedule, test_def)

            # 执行测试（复用现有任务）
            try:
                result = await execute_test_async(test_id, run_id, environment)

                # 保存结果
                await save_test_run_result(db, schedule_id, run_id, result)
                results.append(result)

            except Exception as e:
                # 保存失败结果
                await save_test_run_result(db, schedule_id, run_id, {
                    'status': 'failed',
                    'error': str(e)
                })
                results.append({'status': 'failed', 'error': str(e)})

        # 5. 更新调度记录
        schedule.last_run_time = datetime.utcnow()
        await db.commit()

        return {
            "schedule_id": schedule_id,
            "total_tests": len(results),
            "results": results
        }

    except Exception as e:
        logger.error(f"Failed to execute scheduled test {schedule_id}: {e}")
        raise
```

### 6.4 Schedule同步任务

```python
@celery_app.task(name='app.tasks.schedule.sync_schedules')
def sync_schedules():
    """定期同步调度配置到Celery Beat"""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(_sync_schedules_async())
    finally:
        loop.close()

async def _sync_schedules_async():
    """异步同步调度配置"""
    db = get_db()
    manager = ScheduleManager(db, celery_app)

    await manager.sync_schedules()
    logger.info("Schedules synced to Celery Beat successfully")
```

## 7. 部署和配置

### 7.1 数据库迁移

创建迁移脚本：

```bash
# 在 scheduler-service 中创建迁移
cd docker-compose/scheduler-service
alembic revision --autogenerate -m "Add scheduling tables"
alembic upgrade head
```

### 7.2 Celery Beat配置更新

更新 `docker-compose/docker-compose.yml`：

```yaml
scheduler-worker:
  # ... 现有配置 ...
  command: >
    celery -A app.core.celery_app worker
           --loglevel=info
           --concurrency=2
           -Q test_execution,schedule_sync

scheduler-beat:
  build: ./scheduler-service
  container_name: cc-test-scheduler-beat
  command: celery -A app.core.celery_app beat --loglevel=info
  environment:
    DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
    REDIS_URL: redis://redis:6379/0
    CELERY_BROKER_URL: redis://redis:6379/0
    CELERY_RESULT_BACKEND: redis://redis:6379/0
    SECRET_KEY: ${SECRET_KEY}
  depends_on:
    redis:
      condition: service_healthy
  networks:
    - test-network
  restart: unless-stopped
```

### 7.3 环境变量

在 `.env` 中添加：

```bash
# 调度配置
SCHEDULE_SYNC_INTERVAL=60  # 同步间隔（秒）
DEFAULT_EXECUTION_TIMEOUT=300  # 默认执行超时（秒）
MAX_CONCURRENT_SCHEDULES=10  # 最大并发调度数
```

## 8. 监控和可观测性

### 8.1 日志策略

```python
# 结构化日志
logger.info(
    "schedule_execution_started",
    extra={
        "schedule_id": schedule_id,
        "schedule_name": schedule.name,
        "run_id": run_id,
        "test_count": len(test_ids)
    }
)

logger.error(
    "schedule_execution_failed",
    extra={
        "schedule_id": schedule_id,
        "error": str(e),
        "traceback": traceback.format_exc()
    }
)
```

### 8.2 指标收集

建议收集的指标：
- `schedule_total`: 总调度数
- `schedule_success`: 成功执行的调度数
- `schedule_failed`: 失败的调度数
- `schedule_retry_count`: 重试次数
- `schedule_execution_duration`: 执行时长分布

### 8.3 健康检查

```python
@router.get("/health/scheduler")
async def scheduler_health():
    """调度器健康检查"""
    db = get_db()

    # 检查数据库连接
    try:
        await db.execute(select(func.count()).select_from(Schedule))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database error: {e}")

    # 检查Celery连接
    try:
        inspect = celery_app.control.inspect()
        if not inspect.ping():
            raise HTTPException(status_code=503, detail="Celery workers not responding")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Celery error: {e}")

    return {"status": "healthy", "timestamp": datetime.utcnow()}
```

## 9. 测试策略

### 9.1 单元测试

```python
# 测试ScheduleManager
async def test_sync_schedules(db_session, celery_app):
    manager = ScheduleManager(db_session, celery_app)
    await manager.sync_schedules()

    # 验证beat_schedule已更新
    assert 'scheduled_test_1' in celery_app.conf.beat_schedule

# 测试执行限制检查
async def test_execution_limit(db_session):
    schedule = create_test_schedule(allow_concurrent=False)
    create_running_test_run(schedule.id)

    result = await check_execution_limit(db_session, schedule.id)
    assert result is False
```

### 9.2 集成测试

```python
async def test_full_schedule_flow(client, db_session):
    # 1. 创建测试套件
    suite = await create_test_suite(client)

    # 2. 创建调度（使用短时间间隔）
    schedule = await create_schedule(
        client,
        suite_id=suite.id,
        cron_expression="* * * * *"  # 每分钟
    )

    # 3. 等待执行
    await asyncio.sleep(70)

    # 4. 验证执行记录
    runs = await get_schedule_runs(client, schedule.id)
    assert len(runs) >= 1
    assert runs[0]['status'] in ['passed', 'failed']
```

## 10. 实施计划

### 10.1 第一阶段：基础设施
1. 创建数据库迁移脚本
2. 实现ORM模型（TestSuite, Schedule, TestRun）
3. 实现Pydantic schemas
4. 单元测试

### 10.2 第二阶段：核心功能
1. 实现ScheduleManager
2. 实现ExecutionService
3. 更新Celery任务
4. 集成测试

### 10.3 第三阶段：API和UI
1. 实现API端点
2. API文档和测试
3. Dashboard界面开发

### 10.4 第四阶段：部署和监控
1. 更新docker-compose配置
2. 添加监控和日志
3. 性能测试和优化

## 11. 未来扩展

### 11.1 通知功能
- 邮件通知
- Webhook集成
- 钉钉/企业微信/Slack集成

### 11.2 高级调度策略
- 基于依赖的调度（测试A成功后执行测试B）
- 事件触发调度（代码部署后自动运行）
- 资源感知调度（根据系统负载动态调整）

### 11.3 分析和报告
- 趋势分析（成功率变化）
- 失败模式识别
- 性能退化检测

## 12. 风险和缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Celery Beat单点故障 | 调度任务丢失 | 使用Redis作为持久化backend，配置持久化beat schedule |
| 数据库连接池耗尽 | 执行失败 | 使用连接池监控，设置合理的max_overflow |
| cron表达式错误 | 调度不执行 | 前端验证 + 后端验证，提供预设选项 |
| 并发执行冲突 | 资源竞争 | 默认禁止并发，提供配置选项 |
| 测试执行时间过长 | 队列积压 | 设置任务过期时间，实施监控告警 |

## 13. 总结

本设计文档详细描述了测试用例定时触发功能的完整实现方案。主要特点：

- **灵活的调度策略**: 支持单个测试、测试套件、动态标签过滤
- **用户友好的配置**: 预设选项 + 自定义cron表达式
- **健壮的执行管理**: 执行限制、自动重试、完整的历史记录
- **可扩展架构**: 基于现有Celery Beat，易于维护和扩展
- **完善的监控**: 日志、指标、健康检查

通过分阶段实施，可以逐步交付功能，降低实施风险。
