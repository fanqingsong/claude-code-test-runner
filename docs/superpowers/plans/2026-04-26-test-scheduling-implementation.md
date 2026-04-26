# 测试用例定时触发功能实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为测试管理系统添加完整的定时触发功能，支持单个测试用例和测试套件的定时调度，包含执行历史记录、自动重试和并发控制。

**Architecture:** 基于现有Celery Beat架构的数据库驱动调度系统。通过PostgreSQL存储调度配置，Schedule Manager定期同步配置到Celery Beat，Celery Workers执行测试并保存结果到数据库。

**Tech Stack:** Python 3.11+, FastAPI, SQLAlchemy 2.0, Celery 5.3, Redis 7, PostgreSQL 15, Docker Compose, Alembic

---

## 文件结构

### 新建文件
```
docker-compose/scheduler-service/app/
├── models/
│   ├── __init__.py (修改)
│   ├── test_suite.py (新建)
│   ├── schedule.py (新建)
│   └── test_run.py (新建)
├── schemas/
│   ├── __init__.py (修改)
│   ├── test_suites.py (新建)
│   └── schedules.py (修改)
├── services/
│   ├── __init__.py (修改)
│   ├── schedule_manager.py (新建)
│   └── execution_service.py (新建)
├── api/v1/endpoints/
│   ├── __init__.py (修改)
│   ├── test_suites.py (新建)
│   └── schedules.py (修改)
├── tasks/
│   ├── __init__.py (修改)
│   ├── test_execution.py (修改)
│   └── schedule_sync.py (新建)
└── tests/ (新建测试目录)
    ├── test_models.py
    ├── test_schemas.py
    ├── test_schedule_manager.py
    └── test_execution_service.py
```

### 修改文件
```
docker-compose/
├── docker-compose.yml (添加scheduler-beat服务)
└── scheduler-service/
    ├── alembic/versions/ (新建迁移文件)
    └── app/main.py (注册新路由)
```

---

## Task 1: 数据库迁移 - 创建调度相关表

**Files:**
- Create: `docker-compose/scheduler-service/alembic/versions/2026_04_26_add_scheduling_tables.py`

- [ ] **Step 1: 创建Alembic迁移文件**

```bash
cd docker-compose/scheduler-service
alembic revision -m "add scheduling tables"
```

- [ ] **Step 2: 编写迁移脚本**

编辑生成的迁移文件（路径类似 `alembic/versions/xxxx_add_scheduling_tables.py`）：

```python
# add scheduling tables
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0001'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    # 创建test_suites表
    op.create_table(
        'test_suites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('test_definition_ids', postgresql.ARRAY(sa.Integer()), nullable=False),
        sa.Column('tags', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_test_suites_id'), 'test_suites', ['id'])

    # 创建schedules表
    op.create_table(
        'schedules',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('schedule_type', sa.String(length=20), nullable=False),
        sa.Column('test_definition_id', sa.Integer(), nullable=True),
        sa.Column('test_suite_id', sa.Integer(), nullable=True),
        sa.Column('tag_filter', sa.String(length=100), nullable=True),
        sa.Column('preset_type', sa.String(length=50), nullable=True),
        sa.Column('cron_expression', sa.String(length=100), nullable=False),
        sa.Column('timezone', sa.String(length=50), nullable=True),
        sa.Column('environment_overrides', postgresql.JSONB(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True),
        sa.Column('allow_concurrent', sa.Boolean(), nullable=True),
        sa.Column('max_retries', sa.Integer(), nullable=True),
        sa.Column('retry_interval_seconds', sa.Integer(), nullable=True),
        sa.Column('next_run_time', sa.DateTime(), nullable=True),
        sa.Column('last_run_time', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['test_suite_id'], ['test_suites.id'])
    )
    op.create_index(op.f('ix_schedules_id'), 'schedules', ['id'])
    op.create_index(op.f('ix_schedules_schedule_type'), 'schedules', ['schedule_type'])
    op.create_index(op.f('ix_schedules_is_active'), 'schedules', ['is_active'])

    # 创建test_runs表
    op.create_table(
        'test_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('schedule_id', sa.Integer(), nullable=True),
        sa.Column('test_definition_id', sa.Integer(), nullable=True),
        sa.Column('run_id', sa.String(length=100), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('start_time', sa.DateTime(), nullable=True),
        sa.Column('end_time', sa.DateTime(), nullable=True),
        sa.Column('total_duration_ms', sa.BigInteger(), nullable=True),
        sa.Column('total_tests', sa.Integer(), nullable=True),
        sa.Column('passed', sa.Integer(), nullable=True),
        sa.Column('failed', sa.Integer(), nullable=True),
        sa.Column('skipped', sa.Integer(), nullable=True),
        sa.Column('test_cases', postgresql.JSONB(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=True),
        sa.Column('is_retry', sa.Boolean(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['schedule_id'], ['schedules.id'])
    )
    op.create_index(op.f('ix_test_runs_id'), 'test_runs', ['id'])
    op.create_index(op.f('ix_test_runs_schedule_id_created_at'), 'test_runs', ['schedule_id', 'created_at'])
    op.create_index(op.f('ix_test_runs_status_created_at'), 'test_runs', ['status', 'created_at'])
    op.create_index(op.f('ix_test_runs_run_id'), 'test_runs', ['run_id'], unique=True)

def downgrade():
    op.drop_index(op.f('ix_test_runs_run_id'), table_name='test_runs')
    op.drop_index(op.f('ix_test_runs_status_created_at'), table_name='test_runs')
    op.drop_index(op.f('ix_test_runs_schedule_id_created_at'), table_name='test_runs')
    op.drop_index(op.f('ix_test_runs_id'), table_name='test_runs')
    op.drop_table('test_runs')

    op.drop_index(op.f('ix_schedules_is_active'), table_name='schedules')
    op.drop_index(op.f('ix_schedules_schedule_type'), table_name='schedules')
    op.drop_index(op.f('ix_schedules_id'), table_name='schedules')
    op.drop_table('schedules')

    op.drop_index(op.f('ix_test_suites_id'), table_name='test_suites')
    op.drop_table('test_suites')
```

- [ ] **Step 3: 运行迁移**

```bash
cd docker-compose/scheduler-service
alembic upgrade head
```

预期输出：`Running upgrade -> 2026_04_26_add_scheduling_tables`

- [ ] **Step 4: 验证表创建**

```bash
docker exec -it cc-test-postgres psql -U postgres -d testdb -c "\dt"
```

预期输出：应该看到 `test_suites`, `schedules`, `test_runs` 三个表

- [ ] **Step 5: 提交**

```bash
git add docker-compose/scheduler-service/alembic/versions/
git commit -m "feat: add database migration for scheduling tables"
```

---

## Task 2: 创建ORM模型 - TestSuite

**Files:**
- Create: `docker-compose/scheduler-service/app/models/test_suite.py`
- Modify: `docker-compose/scheduler-service/app/models/__init__.py`

- [ ] **Step 1: 编写TestSuite模型**

创建 `docker-compose/scheduler-service/app/models/test_suite.py`：

```python
"""
Test Suite ORM Model

Represents a static group of test definitions that can be scheduled together.
"""

from datetime import datetime
from typing import List

from sqlalchemy import ARRAY, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TestSuite(Base):
    """
    Test Suite Model

    Represents a static collection of test definitions that can be
    scheduled and executed together.
    """

    __tablename__ = "test_suites"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Basic fields
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    test_definition_ids: Mapped[List[int]] = mapped_column(
        ARRAY(Integer),
        nullable=False,
        default=[]
    )

    # Metadata
    tags: Mapped[dict] = mapped_column(JSONB, default={}, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow
    )
    created_by: Mapped[str] = mapped_column(String(100), default="system", nullable=False)

    def __repr__(self) -> str:
        return f"<TestSuite(id={self.id}, name='{self.name}', tests={len(self.test_definition_ids)})>"
```

- [ ] **Step 2: 更新models/__init__.py**

编辑 `docker-compose/scheduler-service/app/models/__init__.py`：

```python
from app.models.test_suite import TestSuite

__all__ = ["TestSuite"]
```

- [ ] **Step 3: 编写单元测试**

创建 `docker-compose/scheduler-service/app/tests/test_models.py`：

```python
import pytest
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.test_suite import TestSuite


@pytest.mark.asyncio
async def test_create_test_suite(db_session: AsyncSession):
    """Test creating a test suite"""
    suite = TestSuite(
        name="Regression Suite",
        description="Core regression tests",
        test_definition_ids=[1, 2, 3],
        tags={"category": "regression"}
    )

    db_session.add(suite)
    await db_session.commit()
    await db_session.refresh(suite)

    assert suite.id is not None
    assert suite.name == "Regression Suite"
    assert len(suite.test_definition_ids) == 3
    assert suite.tags["category"] == "regression"
    assert suite.created_at is not None


@pytest.mark.asyncio
async def test_test_suite_repr(db_session: AsyncSession):
    """Test TestSuite __repr__ method"""
    suite = TestSuite(
        name="Test Suite",
        test_definition_ids=[1, 2]
    )

    db_session.add(suite)
    await db_session.commit()

    repr_str = repr(suite)
    assert "TestSuite" in repr_str
    assert "Test Suite" in repr_str
```

- [ ] **Step 4: 运行测试**

```bash
cd docker-compose/scheduler-service
pytest app/tests/test_models.py::test_create_test_suite -v
```

预期输出：`PASSED`

- [ ] **Step 5: 提交**

```bash
git add docker-compose/scheduler-service/app/models/
git add docker-compose/scheduler-service/app/tests/test_models.py
git commit -m "feat: add TestSuite ORM model"
```

---

## Task 3: 创建ORM模型 - Schedule

**Files:**
- Create: `docker-compose/scheduler-service/app/models/schedule.py`

- [ ] **Step 1: 编写Schedule模型**

创建 `docker-compose/scheduler-service/app/models/schedule.py`：

```python
"""
Schedule ORM Model

Represents a test execution schedule with cron-based timing.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from sqlalchemy.dialects.postgresql import JSONB
from app.core.database import Base


class Schedule(Base):
    """
    Schedule Model

    Represents a scheduled test execution with timing configuration,
    target selection, and execution constraints.
    """

    __tablename__ = "schedules"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Basic fields
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    schedule_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # Target configuration (mutually exclusive based on schedule_type)
    test_definition_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    test_suite_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tag_filter: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)

    # Schedule configuration
    preset_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    cron_expression: Mapped[str] = mapped_column(String(100), nullable=False)
    timezone: Mapped[str] = mapped_column(String(50), default="UTC", nullable=False)

    # Environment and execution configuration
    environment_overrides: Mapped[dict] = mapped_column(JSONB, default={}, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    allow_concurrent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    max_retries: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    retry_interval_seconds: Mapped[int] = mapped_column(Integer, default=60, nullable=False)

    # Timestamps
    next_run_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_run_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        server_default=func.now(),
        onupdate=datetime.utcnow
    )
    created_by: Mapped[str] = mapped_column(String(100), default="system", nullable=False)

    def __repr__(self) -> str:
        return f"<Schedule(id={self.id}, name='{self.name}', type='{self.schedule_type}', active={self.is_active})>"
```

- [ ] **Step 2: 添加到models/__init__.py**

编辑 `docker-compose/scheduler-service/app/models/__init__.py`：

```python
from app.models.test_suite import TestSuite
from app.models.schedule import Schedule

__all__ = ["TestSuite", "Schedule"]
```

- [ ] **Step 3: 添加单元测试**

在 `docker-compose/scheduler-service/app/tests/test_models.py` 中添加：

```python
@pytest.mark.asyncio
async def test_create_schedule(db_session: AsyncSession):
    """Test creating a schedule"""
    schedule = Schedule(
        name="Daily Regression",
        schedule_type="single",
        test_definition_id=1,
        cron_expression="0 9 * * *",
        timezone="UTC",
        is_active=True,
        allow_concurrent=False,
        max_retries=2
    )

    db_session.add(schedule)
    await db_session.commit()
    await db_session.refresh(schedule)

    assert schedule.id is not None
    assert schedule.name == "Daily Regression"
    assert schedule.schedule_type == "single"
    assert schedule.cron_expression == "0 9 * * *"
    assert schedule.is_active is True
    assert schedule.max_retries == 2


@pytest.mark.asyncio
async def test_schedule_suite_type(db_session: AsyncSession):
    """Test schedule with suite type"""
    schedule = Schedule(
        name="Weekly Suite Run",
        schedule_type="suite",
        test_suite_id=1,
        cron_expression="0 9 * * 1",
        environment_overrides={"BASE_URL": "https://staging.example.com"}
    )

    db_session.add(schedule)
    await db_session.commit()

    assert schedule.schedule_type == "suite"
    assert schedule.environment_overrides["BASE_URL"] == "https://staging.example.com"
```

- [ ] **Step 4: 运行测试**

```bash
cd docker-compose/scheduler-service
pytest app/tests/test_models.py::test_create_schedule -v
```

预期输出：`PASSED`

- [ ] **Step 5: 提交**

```bash
git add docker-compose/scheduler-service/app/models/schedule.py
git add docker-compose/scheduler-service/app/tests/test_models.py
git commit -m "feat: add Schedule ORM model"
```

---

## Task 4: 创建ORM模型 - TestRun

**Files:**
- Create: `docker-compose/scheduler-service/app/models/test_run.py`

- [ ] **Step 1: 编写TestRun模型**

创建 `docker-compose/scheduler-service/app/models/test_run.py`：

```python
"""
Test Run ORM Model

Records the execution history of scheduled tests.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Boolean, DateTime, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TestRun(Base):
    """
    Test Run Model

    Records the execution details and results of a scheduled test run.
    """

    __tablename__ = "test_runs"

    # Primary key
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)

    # Foreign keys
    schedule_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    test_definition_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    # Run identification
    run_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, index=True)

    # Execution timing
    start_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    total_duration_ms: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)

    # Result statistics
    total_tests: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    passed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    skipped: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Detailed results
    test_cases: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Retry information
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_retry: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Timestamps
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        server_default=func.now()
    )

    def __repr__(self) -> str:
        return f"<TestRun(id={self.id}, run_id='{self.run_id}', status='{self.status}')>"
```

- [ ] **Step 2: 添加到models/__init__.py**

编辑 `docker-compose/scheduler-service/app/models/__init__.py`：

```python
from app.models.test_suite import TestSuite
from app.models.schedule import Schedule
from app.models.test_run import TestRun

__all__ = ["TestSuite", "Schedule", "TestRun"]
```

- [ ] **Step 3: 添加单元测试**

在 `docker-compose/scheduler-service/app/tests/test_models.py` 中添加：

```python
@pytest.mark.asyncio
async def test_create_test_run(db_session: AsyncSession):
    """Test creating a test run"""
    run = TestRun(
        schedule_id=1,
        test_definition_id=1,
        run_id="schedule_1_test_1_1234567890",
        status="passed",
        start_time=datetime.utcnow(),
        end_time=datetime.utcnow(),
        total_duration_ms=45000,
        total_tests=10,
        passed=10,
        failed=0,
        skipped=0
    )

    db_session.add(run)
    await db_session.commit()
    await db_session.refresh(run)

    assert run.id is not None
    assert run.status == "passed"
    assert run.total_tests == 10
    assert run.passed == 10
    assert run.failed == 0


@pytest.mark.asyncio
async def test_test_run_with_failure(db_session: AsyncSession):
    """Test test run with failure details"""
    run = TestRun(
        schedule_id=1,
        run_id="failed_run_123",
        status="failed",
        error_message="Element not found: #submit-button",
        test_cases=[
            {"step_number": 1, "status": "passed"},
            {"step_number": 2, "status": "failed", "error": "Element not found"}
        ]
    )

    db_session.add(run)
    await db_session.commit()

    assert run.status == "failed"
    assert run.error_message is not None
    assert run.test_cases is not None
    assert len(run.test_cases) == 2
```

- [ ] **Step 4: 运行测试**

```bash
cd docker-compose/scheduler-service
pytest app/tests/test_models.py::test_create_test_run -v
```

预期输出：`PASSED`

- [ ] **Step 5: 提交**

```bash
git add docker-compose/scheduler-service/app/models/test_run.py
git add docker-compose/scheduler-service/app/tests/test_models.py
git commit -m "feat: add TestRun ORM model"
```

---

## Task 5: 创建Pydantic Schemas - TestSuites

**Files:**
- Create: `docker-compose/scheduler-service/app/schemas/test_suites.py`

- [ ] **Step 1: 编写TestSuite schemas**

创建 `docker-compose/scheduler-service/app/schemas/test_suites.py`：

```python
"""
Pydantic Schemas for Test Suite Management
"""

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict


class TestSuiteBase(BaseModel):
    """Base schema for TestSuite"""
    name: str = Field(..., min_length=1, max_length=255, description="Suite name")
    description: Optional[str] = Field(None, description="Suite description")
    test_definition_ids: List[int] = Field(
        ...,
        min_length=1,
        description="List of test definition IDs in this suite"
    )
    tags: dict = Field(default_factory=dict, description="Metadata tags")


class TestSuiteCreate(TestSuiteBase):
    """Schema for creating a new test suite"""
    pass


class TestSuiteUpdate(BaseModel):
    """Schema for updating a test suite"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    test_definition_ids: Optional[List[int]] = Field(None, min_length=1)
    tags: Optional[dict] = None


class TestSuiteResponse(TestSuiteBase):
    """Schema for test suite response"""
    id: int
    created_at: datetime
    updated_at: datetime
    created_by: str

    model_config = ConfigDict(from_attributes=True)
```

- [ ] **Step 2: 更新schemas/__init__.py**

编辑 `docker-compose/scheduler-service/app/schemas/__init__.py`：

```python
from app.schedules.test_suites import (
    TestSuiteCreate,
    TestSuiteUpdate,
    TestSuiteResponse
)

__all__ = [
    "TestSuiteCreate",
    "TestSuiteUpdate",
    "TestSuiteResponse"
]
```

- [ ] **Step 3: 编写schema验证测试**

创建 `docker-compose/scheduler-service/app/tests/test_schemas.py`：

```python
import pytest
from pydantic import ValidationError

from app.schemas.test_suites import TestSuiteCreate, TestSuiteUpdate


def test_test_suite_create_valid():
    """Test valid TestSuiteCreate schema"""
    data = {
        "name": "Regression Suite",
        "description": "Core regression tests",
        "test_definition_ids": [1, 2, 3],
        "tags": {"category": "regression"}
    }

    suite = TestSuiteCreate(**data)
    assert suite.name == "Regression Suite"
    assert len(suite.test_definition_ids) == 3
    assert suite.tags["category"] == "regression"


def test_test_suite_create_empty_name_fails():
    """Test that empty name fails validation"""
    data = {
        "name": "",
        "test_definition_ids": [1]
    }

    with pytest.raises(ValidationError):
        TestSuiteCreate(**data)


def test_test_suite_create_empty_test_ids_fails():
    """Test that empty test_definition_ids fails validation"""
    data = {
        "name": "Test Suite",
        "test_definition_ids": []
    }

    with pytest.raises(ValidationError):
        TestSuiteCreate(**data)


def test_test_suite_update_partial():
    """Test partial update with TestSuiteUpdate"""
    data = {
        "name": "Updated Name"
    }

    update = TestSuiteUpdate(**data)
    assert update.name == "Updated Name"
    assert update.description is None
    assert update.test_definition_ids is None
```

- [ ] **Step 4: 运行测试**

```bash
cd docker-compose/scheduler-service
pytest app/tests/test_schemas.py::test_test_suite_create_valid -v
```

预期输出：`PASSED`

- [ ] **Step 5: 提交**

```bash
git add docker-compose/scheduler-service/app/schemas/
git add docker-compose/scheduler-service/app/tests/test_schemas.py
git commit -m "feat: add TestSuite Pydantic schemas"
```

---

## Task 6: 更新Schedule Schemas

**Files:**
- Modify: `docker-compose/scheduler-service/app/schemas/schedules.py`

- [ ] **Step 1: 完整重写schedules.py**

完全替换 `docker-compose/scheduler-service/app/schemas/schedules.py` 的内容：

```python
"""
Pydantic Schemas for Schedule Management
"""

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing_extensions import Literal


class ScheduleCreate(BaseModel):
    """Schema for creating a new schedule"""
    name: str = Field(..., min_length=1, max_length=255, description="Schedule name")
    schedule_type: Literal["single", "suite", "tag_filter"] = Field(
        ...,
        description="Type of schedule target"
    )

    # Target configuration (based on schedule_type)
    test_definition_id: Optional[int] = Field(None, description="Test definition ID for single type")
    test_suite_id: Optional[int] = Field(None, description="Test suite ID for suite type")
    tag_filter: Optional[str] = Field(None, description="Tag filter for dynamic grouping")

    # Schedule configuration
    preset_type: Optional[str] = Field(
        None,
        description="Preset schedule type (hourly, daily, weekly, etc.)"
    )
    cron_expression: str = Field(
        ...,
        description="Cron expression for scheduling",
        pattern=r"^[\d\*\/\-,]+\s+[\d\*\/\-,]+\s+[\d\*\/\-,]+\s+[\d\*\/\-,]+\s+[\d\*\/\-,]+$"
    )
    timezone: str = Field(default="UTC", description="Timezone for schedule")

    # Environment and execution configuration
    environment_overrides: dict = Field(
        default_factory=dict,
        description="Environment variable overrides"
    )
    is_active: bool = Field(default=True, description="Whether schedule is active")
    allow_concurrent: bool = Field(default=False, description="Allow concurrent executions")
    max_retries: int = Field(
        default=0,
        ge=0,
        le=10,
        description="Maximum number of retries"
    )
    retry_interval_seconds: int = Field(
        default=60,
        ge=10,
        le=3600,
        description="Seconds between retries"
    )

    @field_validator('schedule_type')
    @classmethod
    def validate_target_config(cls, v, info):
        """Validate that appropriate target field is provided"""
        if v == 'single':
            if info.data.get('test_definition_id') is None:
                raise ValueError('schedule_type=single requires test_definition_id')
        elif v == 'suite':
            if info.data.get('test_suite_id') is None:
                raise ValueError('schedule_type=suite requires test_suite_id')
        elif v == 'tag_filter':
            if info.data.get('tag_filter') is None:
                raise ValueError('schedule_type=tag_filter requires tag_filter')
        return v


class ScheduleUpdate(BaseModel):
    """Schema for updating a schedule"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    schedule_type: Optional[Literal["single", "suite", "tag_filter"]] = None
    test_definition_id: Optional[int] = None
    test_suite_id: Optional[int] = None
    tag_filter: Optional[str] = None
    preset_type: Optional[str] = None
    cron_expression: Optional[str] = Field(
        None,
        pattern=r"^[\d\*\/\-,]+\s+[\d\*\/\-,]+\s+[\d\*\/\-,]+\s+[\d\*\/\-,]+\s+[\d\*\/\-,]+$"
    )
    timezone: Optional[str] = None
    environment_overrides: Optional[dict] = None
    is_active: Optional[bool] = None
    allow_concurrent: Optional[bool] = None
    max_retries: Optional[int] = Field(None, ge=0, le=10)
    retry_interval_seconds: Optional[int] = Field(None, ge=10, le=3600)


class ScheduleResponse(BaseModel):
    """Schema for schedule response"""
    id: int
    name: str
    schedule_type: str
    test_definition_id: Optional[int]
    test_suite_id: Optional[int]
    tag_filter: Optional[str]
    preset_type: Optional[str]
    cron_expression: str
    timezone: str
    environment_overrides: dict
    is_active: bool
    allow_concurrent: bool
    max_retries: int
    retry_interval_seconds: int
    next_run_time: Optional[datetime]
    last_run_time: Optional[datetime]
    created_at: datetime
    updated_at: datetime
    created_by: str

    model_config = ConfigDict(from_attributes=True)


class ScheduleToggle(BaseModel):
    """Schema for toggling schedule active status"""
    is_active: bool = Field(..., description="New active status")


class SchedulePreset(BaseModel):
    """Schema for schedule preset option"""
    type: str = Field(..., description="Preset type identifier")
    name: str = Field(..., description="Human-readable name")
    cron: str = Field(..., description="Cron expression")
    description: str = Field(..., description="Description of what this preset does")


class SchedulePresetsResponse(BaseModel):
    """Schema for presets list response"""
    presets: List[SchedulePreset]


class ScheduleTriggerResponse(BaseModel):
    """Schema for manual trigger response"""
    run_id: str = Field(..., description="Generated run ID")
    status: str = Field(..., description="Initial status")
```

- [ ] **Step 2: 更新schemas/__init__.py**

编辑 `docker-compose/scheduler-service/app/schemas/__init__.py`：

```python
from app.schemas.test_suites import (
    TestSuiteCreate,
    TestSuiteUpdate,
    TestSuiteResponse
)
from app.schemas.schedules import (
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleResponse,
    ScheduleToggle,
    SchedulePresetsResponse,
    ScheduleTriggerResponse
)

__all__ = [
    "TestSuiteCreate",
    "TestSuiteUpdate",
    "TestSuiteResponse",
    "ScheduleCreate",
    "ScheduleUpdate",
    "ScheduleResponse",
    "ScheduleToggle",
    "SchedulePresetsResponse",
    "ScheduleTriggerResponse"
]
```

- [ ] **Step 3: 添加schema验证测试**

在 `docker-compose/scheduler-service/app/tests/test_schemas.py` 中添加：

```python
from app.schemas.schedules import ScheduleCreate, ScheduleUpdate


def test_schedule_create_single_type():
    """Test creating schedule for single test"""
    data = {
        "name": "Daily Test",
        "schedule_type": "single",
        "test_definition_id": 1,
        "cron_expression": "0 9 * * *"
    }

    schedule = ScheduleCreate(**data)
    assert schedule.schedule_type == "single"
    assert schedule.test_definition_id == 1


def test_schedule_create_single_type_missing_id_fails():
    """Test that single type without test_definition_id fails"""
    data = {
        "name": "Daily Test",
        "schedule_type": "single",
        "cron_expression": "0 9 * * *"
    }

    with pytest.raises(ValidationError) as exc_info:
        ScheduleCreate(**data)

    assert "requires test_definition_id" in str(exc_info.value)


def test_schedule_create_suite_type():
    """Test creating schedule for test suite"""
    data = {
        "name": "Weekly Suite",
        "schedule_type": "suite",
        "test_suite_id": 1,
        "cron_expression": "0 9 * * 1",
        "max_retries": 3
    }

    schedule = ScheduleCreate(**data)
    assert schedule.schedule_type == "suite"
    assert schedule.max_retries == 3


def test_schedule_create_invalid_cron_fails():
    """Test that invalid cron expression fails"""
    data = {
        "name": "Test",
        "schedule_type": "single",
        "test_definition_id": 1,
        "cron_expression": "invalid-cron"
    }

    with pytest.raises(ValidationError):
        ScheduleCreate(**data)


def test_schedule_retries_out_of_range():
    """Test that retries outside 0-10 range fails"""
    data = {
        "name": "Test",
        "schedule_type": "single",
        "test_definition_id": 1,
        "cron_expression": "0 9 * * *",
        "max_retries": 15  # Too high
    }

    with pytest.raises(ValidationError):
        ScheduleCreate(**data)
```

- [ ] **Step 4: 运行测试**

```bash
cd docker-compose/scheduler-service
pytest app/tests/test_schemas.py::test_schedule_create_single_type -v
```

预期输出：`PASSED`

- [ ] **Step 5: 提交**

```bash
git add docker-compose/scheduler-service/app/schemas/schedules.py
git add docker-compose/scheduler-service/app/schemas/__init__.py
git add docker-compose/scheduler-service/app/tests/test_schemas.py
git commit -m "feat: update Schedule Pydantic schemas with validation"
```

---

## Task 7: 创建Schedule Manager服务

**Files:**
- Create: `docker-compose/scheduler-service/app/services/schedule_manager.py`

- [ ] **Step 1: 创建schedule_manager.py**

创建 `docker-compose/scheduler-service/app/services/schedule_manager.py`：

```python
"""
Schedule Manager Service

Manages synchronization between database schedules and Celery Beat.
"""

import logging
from datetime import datetime
from typing import List, Optional

from croniter import croniter
from celery.schedules import Crontab
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.schedule import Schedule

logger = logging.getLogger(__name__)


class ScheduleManager:
    """
    Manages schedule synchronization to Celery Beat.

    Responsible for:
    - Reading active schedules from database
    - Validating cron expressions
    - Updating Celery Beat configuration
    - Calculating next run times
    """

    def __init__(self, db_session: AsyncSession, celery_app):
        """
        Initialize Schedule Manager.

        Args:
            db_session: Async database session
            celery_app: Celery application instance
        """
        self.db = db_session
        self.celery_app = celery_app

    async def get_active_schedules(self) -> List[Schedule]:
        """
        Retrieve all active schedules from database.

        Returns:
            List of active Schedule objects
        """
        stmt = select(Schedule).where(Schedule.is_active == True)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    def validate_cron(self, cron_expression: str) -> bool:
        """
        Validate cron expression format.

        Args:
            cron_expression: Cron expression to validate

        Returns:
            True if valid, False otherwise
        """
        try:
            # Try to create a croniter instance
            base_time = datetime.utcnow()
            croniter(cron_expression, base_time)
            return True
        except (ValueError, KeyError):
            return False

    async def update_next_run_time(self, schedule: Schedule) -> None:
        """
        Calculate and update next run time for a schedule.

        Args:
            schedule: Schedule object to update
        """
        try:
            cron = croniter(schedule.cron_expression, datetime.utcnow())
            next_time = cron.get_next(datetime)
            schedule.next_run_time = next_time
            await self.db.commit()
        except Exception as e:
            logger.error(f"Failed to calculate next run time for schedule {schedule.id}: {e}")
            raise

    def parse_cron_expression(self, cron_expr: str) -> tuple:
        """
        Parse cron expression into Celery Crontab components.

        Args:
            cron_expr: Standard cron expression (5 fields)

        Returns:
            Tuple of (minute, hour, day_of_month, month_of_year, day_of_week)
        """
        parts = cron_expr.split()
        if len(parts) != 5:
            raise ValueError(f"Cron expression must have 5 parts, got {len(parts)}")

        return tuple(parts)

    async def sync_schedules(self) -> dict:
        """
        Synchronize all active schedules to Celery Beat configuration.

        Returns:
            Dictionary with sync status information
        """
        schedules = await self.get_active_schedules()

        beat_schedule = {}
        skipped = []

        for schedule in schedules:
            # Validate cron expression
            if not self.validate_cron(schedule.cron_expression):
                logger.warning(f"Invalid cron for schedule {schedule.id}: {schedule.cron_expression}")
                skipped.append({
                    'schedule_id': schedule.id,
                    'reason': 'Invalid cron expression'
                })
                continue

            # Build Celery Beat task configuration
            task_name = f"scheduled_test_{schedule.id}"

            try:
                cron_parts = self.parse_cron_expression(schedule.cron_expression)
                beat_schedule[task_name] = {
                    'task': 'app.tasks.test_execution.execute_scheduled_test',
                    'schedule': Crontab(*cron_parts),
                    'args': [schedule.id],
                    'options': {
                        'expires': 300  # Task expires after 5 minutes
                    }
                }

                # Update next run time in database
                await self.update_next_run_time(schedule)

                logger.info(f"Synced schedule {schedule.id} ({schedule.name}) to Celery Beat")

            except Exception as e:
                logger.error(f"Failed to sync schedule {schedule.id}: {e}")
                skipped.append({
                    'schedule_id': schedule.id,
                    'reason': str(e)
                })

        # Apply to Celery configuration
        self.celery_app.conf.beat_schedule = beat_schedule

        logger.info(f"Synced {len(beat_schedule)} schedules to Celery Beat")

        return {
            'synced': len(beat_schedule),
            'skipped': len(skipped),
            'skipped_details': skipped
        }
```

- [ ] **Step 2: 创建services/__init__.py**

创建 `docker-compose/scheduler-service/app/services/__init__.py`：

```python
from app.services.schedule_manager import ScheduleManager

__all__ = ["ScheduleManager"]
```

- [ ] **Step 3: 添加单元测试**

创建 `docker-compose/scheduler-service/app/tests/test_schedule_manager.py`：

```python
import pytest
from unittest.mock import Mock, MagicMock
from datetime import datetime

from app.services.schedule_manager import ScheduleManager
from app.models.schedule import Schedule


@pytest.mark.asyncio
async def test_get_active_schedules(db_session):
    """Test retrieving active schedules"""
    # Create test schedules
    active_schedule = Schedule(
        name="Active Schedule",
        schedule_type="single",
        test_definition_id=1,
        cron_expression="0 9 * * *",
        is_active=True
    )

    inactive_schedule = Schedule(
        name="Inactive Schedule",
        schedule_type="single",
        test_definition_id=2,
        cron_expression="0 10 * * *",
        is_active=False
    )

    db_session.add(active_schedule)
    db_session.add(inactive_schedule)
    await db_session.commit()

    # Test
    mock_celery = Mock()
    manager = ScheduleManager(db_session, mock_celery)
    active_schedules = await manager.get_active_schedules()

    assert len(active_schedules) == 1
    assert active_schedules[0].name == "Active Schedule"


def test_validate_cron_valid():
    """Test cron validation with valid expressions"""
    manager = ScheduleManager(None, None)

    assert manager.validate_cron("0 9 * * *") is True
    assert manager.validate_cron("*/5 * * * *") is True
    assert manager.validate_cron("0 9 * * 1") is True


def test_validate_cron_invalid():
    """Test cron validation with invalid expressions"""
    manager = ScheduleManager(None, None)

    assert manager.validate_cron("invalid") is False
    assert manager.validate_cron("60 * * * *") is False  # Invalid minute


def test_parse_cron_expression():
    """Test parsing cron expression"""
    manager = ScheduleManager(None, None)

    parts = manager.parse_cron_expression("0 9 * * 1")
    assert parts == ("0", "9", "*", "*", "1")


def test_parse_cron_expression_invalid():
    """Test parsing invalid cron expression"""
    manager = ScheduleManager(None, None)

    with pytest.raises(ValueError):
        manager.parse_cron_expression("0 9 * *")  # Only 4 parts
```

- [ ] **Step 4: 运行测试**

```bash
cd docker-compose/scheduler-service
pytest app/tests/test_schedule_manager.py::test_validate_cron_valid -v
```

预期输出：`PASSED`

- [ ] **Step 5: 提交**

```bash
git add docker-compose/scheduler-service/app/services/
git add docker-compose/scheduler-service/app/tests/test_schedule_manager.py
git commit -m "feat: add ScheduleManager service for Celery Beat sync"
```

---

## Task 8: 创建Execution Service服务

**Files:**
- Create: `docker-compose/scheduler-service/app/services/execution_service.py`

- [ ] **Step 1: 创建execution_service.py**

创建 `docker-compose/scheduler-service/app/services/execution_service.py`：

```python
"""
Execution Service

Handles test execution logic for scheduled tasks.
"""

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.schedule import Schedule
from app.models.test_run import TestRun
from app.models.test_suite import TestSuite

logger = logging.getLogger(__name__)


class ExecutionService:
    """
    Service for managing test execution for scheduled tasks.

    Responsible for:
    - Resolving target test definitions
    - Checking execution limits
    - Building environment configurations
    - Managing run state
    """

    def __init__(self, db_session: AsyncSession):
        """
        Initialize Execution Service.

        Args:
            db_session: Async database session
        """
        self.db = db_session

    async def resolve_target_tests(self, schedule: Schedule) -> List[int]:
        """
        Resolve target test definition IDs based on schedule type.

        Args:
            schedule: Schedule object

        Returns:
            List of test definition IDs to execute

        Raises:
            ValueError: If schedule_type is unknown
        """
        if schedule.schedule_type == 'single':
            return [schedule.test_definition_id]

        elif schedule.schedule_type == 'suite':
            # Load test suite
            stmt = select(TestSuite).where(TestSuite.id == schedule.test_suite_id)
            result = await self.db.execute(stmt)
            suite = result.scalar_one_or_none()

            if not suite:
                raise ValueError(f"Test suite {schedule.test_suite_id} not found")

            return suite.test_definition_ids

        elif schedule.schedule_type == 'tag_filter':
            # Dynamic tag filtering - query test-case-service
            # For now, return empty as this requires external API call
            logger.warning(f"Tag filter not yet implemented for schedule {schedule.id}")
            return []

        else:
            raise ValueError(f"Unknown schedule_type: {schedule.schedule_type}")

    async def check_execution_limit(self, schedule_id: int) -> bool:
        """
        Check if execution is allowed based on concurrency settings.

        Args:
            schedule_id: Schedule ID to check

        Returns:
            True if execution is allowed, False otherwise
        """
        # Get schedule to check concurrency setting
        stmt = select(Schedule).where(Schedule.id == schedule_id)
        result = await self.db.execute(stmt)
        schedule = result.scalar_one_or_none()

        if not schedule:
            logger.error(f"Schedule {schedule_id} not found")
            return False

        # If concurrent execution is allowed, always return True
        if schedule.allow_concurrent:
            return True

        # Check for running executions
        stmt = select(func.count(TestRun.id)).where(
            TestRun.schedule_id == schedule_id,
            TestRun.status.in_(['pending', 'running'])
        )
        result = await self.db.execute(stmt)
        running_count = result.scalar()

        if running_count > 0:
            logger.info(
                f"Schedule {schedule_id} has {running_count} running executions, "
                "skipping due to concurrency limit"
            )
            return False

        return True

    def build_environment(
        self,
        schedule: Schedule,
        test_definition_environment: Optional[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Build final execution environment by merging configurations.

        Args:
            schedule: Schedule object with environment_overrides
            test_definition_environment: Base environment from test definition

        Returns:
            Merged environment dictionary
        """
        base_env = test_definition_environment or {}
        overrides = schedule.environment_overrides or {}

        # Overrides take precedence
        return {**base_env, **overrides}

    async def create_test_run(
        self,
        schedule_id: int,
        test_definition_id: int,
        run_id: str
    ) -> TestRun:
        """
        Create a new test run record.

        Args:
            schedule_id: Schedule ID
            test_definition_id: Test definition ID
            run_id: Unique run identifier

        Returns:
            Created TestRun object
        """
        test_run = TestRun(
            schedule_id=schedule_id,
            test_definition_id=test_definition_id,
            run_id=run_id,
            status='pending'
        )

        self.db.add(test_run)
        await self.db.commit()
        await self.db.refresh(test_run)

        logger.info(f"Created test run {run_id} for schedule {schedule_id}")
        return test_run

    async def update_run_status(
        self,
        run_id: str,
        status: str,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None
    ) -> TestRun:
        """
        Update test run status and timestamps.

        Args:
            run_id: Run identifier
            status: New status
            start_time: Optional start time
            end_time: Optional end time

        Returns:
            Updated TestRun object

        Raises:
            ValueError: If status transition is invalid
        """
        stmt = select(TestRun).where(TestRun.run_id == run_id)
        result = await self.db.execute(stmt)
        test_run = result.scalar_one_or_none()

        if not test_run:
            raise ValueError(f"Test run {run_id} not found")

        # Validate status transitions
        valid_transitions = {
            'pending': ['running', 'skipped'],
            'running': ['passed', 'failed', 'skipped'],
            'failed': ['pending']  # Only for retry
        }

        current_status = test_run.status
        if status not in valid_transitions.get(current_status, []):
            raise ValueError(
                f"Invalid status transition: {current_status} -> {status}"
            )

        # Update status and timestamps
        test_run.status = status

        if start_time:
            test_run.start_time = start_time

        if end_time:
            test_run.end_time = end_time

        # Calculate duration if both times are present
        if test_run.start_time and test_run.end_time:
            delta = test_run.end_time - test_run.start_time
            test_run.total_duration_ms = int(delta.total_seconds() * 1000)

        await self.db.commit()
        await self.db.refresh(test_run)

        logger.info(f"Updated test run {run_id} status to {status}")
        return test_run

    async def save_test_results(
        self,
        run_id: str,
        results: Dict[str, Any]
    ) -> TestRun:
        """
        Save test execution results to database.

        Args:
            run_id: Run identifier
            results: Test execution results dictionary

        Returns:
            Updated TestRun object
        """
        stmt = select(TestRun).where(TestRun.run_id == run_id)
        result = await self.db.execute(stmt)
        test_run = result.scalar_one_or_none()

        if not test_run:
            raise ValueError(f"Test run {run_id} not found")

        # Update result fields
        test_run.status = results.get('status', 'unknown')
        test_run.total_tests = results.get('total_tests', 0)
        test_run.passed = results.get('passed', 0)
        test_run.failed = results.get('failed', 0)
        test_run.skipped = results.get('skipped', 0)
        test_run.test_cases = results.get('test_cases')
        test_run.error_message = results.get('error')

        # Update end time if not already set
        if not test_run.end_time:
            end_time = datetime.fromtimestamp(results.get('end_time', 0) / 1000)
            test_run.end_time = end_time

            if test_run.start_time:
                delta = end_time - test_run.start_time
                test_run.total_duration_ms = int(delta.total_seconds() * 1000)

        await self.db.commit()
        await self.db.refresh(test_run)

        logger.info(f"Saved results for test run {run_id}: {test_run.status}")
        return test_run
```

- [ ] **Step 2: 更新services/__init__.py**

编辑 `docker-compose/scheduler-service/app/services/__init__.py`：

```python
from app.services.schedule_manager import ScheduleManager
from app.services.execution_service import ExecutionService

__all__ = ["ScheduleManager", "ExecutionService"]
```

- [ ] **Step 3: 添加单元测试**

创建 `docker-compose/scheduler-service/app/tests/test_execution_service.py`：

```python
import pytest
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.execution_service import ExecutionService
from app.models.schedule import Schedule
from app.models.test_suite import TestSuite


@pytest.mark.asyncio
async def test_resolve_single_test(db_session: AsyncSession):
    """Test resolving single test type"""
    schedule = Schedule(
        name="Single Test",
        schedule_type="single",
        test_definition_id=5,
        cron_expression="0 9 * * *"
    )

    service = ExecutionService(db_session)
    test_ids = await service.resolve_target_tests(schedule)

    assert test_ids == [5]


@pytest.mark.asyncio
async def test_resolve_suite_tests(db_session: AsyncSession):
    """Test resolving suite test type"""
    # Create test suite
    suite = TestSuite(
        name="Test Suite",
        test_definition_ids=[1, 2, 3]
    )

    db_session.add(suite)
    await db_session.commit()

    # Create schedule for suite
    schedule = Schedule(
        name="Suite Schedule",
        schedule_type="suite",
        test_suite_id=suite.id,
        cron_expression="0 9 * * *"
    )

    service = ExecutionService(db_session)
    test_ids = await service.resolve_target_tests(schedule)

    assert test_ids == [1, 2, 3]


@pytest.mark.asyncio
async def test_check_execution_limit_allow_concurrent(db_session: AsyncSession):
    """Test execution check with concurrent allowed"""
    schedule = Schedule(
        name="Concurrent Test",
        schedule_type="single",
        test_definition_id=1,
        cron_expression="0 9 * * *",
        allow_concurrent=True
    )

    db_session.add(schedule)
    await db_session.commit()

    service = ExecutionService(db_session)
    result = await service.check_execution_limit(schedule.id)

    assert result is True


@pytest.mark.asyncio
async def test_build_environment_merge(db_session: AsyncSession):
    """Test environment configuration merging"""
    schedule = Schedule(
        name="Test",
        schedule_type="single",
        test_definition_id=1,
        cron_expression="0 9 * * *",
        environment_overrides={
            "BASE_URL": "https://staging.example.com",
            "TIMEOUT": "30"
        }
    )

    service = ExecutionService(db_session)
    test_env = {"BASE_URL": "https://dev.example.com", "DEBUG": "false"}

    merged = service.build_environment(schedule, test_env)

    assert merged["BASE_URL"] == "https://staging.example.com"  # Overridden
    assert merged["DEBUG"] == "false"  # From base
    assert merged["TIMEOUT"] == "30"  # From override


@pytest.mark.asyncio
async def test_create_test_run(db_session: AsyncSession):
    """Test creating a test run"""
    service = ExecutionService(db_session)

    test_run = await service.create_test_run(
        schedule_id=1,
        test_definition_id=1,
        run_id="test_run_123"
    )

    assert test_run.id is not None
    assert test_run.run_id == "test_run_123"
    assert test_run.status == "pending"


@pytest.mark.asyncio
async def test_update_run_status_valid_transition(db_session: AsyncSession):
    """Test valid status transition"""
    service = ExecutionService(db_session)

    # Create test run
    test_run = await service.create_test_run(1, 1, "test_run_456")

    # Update to running
    updated = await service.update_run_status("test_run_456", "running")

    assert updated.status == "running"
    assert updated.start_time is not None


@pytest.mark.asyncio
async def test_update_run_status_invalid_transition(db_session: AsyncSession):
    """Test invalid status transition"""
    service = ExecutionService(db_session)

    # Create test run
    test_run = await service.create_test_run(1, 1, "test_run_789")

    # Try invalid transition: pending -> passed
    with pytest.raises(ValueError, match="Invalid status transition"):
        await service.update_run_status("test_run_789", "passed")
```

- [ ] **Step 4: 运行测试**

```bash
cd docker-compose/scheduler-service
pytest app/tests/test_execution_service.py::test_resolve_single_test -v
```

预期输出：`PASSED`

- [ ] **Step 5: 提交**

```bash
git add docker-compose/scheduler-service/app/services/execution_service.py
git add docker-compose/scheduler-service/app/tests/test_execution_service.py
git commit -m "feat: add ExecutionService for test execution management"
```

---

## Task 9: 创建TestSuites API端点

**Files:**
- Create: `docker-compose/scheduler-service/app/api/v1/endpoints/test_suites.py`

- [ ] **Step 1: 创建test_suites.py API**

创建 `docker-compose/scheduler-service/app/api/v1/endpoints/test_suites.py`：

```python
"""
Test Suites API Endpoints

CRUD operations for test suite management.
"""

import logging
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.schemas.test_suites import (
    TestSuiteCreate,
    TestSuiteUpdate,
    TestSuiteResponse
)
from app.models.test_suite import TestSuite

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/", response_model=TestSuiteResponse, status_code=status.HTTP_201_CREATED)
async def create_test_suite(
    suite_data: TestSuiteCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new test suite.

    - **name**: Suite name (required)
    - **description**: Optional description
    - **test_definition_ids**: List of test definition IDs (required, min 1)
    - **tags**: Optional metadata tags
    """
    try:
        suite = TestSuite(**suite_data.model_dump())
        db.add(suite)
        await db.commit()
        await db.refresh(suite)

        logger.info(f"Created test suite: {suite.name} (ID: {suite.id})")
        return suite

    except Exception as e:
        logger.error(f"Failed to create test suite: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create test suite: {str(e)}"
        )


@router.get("/", response_model=List[TestSuiteResponse])
async def list_test_suites(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db)
):
    """
    List all test suites.

    - **skip**: Number of suites to skip (pagination)
    - **limit**: Maximum number of suites to return
    """
    try:
        stmt = select(TestSuite).offset(skip).limit(limit)
        result = await db.execute(stmt)
        suites = result.scalars().all()

        return list(suites)

    except Exception as e:
        logger.error(f"Failed to list test suites: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list test suites: {str(e)}"
        )


@router.get("/{suite_id}", response_model=TestSuiteResponse)
async def get_test_suite(
    suite_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific test suite by ID.

    - **suite_id**: Test suite ID
    """
    try:
        stmt = select(TestSuite).where(TestSuite.id == suite_id)
        result = await db.execute(stmt)
        suite = result.scalar_one_or_none()

        if not suite:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Test suite {suite_id} not found"
            )

        return suite

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get test suite {suite_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get test suite: {str(e)}"
        )


@router.put("/{suite_id}", response_model=TestSuiteResponse)
async def update_test_suite(
    suite_id: int,
    suite_data: TestSuiteUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update a test suite.

    - **suite_id**: Test suite ID
    - All fields optional except validation rules
    """
    try:
        # Get existing suite
        stmt = select(TestSuite).where(TestSuite.id == suite_id)
        result = await db.execute(stmt)
        suite = result.scalar_one_or_none()

        if not suite:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Test suite {suite_id} not found"
            )

        # Update fields
        update_data = suite_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(suite, field, value)

        await db.commit()
        await db.refresh(suite)

        logger.info(f"Updated test suite: {suite.name} (ID: {suite.id})")
        return suite

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update test suite {suite_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update test suite: {str(e)}"
        )


@router.delete("/{suite_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_suite(
    suite_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a test suite.

    - **suite_id**: Test suite ID

    Note: This will fail if there are active schedules referencing this suite.
    """
    try:
        # Get existing suite
        stmt = select(TestSuite).where(TestSuite.id == suite_id)
        result = await db.execute(stmt)
        suite = result.scalar_one_or_none()

        if not suite:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Test suite {suite_id} not found"
            )

        await db.delete(suite)
        await db.commit()

        logger.info(f"Deleted test suite: {suite.name} (ID: {suite_id})")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete test suite {suite_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete test suite: {str(e)}"
        )
```

- [ ] **Step 2: 注册路由**

编辑 `docker-compose/scheduler-service/app/api/v1/api.py`：

```python
from app.api.v1.endpoints import test_suites, schedules, jobs

api_router = APIRouter()
api_router.include_router(test_suites.router, prefix="/test-suites", tags=["test-suites"])
api_router.include_router(schedules.router, prefix="/schedules", tags=["schedules"])
api_router.include_router(jobs.router, prefix="/jobs", tags=["jobs"])
```

- [ ] **Step 3: 添加集成测试**

创建 `docker-compose/scheduler-service/app/tests/test_api.py`：

```python
import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession


@pytest.mark.asyncio
async def test_create_test_suite(client: AsyncClient, db_session: AsyncSession):
    """Test creating a test suite via API"""
    response = await client.post(
        "/api/v1/test-suites/",
        json={
            "name": "API Test Suite",
            "description": "Created via API",
            "test_definition_ids": [1, 2, 3],
            "tags": {"source": "api"}
        }
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "API Test Suite"
    assert data["test_definition_ids"] == [1, 2, 3]
    assert data["tags"]["source"] == "api"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_test_suites(client: AsyncClient, db_session: AsyncSession):
    """Test listing test suites via API"""
    # Create a test suite first
    await client.post(
        "/api/v1/test-suites/",
        json={
            "name": "List Test Suite",
            "test_definition_ids": [1]
        }
    )

    # List suites
    response = await client.get("/api/v1/test-suites/")

    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    assert any(s["name"] == "List Test Suite" for s in data)


@pytest.mark.asyncio
async def test_get_test_suite(client: AsyncClient, db_session: AsyncSession):
    """Test getting a specific test suite via API"""
    # Create a test suite
    create_response = await client.post(
        "/api/v1/test-suites/",
        json={
            "name": "Get Test Suite",
            "test_definition_ids": [1, 2]
        }
    )
    suite_id = create_response.json()["id"]

    # Get the suite
    response = await client.get(f"/api/v1/test-suites/{suite_id}")

    assert response.status_code == 200
    data = response.json()
    assert data["id"] == suite_id
    assert data["name"] == "Get Test Suite"


@pytest.mark.asyncio
async def test_update_test_suite(client: AsyncClient, db_session: AsyncSession):
    """Test updating a test suite via API"""
    # Create a test suite
    create_response = await client.post(
        "/api/v1/test-suites/",
        json={
            "name": "Update Test Suite",
            "test_definition_ids": [1]
        }
    )
    suite_id = create_response.json()["id"]

    # Update the suite
    response = await client.put(
        f"/api/v1/test-suites/{suite_id}",
        json={
            "name": "Updated Name",
            "test_definition_ids": [1, 2, 3, 4]
        }
    )

    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Updated Name"
    assert data["test_definition_ids"] == [1, 2, 3, 4]


@pytest.mark.asyncio
async def test_delete_test_suite(client: AsyncClient, db_session: AsyncSession):
    """Test deleting a test suite via API"""
    # Create a test suite
    create_response = await client.post(
        "/api/v1/test-suites/",
        json={
            "name": "Delete Test Suite",
            "test_definition_ids": [1]
        }
    )
    suite_id = create_response.json()["id"]

    # Delete the suite
    response = await client.delete(f"/api/v1/test-suites/{suite_id}")

    assert response.status_code == 204

    # Verify it's deleted
    get_response = await client.get(f"/api/v1/test-suites/{suite_id}")
    assert get_response.status_code == 404
```

- [ ] **Step 4: 运行测试**

```bash
cd docker-compose/scheduler-service
pytest app/tests/test_api.py::test_create_test_suite -v
```

预期输出：`PASSED`

- [ ] **Step 5: 提交**

```bash
git add docker-compose/scheduler-service/app/api/v1/endpoints/test_suites.py
git add docker-compose/scheduler-service/app/api/v1/api.py
git add docker-compose/scheduler-service/app/tests/test_api.py
git commit -m "feat: add TestSuites API endpoints"
```

---

## Task 10: 更新Schedules API端点

**Files:**
- Modify: `docker-compose/scheduler-service/app/api/v1/endpoints/schedules.py`

- [ ] **Step 1: 完全重写schedules.py**

完全替换 `docker-compose/scheduler-service/app/api/v1/endpoints/schedules.py` 的内容：

```python
"""
Schedules API Endpoints

CRUD operations and management for test execution schedules.
"""

import logging
import secrets
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_db
from app.core.celery_app import celery_app
from app.schemas.schedules import (
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleResponse,
    ScheduleToggle,
    SchedulePresetsResponse,
    SchedulePreset,
    ScheduleTriggerResponse
)
from app.models.schedule import Schedule
from app.models.test_run import TestRun
from app.services.execution_service import ExecutionService

router = APIRouter()
logger = logging.getLogger(__name__)


# Preset schedule options
PRESETS = [
    SchedulePreset(
        type="hourly",
        name="每小时",
        cron="0 * * * *",
        description="每小时的第0分钟执行"
    ),
    SchedulePreset(
        type="daily",
        name="每天",
        cron="0 9 * * *",
        description="每天早上9点执行"
    ),
    SchedulePreset(
        type="weekly",
        name="每周一",
        cron="0 9 * * 1",
        description="每周一早上9点执行"
    ),
    SchedulePreset(
        type="monthly",
        name="每月1号",
        cron="0 9 1 * *",
        description="每月1号早上9点执行"
    ),
    SchedulePreset(
        type="custom",
        name="自定义",
        cron="0 0 * * *",
        description="使用自定义cron表达式"
    )
]


@router.get("/presets", response_model=SchedulePresetsResponse)
async def get_schedule_presets():
    """
    Get available schedule preset options.

    Returns a list of preset configurations with friendly names and descriptions.
    """
    return SchedulePresetsResponse(presets=PRESETS)


@router.post("/", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    schedule_data: ScheduleCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Create a new test execution schedule.

    - **name**: Schedule name
    - **schedule_type**: Type ('single', 'suite', 'tag_filter')
    - **test_definition_id**: Required for single type
    - **test_suite_id**: Required for suite type
    - **tag_filter**: Required for tag_filter type
    - **preset_type**: Optional preset type
    - **cron_expression**: Cron expression (required)
    - **timezone**: Timezone (default: UTC)
    - **environment_overrides**: Environment variable overrides
    - **is_active**: Whether schedule is active (default: true)
    - **allow_concurrent**: Allow concurrent executions (default: false)
    - **max_retries**: Maximum retry attempts (0-10, default: 0)
    - **retry_interval_seconds**: Seconds between retries (10-3600, default: 60)
    """
    try:
        schedule = Schedule(**schedule_data.model_dump())
        db.add(schedule)
        await db.commit()
        await db.refresh(schedule)

        logger.info(
            f"Created schedule: {schedule.name} (ID: {schedule.id}, "
            f"type: {schedule.schedule_type})"
        )
        return schedule

    except Exception as e:
        logger.error(f"Failed to create schedule: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create schedule: {str(e)}"
        )


@router.get("/", response_model=List[ScheduleResponse])
async def list_schedules(
    skip: int = Query(0, ge=0, description="Number of schedules to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number to return"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    db: AsyncSession = Depends(get_db)
):
    """
    List all schedules with optional filtering.

    - **skip**: Number of schedules to skip (pagination)
    - **limit**: Maximum number of schedules to return
    - **is_active**: Optional filter by active status
    """
    try:
        stmt = select(Schedule)

        if is_active is not None:
            stmt = stmt.where(Schedule.is_active == is_active)

        stmt = stmt.offset(skip).limit(limit)
        result = await db.execute(stmt)
        schedules = result.scalars().all()

        return list(schedules)

    except Exception as e:
        logger.error(f"Failed to list schedules: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to list schedules: {str(e)}"
        )


@router.get("/{schedule_id}", response_model=ScheduleResponse)
async def get_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get a specific schedule by ID.

    - **schedule_id**: Schedule ID
    """
    try:
        stmt = select(Schedule).where(Schedule.id == schedule_id)
        result = await db.execute(stmt)
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule {schedule_id} not found"
            )

        return schedule

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get schedule {schedule_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get schedule: {str(e)}"
        )


@router.put("/{schedule_id}", response_model=ScheduleResponse)
async def update_schedule(
    schedule_id: int,
    schedule_data: ScheduleUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update a schedule.

    - **schedule_id**: Schedule ID
    - All fields optional
    """
    try:
        # Get existing schedule
        stmt = select(Schedule).where(Schedule.id == schedule_id)
        result = await db.execute(stmt)
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule {schedule_id} not found"
            )

        # Update fields
        update_data = schedule_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(schedule, field, value)

        await db.commit()
        await db.refresh(schedule)

        logger.info(f"Updated schedule: {schedule.name} (ID: {schedule.id})")
        return schedule

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to update schedule {schedule_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update schedule: {str(e)}"
        )


@router.delete("/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a schedule.

    - **schedule_id**: Schedule ID

    Note: Associated test run history will be preserved.
    """
    try:
        # Get existing schedule
        stmt = select(Schedule).where(Schedule.id == schedule_id)
        result = await db.execute(stmt)
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule {schedule_id} not found"
            )

        await db.delete(schedule)
        await db.commit()

        logger.info(f"Deleted schedule: {schedule.name} (ID: {schedule_id})")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to delete schedule {schedule_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete schedule: {str(e)}"
        )


@router.post("/{schedule_id}/toggle", response_model=ScheduleResponse)
async def toggle_schedule(
    schedule_id: int,
    toggle_data: ScheduleToggle,
    db: AsyncSession = Depends(get_db)
):
    """
    Enable or disable a schedule.

    - **schedule_id**: Schedule ID
    - **is_active**: New active status
    """
    try:
        # Get existing schedule
        stmt = select(Schedule).where(Schedule.id == schedule_id)
        result = await db.execute(stmt)
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule {schedule_id} not found"
            )

        # Update active status
        schedule.is_active = toggle_data.is_active
        await db.commit()
        await db.refresh(schedule)

        logger.info(
            f"Toggled schedule {schedule_id} active status to {toggle_data.is_active}"
        )
        return schedule

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to toggle schedule {schedule_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to toggle schedule: {str(e)}"
        )


@router.post("/{schedule_id}/trigger", response_model=ScheduleTriggerResponse)
async def trigger_schedule(
    schedule_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Manually trigger a schedule execution.

    - **schedule_id**: Schedule ID

    This creates an immediate execution regardless of the schedule's timing configuration.
    Returns the generated run_id for tracking.
    """
    try:
        # Get schedule
        stmt = select(Schedule).where(Schedule.id == schedule_id)
        result = await db.execute(stmt)
        schedule = result.scalar_one_or_none()

        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule {schedule_id} not found"
            )

        if not schedule.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Schedule {schedule_id} is not active"
            )

        # Generate unique run_id
        run_id = f"manual_{schedule_id}_{datetime.utcnow().timestamp()}_{secrets.token_hex(4)}"

        # Trigger Celery task
        from app.tasks.test_execution import execute_scheduled_test
        execute_scheduled_test.delay(schedule_id)

        logger.info(f"Manually triggered schedule {schedule_id}, run_id: {run_id}")

        return ScheduleTriggerResponse(
            run_id=run_id,
            status="pending"
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to trigger schedule {schedule_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to trigger schedule: {str(e)}"
        )


@router.get("/{schedule_id}/runs", response_model=List[dict])
async def get_schedule_runs(
    schedule_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get execution history for a specific schedule.

    - **schedule_id**: Schedule ID
    - **skip**: Number of runs to skip (pagination)
    - **limit**: Maximum number of runs to return
    - **status**: Optional filter by status
    """
    try:
        # Verify schedule exists
        schedule_stmt = select(Schedule).where(Schedule.id == schedule_id)
        schedule_result = await db.execute(schedule_stmt)
        if not schedule_result.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule {schedule_id} not found"
            )

        # Get runs
        stmt = select(TestRun).where(TestRun.schedule_id == schedule_id)

        if status:
            stmt = stmt.where(TestRun.status == status)

        stmt = stmt.order_by(TestRun.created_at.desc()).offset(skip).limit(limit)
        result = await db.execute(stmt)
        runs = result.scalars().all()

        # Convert to dict for JSON response
        return [
            {
                "id": run.id,
                "run_id": run.run_id,
                "status": run.status,
                "start_time": run.start_time.isoformat() if run.start_time else None,
                "end_time": run.end_time.isoformat() if run.end_time else None,
                "total_duration_ms": run.total_duration_ms,
                "total_tests": run.total_tests,
                "passed": run.passed,
                "failed": run.failed,
                "skipped": run.skipped,
                "error_message": run.error_message,
                "retry_count": run.retry_count,
                "created_at": run.created_at.isoformat()
            }
            for run in runs
        ]

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get runs for schedule {schedule_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get schedule runs: {str(e)}"
        )


@router.get("/{schedule_id}/stats")
async def get_schedule_stats(
    schedule_id: int,
    db: AsyncSession = Depends(get_db)
):
    """
    Get execution statistics for a schedule.

    - **schedule_id**: Schedule ID

    Returns summary statistics including success rate, average duration, etc.
    """
    try:
        # Verify schedule exists
        schedule_stmt = select(Schedule).where(Schedule.id == schedule_id)
        schedule_result = await db.execute(schedule_stmt)
        schedule = schedule_result.scalar_one_or_none()

        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule {schedule_id} not found"
            )

        # Get statistics
        total_stmt = select(func.count(TestRun.id)).where(
            TestRun.schedule_id == schedule_id
        )
        total_result = await db.execute(total_stmt)
        total_runs = total_result.scalar() or 0

        passed_stmt = select(func.count(TestRun.id)).where(
            TestRun.schedule_id == schedule_id,
            TestRun.status == 'passed'
        )
        passed_result = await db.execute(passed_stmt)
        passed_runs = passed_result.scalar() or 0

        # Get last run
        last_run_stmt = select(TestRun).where(
            TestRun.schedule_id == schedule_id
        ).order_by(TestRun.created_at.desc()).limit(1)
        last_run_result = await db.execute(last_run_stmt)
        last_run = last_run_result.scalar_one_or_none()

        # Calculate success rate
        success_rate = passed_runs / total_runs if total_runs > 0 else 0.0

        return {
            "schedule_id": schedule_id,
            "total_runs": total_runs,
            "passed_runs": passed_runs,
            "success_rate": round(success_rate, 2),
            "last_run_status": last_run.status if last_run else None,
            "last_run_time": last_run.created_at.isoformat() if last_run else None,
            "next_run_time": schedule.next_run_time.isoformat() if schedule.next_run_time else None
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get stats for schedule {schedule_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get schedule stats: {str(e)}"
        )
```

- [ ] **Step 2: 添加API集成测试**

在 `docker-compose/scheduler-service/app/tests/test_api.py` 中添加：

```python
from app.schemas.schedules import ScheduleCreate


@pytest.mark.asyncio
async def test_create_schedule(client: AsyncClient):
    """Test creating a schedule via API"""
    response = await client.post(
        "/api/v1/schedules/",
        json={
            "name": "API Test Schedule",
            "schedule_type": "single",
            "test_definition_id": 1,
            "cron_expression": "0 9 * * *",
            "max_retries": 2
        }
    )

    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "API Test Schedule"
    assert data["schedule_type"] == "single"
    assert data["max_retries"] == 2


@pytest.mark.asyncio
async def test_get_schedule_presets(client: AsyncClient):
    """Test getting schedule presets"""
    response = await client.get("/api/v1/schedules/presets")

    assert response.status_code == 200
    data = response.json()
    assert "presets" in data
    assert len(data["presets"]) > 0
    assert any(p["type"] == "daily" for p in data["presets"])


@pytest.mark.asyncio
async def test_toggle_schedule(client: AsyncClient, db_session: AsyncSession):
    """Test toggling schedule active status"""
    # Create a schedule
    create_response = await client.post(
        "/api/v1/schedules/",
        json={
            "name": "Toggle Test",
            "schedule_type": "single",
            "test_definition_id": 1,
            "cron_expression": "0 9 * * *"
        }
    )
    schedule_id = create_response.json()["id"]

    # Toggle to inactive
    response = await client.post(
        f"/api/v1/schedules/{schedule_id}/toggle",
        json={"is_active": False}
    )

    assert response.status_code == 200
    data = response.json()
    assert data["is_active"] is False


@pytest.mark.asyncio
async def test_trigger_schedule(client: AsyncClient, db_session: AsyncSession):
    """Test manually triggering a schedule"""
    # Create a schedule
    create_response = await client.post(
        "/api/v1/schedules/",
        json={
            "name": "Trigger Test",
            "schedule_type": "single",
            "test_definition_id": 1,
            "cron_expression": "0 9 * * *"
        }
    )
    schedule_id = create_response.json()["id"]

    # Trigger execution
    response = await client.post(f"/api/v1/schedules/{schedule_id}/trigger")

    assert response.status_code == 200
    data = response.json()
    assert "run_id" in data
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_get_schedule_stats(client: AsyncClient, db_session: AsyncSession):
    """Test getting schedule statistics"""
    # Create a schedule
    create_response = await client.post(
        "/api/v1/schedules/",
        json={
            "name": "Stats Test",
            "schedule_type": "single",
            "test_definition_id": 1,
            "cron_expression": "0 9 * * *"
        }
    )
    schedule_id = create_response.json()["id"]

    # Get stats
    response = await client.get(f"/api/v1/schedules/{schedule_id}/stats")

    assert response.status_code == 200
    data = response.json()
    assert "total_runs" in data
    assert "success_rate" in data
    assert data["schedule_id"] == schedule_id
```

- [ ] **Step 3: 运行测试**

```bash
cd docker-compose/scheduler-service
pytest app/tests/test_api.py::test_create_schedule -v
```

预期输出：`PASSED`

- [ ] **Step 4: 提交**

```bash
git add docker-compose/scheduler-service/app/api/v1/endpoints/schedules.py
git add docker-compose/scheduler-service/app/tests/test_api.py
git commit -m "feat: implement complete Schedules API endpoints"
```

---

## Task 11: 创建Celery同步任务

**Files:**
- Create: `docker-compose/scheduler-service/app/tasks/schedule_sync.py`

- [ ] **Step 1: 创建schedule_sync.py**

创建 `docker-compose/scheduler-service/app/tasks/schedule_sync.py`：

```python
"""
Celery Tasks for Schedule Synchronization

Periodic tasks to keep Celery Beat in sync with database schedules.
"""

import logging
import asyncio
from celery import Celery

from app.core.celery_app import celery_app
from app.core.database import get_db
from app.services.schedule_manager import ScheduleManager

logger = logging.getLogger(__name__)


@celery_app.task(name='app.tasks.schedule_sync.sync_schedules')
def sync_schedules():
    """
    Periodic task to synchronize database schedules to Celery Beat.

    This task should run every minute to ensure Celery Beat has the
    latest schedule configuration from the database.

    Runs asynchronously and handles any errors gracefully.
    """
    logger.info("Starting schedule synchronization")

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        result = loop.run_until_complete(_sync_schedules_async())
        logger.info(
            f"Schedule synchronization completed: "
            f"{result['synced']} synced, {result['skipped']} skipped"
        )
        return result

    except Exception as e:
        logger.error(f"Schedule synchronization failed: {e}", exc_info=True)
        return {
            'synced': 0,
            'skipped': 0,
            'error': str(e)
        }

    finally:
        loop.close()


async def _sync_schedules_async():
    """
    Async implementation of schedule synchronization.

    Returns:
        Dictionary with sync statistics
    """
    db = get_db()
    try:
        manager = ScheduleManager(db, celery_app)
        result = await manager.sync_schedules()
        return result

    finally:
        await db.close()
```

- [ ] **Step 2: 更新tasks/__init__.py**

编辑 `docker-compose/scheduler-service/app/tasks/__init__.py`：

```python
from app.tasks.test_execution import execute_test
from app.tasks.schedule_sync import sync_schedules

__all__ = ["execute_test", "sync_schedules"]
```

- [ ] **Step 3: 更新celery_app.py配置**

编辑 `docker-compose/scheduler-service/app/core/celery_app.py`：

```python
"""
Celery Application Configuration

Configures Celery for distributed task queue with Redis broker.
"""

from celery import Celery
from app.core.config import settings

# Create Celery application
celery_app = Celery(
    "scheduler_service",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.tasks.test_execution", "app.tasks.schedule_sync"]
)

# Configure Celery
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Task routing
    task_routes={
        "app.tasks.test_execution.execute_test": {"queue": "test_execution"},
        "app.tasks.test_execution.execute_scheduled_test": {"queue": "test_execution"},
        "app.tasks.schedule_sync.sync_schedules": {"queue": "schedule_sync"},
    },

    # Worker settings
    worker_prefetch_multiplier=1,
    worker_concurrency=4,

    # Task result settings
    result_expires=3600,  # 1 hour
    task_track_started=True,

    # Retry settings
    task_acks_late=True,
    task_reject_on_worker_lost=True,
)

# Beat schedule for periodic tasks
celery_app.conf.beat_schedule = {
    "schedule-sync-task": {
        "task": "app.tasks.schedule_sync.sync_schedules",
        "schedule": 60.0,  # Every 60 seconds
    },
}
```

- [ ] **Step 4: 添加任务测试**

创建 `docker-compose/scheduler-service/app/tests/test_tasks.py`：

```python
import pytest
from unittest.mock import Mock, patch
from app.tasks.schedule_sync import sync_schedules


def test_sync_schedules_task():
    """Test the sync_schedules Celery task"""
    with patch('app.tasks.schedule_sync.get_db') as mock_get_db:
        # Mock database and manager
        mock_db = Mock()
        mock_get_db.return_value = mock_db

        mock_manager = Mock()
        mock_manager.sync_schedules.return_value = {
            'synced': 5,
            'skipped': 0,
            'skipped_details': []
        }

        with patch('app.tasks.schedule_sync.ScheduleManager', return_value=mock_manager):
            result = sync_schedules()

            assert result['synced'] == 5
            assert result['skipped'] == 0
            mock_manager.sync_schedules.assert_called_once()


@pytest.mark.asyncio
async def test_sync_schedules_async():
    """Test the async sync implementation"""
    from app.tasks.schedule_sync import _sync_schedules_async

    with patch('app.tasks.schedule_sync.get_db') as mock_get_db:
        mock_db = Mock()
        mock_get_db.return_value = mock_db

        mock_manager = Mock()
        mock_manager.sync_schedules.return_value = {
            'synced': 3,
            'skipped': 1,
            'skipped_details': [{'schedule_id': 999, 'reason': 'Invalid cron'}]
        }

        with patch('app.tasks.schedule_sync.ScheduleManager', return_value=mock_manager):
            result = await _sync_schedules_async()

            assert result['synced'] == 3
            assert result['skipped'] == 1
            assert len(result['skipped_details']) == 1
```

- [ ] **Step 5: 运行测试**

```bash
cd docker-compose/scheduler-service
pytest app/tests/test_tasks.py::test_sync_schedules_task -v
```

预期输出：`PASSED`

- [ ] **Step 6: 提交**

```bash
git add docker-compose/scheduler-service/app/tasks/schedule_sync.py
git add docker-compose/scheduler-service/app/tasks/__init__.py
git add docker-compose/scheduler-service/app/core/celery_app.py
git add docker-compose/scheduler-service/app/tests/test_tasks.py
git commit -m "feat: add schedule synchronization Celery task"
```

---

## Task 12: 更新test_execution任务支持调度

**Files:**
- Modify: `docker-compose/scheduler-service/app/tasks/test_execution.py`

- [ ] **Step 1: 在test_execution.py中添加调度执行任务**

在 `docker-compose/scheduler-service/app/tasks/test_execution.py` 文件末尾添加：

```python
@celery_app.task(bind=True, name='app.tasks.test_execution.execute_scheduled_test')
def execute_scheduled_test(self, schedule_id: int):
    """
    Execute a scheduled test.

    This task is triggered by Celery Beat based on schedule configurations.
    It resolves target tests, checks execution limits, and runs tests.

    Args:
        schedule_id: Schedule ID to execute

    Returns:
        dict: Execution results summary
    """
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        result = loop.run_until_complete(
            _execute_scheduled_test_async(schedule_id)
        )
        return result
    finally:
        loop.close()


async def _execute_scheduled_test_async(schedule_id: int) -> dict:
    """
    Async implementation of scheduled test execution.

    Args:
        schedule_id: Schedule ID to execute

    Returns:
        dict: Execution results
    """
    from app.core.database import get_db
    from app.services.execution_service import ExecutionService
    from app.models.schedule import Schedule
    from sqlalchemy import select

    db = get_db()
    execution_service = ExecutionService(db)

    try:
        # 1. Get schedule
        stmt = select(Schedule).where(Schedule.id == schedule_id)
        result = await db.execute(stmt)
        schedule = result.scalar_one_or_none()

        if not schedule:
            logger.error(f"Schedule {schedule_id} not found")
            return {
                "schedule_id": schedule_id,
                "status": "error",
                "error": f"Schedule {schedule_id} not found"
            }

        if not schedule.is_active:
            logger.info(f"Schedule {schedule_id} is inactive, skipping")
            return {
                "schedule_id": schedule_id,
                "status": "skipped",
                "reason": "Schedule is inactive"
            }

        # 2. Check execution limits
        if not await execution_service.check_execution_limit(schedule_id):
            logger.info(f"Schedule {schedule_id} has concurrent execution limit, skipping")
            return {
                "schedule_id": schedule_id,
                "status": "skipped",
                "reason": "Concurrent execution not allowed and another run is active"
            }

        # 3. Resolve target tests
        try:
            test_ids = await execution_service.resolve_target_tests(schedule)
        except ValueError as e:
            logger.error(f"Failed to resolve targets for schedule {schedule_id}: {e}")
            return {
                "schedule_id": schedule_id,
                "status": "error",
                "error": str(e)
            }

        if not test_ids:
            logger.warning(f"No test definitions found for schedule {schedule_id}")
            return {
                "schedule_id": schedule_id,
                "status": "skipped",
                "reason": "No test definitions found"
            }

        logger.info(f"Executing schedule {schedule_id} with {len(test_ids)} tests")

        # 4. Execute each test
        results = []
        for test_id in test_ids:
            # Generate unique run_id
            run_id = f"schedule_{schedule_id}_test_{test_id}_{datetime.utcnow().timestamp()}"

            try:
                # Create test run record
                test_run = await execution_service.create_test_run(
                    schedule_id=schedule_id,
                    test_definition_id=test_id,
                    run_id=run_id
                )

                # Update status to running
                await execution_service.update_run_status(
                    run_id,
                    'running',
                    start_time=datetime.utcnow()
                )

                # Build environment
                # Note: In real implementation, fetch test_definition from test-case-service
                # For now, use empty environment
                environment = execution_service.build_environment(schedule, {})

                # Execute test (reuse existing execute_test function)
                test_result = await _execute_test_async(test_id, run_id, environment)

                # Save results
                await execution_service.save_test_results(run_id, test_result)
                results.append(test_result)

                logger.info(f"Test {test_id} completed: {test_result.get('status')}")

            except Exception as e:
                logger.error(f"Failed to execute test {test_id}: {e}")
                # Save failure
                await execution_service.save_test_results(run_id, {
                    'status': 'failed',
                    'error': str(e),
                    'total_tests': 0,
                    'passed': 0,
                    'failed': 1,
                    'skipped': 0,
                    'end_time': datetime.utcnow().timestamp() * 1000
                })
                results.append({'status': 'failed', 'error': str(e)})

        # 5. Update schedule last run time
        schedule.last_run_time = datetime.utcnow()
        await db.commit()

        # Calculate summary
        total = len(results)
        passed = sum(1 for r in results if r.get('status') == 'passed')
        failed = sum(1 for r in results if r.get('status') == 'failed')

        logger.info(
            f"Schedule {schedule_id} execution completed: "
            f"{passed}/{total} passed"
        )

        return {
            "schedule_id": schedule_id,
            "status": "passed" if failed == 0 else "failed",
            "total_tests": total,
            "passed": passed,
            "failed": failed,
            "results": results
        }

    except Exception as e:
        logger.error(f"Failed to execute scheduled test {schedule_id}: {e}")
        return {
            "schedule_id": schedule_id,
            "status": "error",
            "error": str(e)
        }

    finally:
        await db.close()
```

- [ ] **Step 2: 添加必要的导入**

在文件顶部确保有这些导入：

```python
from datetime import datetime
```

- [ ] **Step 3: 添加集成测试**

在 `docker-compose/scheduler-service/app/tests/test_tasks.py` 中添加：

```python
@pytest.mark.asyncio
async def test_execute_scheduled_test(db_session: AsyncSession):
    """Test executing a scheduled test"""
    from app.tasks.test_execution import execute_scheduled_test
    from app.models.schedule import Schedule

    # Create a test schedule
    schedule = Schedule(
        name="Test Schedule",
        schedule_type="single",
        test_definition_id=1,
        cron_expression="0 9 * * *",
        allow_concurrent=True
    )

    db_session.add(schedule)
    await db_session.commit()

    # Execute the task (this would normally be called by Celery)
    # For testing, we call the async implementation directly
    from app.tasks.test_execution import _execute_scheduled_test_async

    # Note: This will fail without actual test definition in test-case-service
    # In real tests, you'd mock the external API calls
    result = await _execute_scheduled_test_async(schedule.id)

    assert "schedule_id" in result
    assert result["schedule_id"] == schedule.id
```

- [ ] **Step 4: 运行测试**

```bash
cd docker-compose/scheduler-service
pytest app/tests/test_tasks.py::test_execute_scheduled_test -v
```

预期输出：`PASSED` 或 `SKIP` (如果需要外部依赖)

- [ ] **Step 5: 提交**

```bash
git add docker-compose/scheduler-service/app/tasks/test_execution.py
git add docker-compose/scheduler-service/app/tests/test_tasks.py
git commit -m "feat: add scheduled test execution task"
```

---

## Task 13: 更新docker-compose配置

**Files:**
- Modify: `docker-compose/docker-compose.yml`

- [ ] **Step 1: 添加scheduler-beat服务**

编辑 `docker-compose/docker-compose.yml`，在 `scheduler-worker` 服务后添加：

```yaml
  scheduler-beat:
    build:
      context: ./scheduler-service
      dockerfile: Dockerfile
    container_name: cc-test-scheduler-beat
    command: celery -A app.core.celery_app beat --loglevel=info
    environment:
      DATABASE_URL: postgresql+asyncpg://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
      REDIS_URL: redis://redis:6379/0
      CELERY_BROKER_URL: redis://redis:6379/0
      CELERY_RESULT_BACKEND: redis://redis:6379/0
      SECRET_KEY: ${SECRET_KEY}
      POSTGRES_HOST: postgres
      POSTGRES_PORT: 5432
      POSTGRES_DB: ${POSTGRES_DB}
      POSTGRES_USER: ${POSTGRES_USER}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      REDIS_PASSWORD: ${REDIS_PASSWORD}
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY:-}
      ANTHROPIC_BASE_URL: ${ANTHROPIC_BASE_URL:-https://api.anthropic.com}
      API_TIMEOUT_MS: ${API_TIMEOUT_MS:-300000}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - test-network
    restart: unless-stopped
```

- [ ] **Step 2: 更新scheduler-worker的队列配置**

修改 `scheduler-worker` 服务的 command：

```yaml
  scheduler-worker:
    # ... existing configuration ...
    command: celery -A app.core.celery_app worker --loglevel=info --concurrency=2 -Q test_execution,schedule_sync
    # ... rest of configuration ...
```

- [ ] **Step 3: 验证docker-compose语法**

```bash
cd docker-compose
docker-compose config
```

预期输出：没有语法错误

- [ ] **Step 4: 提交**

```bash
git add docker-compose/docker-compose.yml
git commit -m "feat: add Celery Beat service for scheduled task execution"
```

---

## Task 14: 添加依赖包

**Files:**
- Modify: `docker-compose/scheduler-service/requirements.txt`

- [ ] **Step 1: 添加新依赖**

编辑 `docker-compose/scheduler-service/requirements.txt`，添加：

```txt
# 现有依赖...

# Scheduling dependencies
croniter>=2.0.0
```

- [ ] **Step 2: 验证依赖**

```bash
cd docker-compose/scheduler-service
pip install --dry-run -r requirements.txt
```

预期输出：没有冲突错误

- [ ] **Step 3: 提交**

```bash
git add docker-compose/scheduler-service/requirements.txt
git commit -m "feat: add croniter dependency for schedule management"
```

---

## Task 15: 创建集成测试和文档

**Files:**
- Create: `docker-compose/scheduler-service/tests/integration/test_scheduling_flow.py`
- Create: `docker-compose/scheduler-service/README_SCHEDULING.md`

- [ ] **Step 1: 创建集成测试**

创建 `docker-compose/scheduler-service/tests/integration/test_scheduling_flow.py`：

```python
"""
Integration tests for complete scheduling workflow.

These tests require a full stack including database, Redis, and Celery.
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from httpx import AsyncClient


@pytest.mark.asyncio
@pytest.mark.integration
async def test_complete_scheduling_workflow(
    client: AsyncClient,
    db_session: AsyncSession
):
    """
    Test the complete workflow:
    1. Create test suite
    2. Create schedule
    3. Verify schedule sync
    4. Trigger manual execution
    5. Check execution history
    """
    # 1. Create test suite
    suite_response = await client.post(
        "/api/v1/test-suites/",
        json={
            "name": "Integration Test Suite",
            "test_definition_ids": [1, 2, 3],
            "tags": {"environment": "integration"}
        }
    )
    assert suite_response.status_code == 201
    suite_id = suite_response.json()["id"]

    # 2. Create schedule with short interval for testing
    schedule_response = await client.post(
        "/api/v1/schedules/",
        json={
            "name": "Integration Test Schedule",
            "schedule_type": "suite",
            "test_suite_id": suite_id,
            "cron_expression": "0 * * * *",  # Every hour
            "is_active": True,
            "allow_concurrent": True,
            "max_retries": 1
        }
    )
    assert schedule_response.status_code == 201
    schedule_data = schedule_response.json()
    schedule_id = schedule_data["id"]

    # 3. Get schedule to verify
    get_response = await client.get(f"/api/v1/schedules/{schedule_id}")
    assert get_response.status_code == 200
    schedule = get_response.json()
    assert schedule["name"] == "Integration Test Schedule"
    assert schedule["schedule_type"] == "suite"

    # 4. Trigger manual execution
    trigger_response = await client.post(f"/api/v1/schedules/{schedule_id}/trigger")
    assert trigger_response.status_code == 200
    trigger_data = trigger_response.json()
    assert "run_id" in trigger_data
    assert trigger_data["status"] == "pending"

    # 5. Get schedule stats
    stats_response = await client.get(f"/api/v1/schedules/{schedule_id}/stats")
    assert stats_response.status_code == 200
    stats = stats_response.json()
    assert stats["schedule_id"] == schedule_id
    assert "total_runs" in stats

    # 6. Toggle schedule to inactive
    toggle_response = await client.post(
        f"/api/v1/schedules/{schedule_id}/toggle",
        json={"is_active": False}
    )
    assert toggle_response.status_code == 200
    toggled_schedule = toggle_response.json()
    assert toggled_schedule["is_active"] is False

    # 7. Delete schedule
    delete_response = await client.delete(f"/api/v1/schedules/{schedule_id}")
    assert delete_response.status_code == 204

    # 8. Verify deletion
    verify_response = await client.get(f"/api/v1/schedules/{schedule_id}")
    assert verify_response.status_code == 404


@pytest.mark.asyncio
@pytest.mark.integration
async def test_schedule_preset_options(client: AsyncClient):
    """Test that schedule presets are available"""
    response = await client.get("/api/v1/schedules/presets")

    assert response.status_code == 200
    data = response.json()
    assert "presets" in data

    presets = data["presets"]
    assert len(presets) > 0

    # Verify expected presets exist
    preset_types = [p["type"] for p in presets]
    assert "daily" in preset_types
    assert "weekly" in preset_types
    assert "hourly" in preset_types


@pytest.mark.asyncio
@pytest.mark.integration
async def test_schedule_validation(client: AsyncClient):
    """Test schedule validation rules"""
    # Test: single type without test_definition_id should fail
    response = await client.post(
        "/api/v1/schedules/",
        json={
            "name": "Invalid Schedule",
            "schedule_type": "single",
            "cron_expression": "0 9 * * *"
        }
    )
    assert response.status_code == 422  # Validation error

    # Test: invalid cron expression should fail
    response = await client.post(
        "/api/v1/schedules/",
        json={
            "name": "Invalid Cron",
            "schedule_type": "single",
            "test_definition_id": 1,
            "cron_expression": "invalid-cron"
        }
    )
    assert response.status_code == 422

    # Test: max_retries out of range should fail
    response = await client.post(
        "/api/v1/schedules/",
        json={
            "name": "Invalid Retries",
            "schedule_type": "single",
            "test_definition_id": 1,
            "cron_expression": "0 9 * * *",
            "max_retries": 15  # Exceeds maximum of 10
        }
    )
    assert response.status_code == 422
```

- [ ] **Step 2: 创建调度功能文档**

创建 `docker-compose/scheduler-service/README_SCHEDULING.md`：

```markdown
# 测试调度功能使用指南

## 概述

测试调度功能允许您配置测试用例的自动执行，支持单个测试、测试套件和基于标签的动态分组。

## 核心概念

### 测试套件 (Test Suite)

静态的测试用例集合，可以一次性调度多个测试。

```bash
# 创建测试套件
curl -X POST http://localhost:8002/api/v1/test-suites/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "回归测试套件",
    "description": "核心功能的回归测试",
    "test_definition_ids": [1, 2, 3, 5, 8],
    "tags": {"category": "regression", "priority": "high"}
  }'
```

### 定时计划 (Schedule)

定义测试的执行时间和频率。

#### 预设选项

- **hourly**: 每小时执行
- **daily**: 每天早上9点执行
- **weekly**: 每周一早上9点执行
- **monthly**: 每月1号早上9点执行

#### 自定义Cron表达式

使用标准的5字段cron表达式：
```
分 时 日 月 周
0  9  *  *  *    # 每天早上9点
*/30 * * * *      # 每30分钟
0 9 * * 1         # 每周一早上9点
```

## API使用示例

### 1. 创建单个测试的定时计划

```bash
curl -X POST http://localhost:8002/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "登录测试每小时执行",
    "schedule_type": "single",
    "test_definition_id": 1,
    "preset_type": "hourly",
    "cron_expression": "0 * * * *",
    "is_active": true,
    "allow_concurrent": false,
    "max_retries": 2
  }'
```

### 2. 创建测试套件的定时计划

```bash
curl -X POST http://localhost:8002/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "回归测试每天执行",
    "schedule_type": "suite",
    "test_suite_id": 1,
    "preset_type": "daily",
    "cron_expression": "0 9 * * *",
    "environment_overrides": {
      "BASE_URL": "https://staging.example.com"
    }
  }'
```

### 3. 查询所有定时计划

```bash
curl http://localhost:8002/api/v1/schedules/
```

### 4. 手动触发执行

```bash
curl -X POST http://localhost:8002/api/v1/schedules/1/trigger
```

### 5. 查看执行历史

```bash
curl http://localhost:8002/api/v1/schedules/1/runs
```

### 6. 查看统计信息

```bash
curl http://localhost:8002/api/v1/schedules/1/stats
```

### 7. 启用/禁用定时计划

```bash
curl -X POST http://localhost:8002/api/v1/schedules/1/toggle \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'
```

## 执行配置

### 并发控制

- `allow_concurrent`: false (默认) - 不允许同一计划的多次执行并发运行
- `allow_concurrent`: true - 允许并发执行

### 重试机制

- `max_retries`: 失败后的最大重试次数 (0-10)
- `retry_interval_seconds`: 重试间隔 (10-3600秒)

### 环境配置

`environment_overrides` 可以覆盖或扩展测试用例的默认环境变量：

```json
{
  "environment_overrides": {
    "BASE_URL": "https://staging.example.com",
    "TIMEOUT": "60",
    "BROWSER": "chrome"
  }
}
```

## 监控和调试

### 查看Celery Beat日志

```bash
docker logs cc-test-scheduler-beat -f
```

### 查看Worker日志

```bash
docker logs cc-test-scheduler-worker -f
```

### 检查同步状态

调度配置每分钟自动同步到Celery Beat。检查日志确认同步成功：

```
INFO Synced 5 schedules to Celery Beat
```

### 执行历史

每次执行都会记录在数据库中，包括：
- 执行状态 (pending, running, passed, failed, skipped)
- 开始和结束时间
- 测试结果统计
- 错误信息
- 重试次数

## 常见问题

### Q: 为什么定时任务没有执行？

检查以下几点：
1. 计划的 `is_active` 是否为 `true`
2. Cron表达式是否正确
3. Celery Beat服务是否正常运行
4. 查看日志是否有错误信息

### Q: 如何修改执行时间？

使用PUT请求更新 `cron_expression` 字段：

```bash
curl -X PUT http://localhost:8002/api/v1/schedules/1 \
  -H "Content-Type: application/json" \
  -d '{"cron_expression": "0 10 * * *"}'
```

### Q: 执行失败后如何处理？

系统会根据 `max_retries` 配置自动重试。检查执行历史查看详细错误信息：

```bash
curl http://localhost:8002/api/v1/schedules/1/runs?status=failed
```

### Q: 如何临时禁用某个计划？

使用toggle端点：

```bash
curl -X POST http://localhost:8002/api/v1/schedules/1/toggle \
  -H "Content-Type: application/json" \
  -d '{"is_active": false}'
```

## 最佳实践

1. **测试环境配置**: 使用 `environment_overrides` 为不同环境的调度配置不同的URL和参数
2. **合理设置重试**: 网络不稳定时可以设置2-3次重试，避免因临时问题导致失败
3. **避免并发冲突**: 默认禁止并发执行，防止同一测试的多次运行相互干扰
4. **监控执行情况**: 定期检查 `/stats` 端点，了解测试成功率趋势
5. **使用测试套件**: 将相关测试组织成套件，便于批量调度和管理
```

- [ ] **Step 3: 运行集成测试**

```bash
cd docker-compose/scheduler-service
pytest tests/integration/test_scheduling_flow.py -v -m integration
```

预期输出：测试通过（需要完整的docker环境）

- [ ] **Step 4: 提交**

```bash
git add docker-compose/scheduler-service/tests/integration/
git add docker-compose/scheduler-service/README_SCHEDULING.md
git commit -m "feat: add integration tests and scheduling documentation"
```

---

## Task 16: 最终验证和清理

**Files:**
- Multiple

- [ ] **Step 1: 运行所有测试**

```bash
cd docker-compose/scheduler-service
pytest app/tests/ -v --cov=app --cov-report=html
```

预期输出：所有测试通过，覆盖率报告生成

- [ ] **Step 2: 检查代码质量**

```bash
cd docker-compose/scheduler-service
pylint app/**/*.py --disable=C0111,R0903
```

预期输出：没有严重错误

- [ ] **Step 3: 验证数据库迁移**

```bash
cd docker-compose/scheduler-service
alembic history
alembic current
```

预期输出：显示最新的迁移版本

- [ ] **Step 4: 构建Docker镜像**

```bash
cd docker-compose
docker-compose build scheduler-service
```

预期输出：镜像构建成功

- [ ] **Step 5: 启动服务**

```bash
cd docker-compose
docker-compose up -d postgres redis scheduler-service scheduler-worker scheduler-beat
```

预期输出：所有服务正常启动

- [ ] **Step 6: 验证API可用性**

```bash
# 等待服务启动
sleep 10

# 测试health check
curl http://localhost:8002/health

# 测试预设选项
curl http://localhost:8002/api/v1/schedules/presets
```

预期输出：返回正常响应

- [ ] **Step 7: 创建完整的工作流测试**

```bash
# 创建测试套件
curl -X POST http://localhost:8002/api/v1/test-suites/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "E2E Test Suite",
    "test_definition_ids": [1, 2],
    "tags": {"test": "e2e"}
  }'

# 创建定时计划
curl -X POST http://localhost:8002/api/v1/schedules/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "E2E Test Schedule",
    "schedule_type": "suite",
    "test_suite_id": 1,
    "cron_expression": "0 * * * *",
    "is_active": true
  }'

# 查询计划
curl http://localhost:8002/api/v1/schedules/

# 触发执行
curl -X POST http://localhost:8002/api/v1/schedules/1/trigger

# 查看执行历史
curl http://localhost:8002/api/v1/schedules/1/runs
```

预期输出：所有API调用成功

- [ ] **Step 8: 检查Celery Beat日志**

```bash
docker logs cc-test-scheduler-beat --tail 50
```

预期输出：看到同步日志，没有错误

- [ ] **Step 9: 提交最终文档**

创建 `docker-compose/scheduler-service/DEPLOYMENT.md`：

```markdown
# 部署指南

## 部署步骤

### 1. 准备环境

确保已安装：
- Docker & Docker Compose
- Python 3.11+
- PostgreSQL 15+
- Redis 7+

### 2. 配置环境变量

复制 `.env.example` 到 `.env` 并配置：

```bash
cp .env.example .env
# 编辑 .env 文件
```

### 3. 启动基础设施

```bash
docker-compose up -d postgres redis
```

### 4. 运行数据库迁移

```bash
cd scheduler-service
alembic upgrade head
```

### 5. 启动调度服务

```bash
docker-compose up -d scheduler-service scheduler-worker scheduler-beat
```

### 6. 验证部署

```bash
# 检查服务健康
curl http://localhost:8002/health

# 检查Celery状态
docker exec cc-test-scheduler-worker celery -A app.core.celery_app inspect active
```

### 7. 创建第一个定时计划

参见 README_SCHEDULING.md

## 故障排查

### 服务无法启动

检查日志：
```bash
docker logs cc-test-scheduler-service
docker logs cc-test-scheduler-worker
docker logs cc-test-scheduler-beat
```

### 定时任务不执行

1. 确认 Celery Beat 正常运行
2. 检查数据库中的 schedules 表
3. 查看日志确认同步成功
4. 验证 cron 表达式格式

### 数据库连接失败

1. 确认 postgres 容器运行正常
2. 检查 DATABASE_URL 配置
3. 验证网络连接

## 监控

关键指标：
- Celery 队列长度
- 任务执行时间
- 成功率统计
- 错误日志频率

## 备份和恢复

### 数据库备份

```bash
docker exec cc-test-postgres pg_dump -U postgres testdb > backup.sql
```

### 恢复

```bash
docker exec -i cc-test-postgres psql -U postgres testdb < backup.sql
```
```

- [ ] **Step 10: 最终提交**

```bash
git add docker-compose/scheduler-service/DEPLOYMENT.md
git commit -m "docs: add deployment guide for scheduling feature"
```

---

## 完成检查清单

在将此计划标记为完成之前，请验证：

- [ ] 所有数据库迁移已创建并测试
- [ ] 所有ORM模型已实现并有单元测试
- [ ] 所有Pydantic schemas已实现并有验证测试
- [ ] Schedule Manager和Execution Service已实现
- [ ] 所有API端点已实现并有集成测试
- [ ] Celery任务已实现（同步和执行）
- [ ] Docker Compose配置已更新
- [ ] 所有依赖已添加到requirements.txt
- [ ] 集成测试通过
- [ ] 文档完整（API使用、部署指南）
- [ ] 代码覆盖率 > 80%
- [ ] 无未解决的critical issues

## 后续工作（不在此计划范围）

- 添加通知功能（邮件、webhook、钉钉等）
- 实现基于标签的动态过滤
- 添加更详细的性能监控和告警
- 实现Dashboard UI界面
- 添加更多预设选项
- 支持依赖关系调度
