"""
Jobs API Endpoints

Test execution job management and monitoring.
"""

import uuid
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from app.tasks.test_execution import execute_test
from app.schemas.jobs import JobCreate, JobResponse, JobStatusResponse

router = APIRouter()


# In-memory job storage (TODO: Replace with Redis/database)
jobs_storage = {}


@router.post("/", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(job_data: JobCreate):
    """
    Create and execute a new test job.

    - **test_definition_ids**: List of test definition IDs to execute
    - **environment**: Environment variables for tests
    - **priority**: Job priority (1-10)
    - **scheduled**: Whether this is a scheduled job
    """
    job_id = str(uuid.uuid4())

    # Initialize job
    jobs_storage[job_id] = {
        "job_id": job_id,
        "status": "pending",
        "test_definition_ids": job_data.test_definition_ids,
        "created_at": datetime.utcnow().isoformat(),
        "started_at": None,
        "completed_at": None,
        "results": None,
        "environment": job_data.environment
    }

    # Queue test execution tasks
    task_ids = []
    for test_def_id in job_data.test_definition_ids:
        task = execute_test.delay(test_def_id, job_id, job_data.environment)
        task_ids.append(task.id)

    jobs_storage[job_id]["task_ids"] = task_ids
    jobs_storage[job_id]["status"] = "running"
    jobs_storage[job_id]["started_at"] = datetime.utcnow().isoformat()

    return JobResponse(**jobs_storage[job_id])


@router.get("/{job_id}", response_model=JobStatusResponse)
async def get_job_status(job_id: str):
    """
    Get the status of a job.

    - **job_id**: Job ID
    """
    if job_id not in jobs_storage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found"
        )

    job = jobs_storage[job_id]

    # Check task status
    from celery.result import AsyncResult
    from app.core.celery_app import celery_app

    completed_tasks = 0
    total_tasks = len(job.get("task_ids", []))
    results = []

    for task_id in job.get("task_ids", []):
        result = AsyncResult(task_id, app=celery_app)
        if result.ready():
            completed_tasks += 1
            if result.successful():
                results.append(result.result)

    progress = completed_tasks / total_tasks if total_tasks > 0 else 1.0

    if completed_tasks == total_tasks and total_tasks > 0:
        job["status"] = "completed"
        job["completed_at"] = datetime.utcnow().isoformat()
        job["results"] = {"test_runs": results}

    return JobStatusResponse(
        job_id=job_id,
        status=job["status"],
        progress=progress,
        message=f"{completed_tasks}/{total_tasks} tests completed",
        results=job.get("results")
    )


@router.get("/", response_model=List[JobResponse])
async def list_jobs(skip: int = 0, limit: int = 100):
    """
    List all jobs.

    - **skip**: Number of jobs to skip
    - **limit**: Number of jobs to return
    """
    jobs = list(jobs_storage.values())
    jobs.sort(key=lambda x: x["created_at"], reverse=True)

    return jobs[skip:skip + limit]


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def cancel_job(job_id: str):
    """
    Cancel a running job.

    - **job_id**: Job ID
    """
    if job_id not in jobs_storage:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Job {job_id} not found"
        )

    job = jobs_storage[job_id]

    if job["status"] not in ["pending", "running"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel job with status {job['status']}"
        )

    # Revoke Celery tasks
    from app.core.celery_app import celery_app

    for task_id in job.get("task_ids", []):
        celery_app.control.revoke(task_id, terminate=True)

    job["status"] = "cancelled"
    job["completed_at"] = datetime.utcnow().isoformat()

    return None
