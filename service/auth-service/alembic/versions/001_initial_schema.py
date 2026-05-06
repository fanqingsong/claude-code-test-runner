"""Initial schema: user_accounts, user_sessions, mfa_secrets, recovery_codes, email_tokens, audit_logs

Revision ID: 001
Revises:
Create Date: 2026-05-06

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create user_accounts table
    op.create_table(
        'user_accounts',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('email', sa.String(255), nullable=False, unique=True),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('is_verified', sa.Boolean(), default=False, nullable=False),
        sa.Column('status', sa.String(50), default='active', nullable=False),
        sa.Column('mfa_enabled', sa.Boolean(), default=False, nullable=False),
        sa.Column('failed_login_attempts', sa.Integer(), default=0, nullable=False),
        sa.Column('locked_until', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now(), nullable=False),
    )
    op.create_index('ix_user_accounts_email', 'user_accounts', ['email'])
    op.create_index('ix_user_accounts_status', 'user_accounts', ['status'])

    # Create user_sessions table
    op.create_table(
        'user_sessions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user_accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('session_token', sa.String(255), nullable=False, unique=True),
        sa.Column('device_fingerprint', sa.String(255), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('is_remember_me', sa.Boolean(), default=False, nullable=False),
        sa.Column('last_active', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_user_sessions_user_id', 'user_sessions', ['user_id'])
    op.create_index('ix_user_sessions_session_token', 'user_sessions', ['session_token'])
    op.create_index('ix_user_sessions_expires_at', 'user_sessions', ['expires_at'])

    # Create mfa_secrets table
    op.create_table(
        'mfa_secrets',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user_accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('secret_hash', sa.String(255), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), default=False, nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('enabled_at', sa.DateTime(), nullable=True),
    )
    op.create_index('ix_mfa_secrets_user_id', 'mfa_secrets', ['user_id'])

    # Create recovery_codes table
    op.create_table(
        'recovery_codes',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('mfa_id', sa.Integer(), sa.ForeignKey('mfa_secrets.id', ondelete='CASCADE'), nullable=False),
        sa.Column('code_hash', sa.String(255), nullable=False),
        sa.Column('is_used', sa.Boolean(), default=False, nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_recovery_codes_mfa_id', 'recovery_codes', ['mfa_id'])

    # Create email_tokens table
    op.create_table(
        'email_tokens',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user_accounts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('token_hash', sa.String(255), nullable=False, unique=True),
        sa.Column('token_type', sa.String(50), nullable=False),  # verification, password_reset
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_email_tokens_user_id', 'email_tokens', ['user_id'])
    op.create_index('ix_email_tokens_token_hash', 'email_tokens', ['token_hash'])
    op.create_index('ix_email_tokens_expires_at', 'email_tokens', ['expires_at'])

    # Create audit_logs table
    op.create_table(
        'audit_logs',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('user_accounts.id', ondelete='SET NULL'), nullable=True),
        sa.Column('event_type', sa.String(100), nullable=False),
        sa.Column('ip_address', sa.String(45), nullable=True),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column('metadata', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('auto_delete_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_audit_logs_user_id', 'audit_logs', ['user_id'])
    op.create_index('ix_audit_logs_event_type', 'audit_logs', ['event_type'])
    op.create_index('ix_audit_logs_created_at', 'audit_logs', ['created_at'])
    op.create_index('ix_audit_logs_auto_delete_at', 'audit_logs', ['auto_delete_at'])


def downgrade() -> None:
    op.drop_table('audit_logs')
    op.drop_table('email_tokens')
    op.drop_table('recovery_codes')
    op.drop_table('mfa_secrets')
    op.drop_table('user_sessions')
    op.drop_table('user_accounts')
