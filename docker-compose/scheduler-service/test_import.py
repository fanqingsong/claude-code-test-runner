"""Test import celery_app"""
from app.core.celery_app import celery_app
print(f"Celery app: {celery_app}")
print(f"Celery app name: {celery_app.main}")
