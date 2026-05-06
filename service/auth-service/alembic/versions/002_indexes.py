"""Additional indexes for query optimization

Revision ID: 002
Revises: 001
Create Date: 2026-05-06

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '002'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Composite indexes for common queries

    # user_sessions: user_id + expires_at for active session lookup
    op.create_index(
        'ix_user_sessions_user_id_expires_at',
        'user_sessions',
        ['user_id', 'expires_at']
    )

    # audit_logs: user_id + created_at for user audit history
    op.create_index(
        'ix_audit_logs_user_id_created_at',
        'audit_logs',
        ['user_id', 'created_at']
    )

    # audit_logs: event_type + created_at for event filtering
    op.create_index(
        'ix_audit_logs_event_type_created_at',
        'audit_logs',
        ['event_type', 'created_at']
    )

    # email_tokens: user_id + token_type + expires_at for unused token lookup
    op.create_index(
        'ix_email_tokens_user_id_type_expires',
        'email_tokens',
        ['user_id', 'token_type', 'expires_at']
    )

    # user_accounts: email + status for authentication queries
    op.create_index(
        'ix_user_accounts_email_status',
        'user_accounts',
        ['email', 'status']
    )

    # user_accounts: mfa_enabled + status for MFA user queries
    op.create_index(
        'ix_user_accounts_mfa_enabled_status',
        'user_accounts',
        ['mfa_enabled', 'status']
    )

    # recovery_codes: mfa_id + is_used for unused recovery code lookup
    op.create_index(
        'ix_recovery_codes_mfa_id_is_used',
        'recovery_codes',
        ['mfa_id', 'is_used']
    )


def downgrade() -> None:
    op.drop_index('ix_recovery_codes_mfa_id_is_used', table_name='recovery_codes')
    op.drop_index('ix_user_accounts_mfa_enabled_status', table_name='user_accounts')
    op.drop_index('ix_user_accounts_email_status', table_name='user_accounts')
    op.drop_index('ix_email_tokens_user_id_type_expires', table_name='email_tokens')
    op.drop_index('ix_audit_logs_event_type_created_at', table_name='audit_logs')
    op.drop_index('ix_audit_logs_user_id_created_at', table_name='audit_logs')
    op.drop_index('ix_user_sessions_user_id_expires_at', table_name='user_sessions')
