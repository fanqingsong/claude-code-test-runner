from celery import shared_task
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime, timedelta
import logging

from app.core.database import AsyncSessionLocal
from app.models import AuditLog, UserSession, UserAccount
from app.core.config import settings

logger = logging.getLogger(__name__)


@shared_task
def cleanup_audit_logs_task():
    """
    Daily task to delete audit logs past retention period.
    Runs once per day, deletes records where auto_delete_at < NOW()
    """
    async def _cleanup():
        async with AsyncSessionLocal() as session:
            try:
                # Count logs to be deleted
                count_query = select(AuditLog).where(
                    AuditLog.auto_delete_at < datetime.utcnow()
                )
                result = await session.execute(count_query)
                count = len(result.scalars().all())

                if count > 0:
                    # Delete expired logs
                    delete_query = delete(AuditLog).where(
                        AuditLog.auto_delete_at < datetime.utcnow()
                    )
                    await session.execute(delete_query)
                    await session.commit()

                    logger.info(f"Deleted {count} expired audit logs")
                else:
                    logger.info("No expired audit logs to delete")

            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to cleanup audit logs: {str(e)}")
                raise

    import asyncio
    asyncio.run(_cleanup())


@shared_task
def cleanup_expired_sessions_task():
    """
    Task to clean up expired user sessions.
    Runs hourly, removes sessions where expires_at < NOW()
    """
    async def _cleanup():
        async with AsyncSessionLocal() as session:
            try:
                # Count expired sessions
                count_query = select(UserSession).where(
                    UserSession.expires_at < datetime.utcnow()
                )
                result = await session.execute(count_query)
                count = len(result.scalars().all())

                if count > 0:
                    # Delete expired sessions
                    delete_query = delete(UserSession).where(
                        UserSession.expires_at < datetime.utcnow()
                    )
                    await session.execute(delete_query)
                    await session.commit()

                    logger.info(f"Deleted {count} expired sessions")
                else:
                    logger.info("No expired sessions to delete")

            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to cleanup expired sessions: {str(e)}")
                raise

    import asyncio
    asyncio.run(_cleanup())


@shared_task
def reset_locked_accounts_task():
    """
    Task to unlock accounts whose lock period has expired.
    Runs every 5 minutes
    """
    async def _reset():
        async with AsyncSessionLocal() as session:
            try:
                # Find locked accounts past lock period
                query = select(UserAccount).where(
                    UserAccount.locked_until < datetime.utcnow(),
                    UserAccount.locked_until.isnot(None)
                )
                result = await session.execute(query)
                accounts = result.scalars().all()

                count = 0
                for account in accounts:
                    account.unlock_account()
                    count += 1

                if count > 0:
                    await session.commit()
                    logger.info(f"Unlocked {count} accounts")
                else:
                    logger.info("No accounts to unlock")

            except Exception as e:
                await session.rollback()
                logger.error(f"Failed to reset locked accounts: {str(e)}")
                raise

    import asyncio
    asyncio.run(_reset())
