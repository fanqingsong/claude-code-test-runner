from typing import Dict, Any
from app.tasks.email_tasks import send_email_task


class EmailClient:
    """Client for queueing emails via Celery"""

    def __init__(self):
        pass

    def send_verification_email(self, to_email: str, verification_url: str) -> str:
        """Queue email verification email"""
        email_data = {
            "to_email": to_email,
            "subject": "Verify Your Email Address",
            "template_name": "verification",
            "context": {"verification_url": verification_url},
            "attempt": 1
        }
        return send_email_task.delay(email_data).id

    def send_password_reset_email(self, to_email: str, reset_url: str) -> str:
        """Queue password reset email"""
        email_data = {
            "to_email": to_email,
            "subject": "Reset Your Password",
            "template_name": "password_reset",
            "context": {"reset_url": reset_url},
            "attempt": 1
        }
        return send_email_task.delay(email_data).id

    def send_mfa_enabled_email(self, to_email: str, recovery_codes: list[str]) -> str:
        """Queue MFA enabled confirmation email with recovery codes"""
        email_data = {
            "to_email": to_email,
            "subject": "MFA Enabled Successfully",
            "template_name": "mfa_enabled",
            "context": {"recovery_codes": recovery_codes},
            "attempt": 1
        }
        return send_email_task.delay(email_data).id

    def send_account_suspended_email(self, to_email: str, reason: str) -> str:
        """Queue account suspension notification email"""
        email_data = {
            "to_email": to_email,
            "subject": "Account Suspended",
            "template_name": "account_suspended",
            "context": {"reason": reason},
            "attempt": 1
        }
        return send_email_task.delay(email_data).id


# Global email client instance
email_client = EmailClient()
