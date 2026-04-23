from fastapi import APIRouter, HTTPException
from app.models import RunRequest, RunResponse
from app.execution.runner import run_problem

router = APIRouter()


@router.post("/run", response_model=RunResponse)
def run_code(req: RunRequest):
    try:
        return run_problem(req.problem_id, req.code, mode="run")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Problem not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/submit", response_model=RunResponse)
def submit_code(req: RunRequest):
    try:
        return run_problem(req.problem_id, req.code, mode="submit")
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Problem not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
