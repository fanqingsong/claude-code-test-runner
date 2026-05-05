"""
Create SSO Configuration Table

Run this script to create the sso_configs table in the database.
"""

import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from app.core.config import settings
from app.models.sso_config import SSOConfig
from app.core.database import Base


async def create_table():
    """Create the sso_configs table."""
    engine = create_async_engine(settings.DATABASE_URL, echo=True)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Verify table was created
    async_session_maker = async_sessionmaker(engine, expire_on_commit=False)
    async with async_session_maker() as session:
        from sqlalchemy import text
        result = await session.execute(text("SELECT table_name FROM information_schema.tables WHERE table_name='sso_configs'"))
        tables = result.fetchall()
        if tables:
            print("✅ sso_configs table created successfully!")
        else:
            print("❌ Failed to create sso_configs table")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(create_table())
