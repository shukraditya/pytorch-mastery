from fastapi import APIRouter, HTTPException
from app.models import RunRequest, RunResponse

router = APIRouter()


@router.post("/run", response_model=RunResponse)
def run_code(req: RunRequest):
    # Placeholder until execution engine is built
    return RunResponse(passed=True, results=[])


@router.post("/submit", response_model=RunResponse)
def submit_code(req: RunRequest):
    # Placeholder until execution engine is built
    return RunResponse(passed=True, results=[])
