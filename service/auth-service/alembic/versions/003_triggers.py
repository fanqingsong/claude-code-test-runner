"""Database triggers for auto-updating updated_at timestamps

Revision ID: 003
Revises: 002
Create Date: 2026-05-06

"""
from alembic import op


# revision identifiers, used by Alembic.
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create trigger function for updating updated_at
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ language 'plpgsql';
    """)

    # Create triggers for user_accounts table
    op.execute("""
        CREATE TRIGGER update_user_accounts_updated_at
        BEFORE UPDATE ON user_accounts
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    """)


def downgrade() -> None:
    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS update_user_accounts_updated_at ON user_accounts")

    # Drop trigger function
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column()")
