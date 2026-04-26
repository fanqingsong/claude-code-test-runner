"""add scheduling tables

Revision ID: 20260426_add_scheduling_tables
Revises:
Create Date: 2026-04-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260426_add_scheduling_tables'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create test_suites table
    op.create_table(
        'test_suites',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('test_definition_ids', sa.ARRAY(sa.Integer()), nullable=False),
        sa.Column('tags', sa.JSON(), nullable=True, server_default='{}'),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_test_suites_id'), 'test_suites', ['id'])

    # Create schedules table
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
        sa.Column('timezone', sa.String(length=50), nullable=True, server_default='UTC'),
        sa.Column('environment_overrides', sa.JSON(), nullable=True, server_default='{}'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default='true'),
        sa.Column('allow_concurrent', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('max_retries', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('retry_interval_seconds', sa.Integer(), nullable=True, server_default='60'),
        sa.Column('next_run_time', sa.DateTime(), nullable=True),
        sa.Column('last_run_time', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.Column('updated_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.Column('created_by', sa.String(length=100), nullable=True),
        sa.ForeignKeyConstraint(['test_suite_id'], ['test_suites.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_schedules_id'), 'schedules', ['id'])
    op.create_index(op.f('ix_schedules_schedule_type'), 'schedules', ['schedule_type'])
    op.create_index(op.f('ix_schedules_is_active'), 'schedules', ['is_active'])

    # Create test_runs table
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
        sa.Column('total_tests', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('passed', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('failed', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('skipped', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('test_cases', sa.JSON(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('retry_count', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('is_retry', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=True, server_default=sa.text('now()')),
        sa.ForeignKeyConstraint(['schedule_id'], ['schedules.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('run_id')
    )
    op.create_index(op.f('ix_test_runs_id'), 'test_runs', ['id'])
    op.create_index('ix_test_runs_schedule_id_created_at', 'test_runs', ['schedule_id', 'created_at'])
    op.create_index('ix_test_runs_status_created_at', 'test_runs', ['status', 'created_at'])
    op.create_index(op.f('ix_test_runs_run_id'), 'test_runs', ['run_id'], unique=True)


def downgrade() -> None:
    # Drop test_runs table
    op.drop_index(op.f('ix_test_runs_run_id'), table_name='test_runs')
    op.drop_index('ix_test_runs_status_created_at', table_name='test_runs')
    op.drop_index('ix_test_runs_schedule_id_created_at', table_name='test_runs')
    op.drop_table('test_runs')

    # Drop schedules table
    op.drop_index(op.f('ix_schedules_is_active'), table_name='schedules')
    op.drop_index(op.f('ix_schedules_schedule_type'), table_name='schedules')
    op.drop_index(op.f('ix_schedules_id'), table_name='schedules')
    op.drop_table('schedules')

    # Drop test_suites table
    op.drop_index(op.f('ix_test_suites_id'), table_name='test_suites')
    op.drop_table('test_suites')
