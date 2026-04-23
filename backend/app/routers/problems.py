from fastapi import APIRouter, HTTPException
from app.services.problem_loader import load_problem, list_problems

router = APIRouter()


@router.get("")
def get_problems():
    return list_problems()


@router.get("/{problem_id}")
def get_problem(problem_id: str):
    try:
        prob = load_problem(problem_id)
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Problem not found")
    # Strip hidden tests from public view, keep visible for examples
    if "test_cases" in prob:
        prob["test_cases"] = {"visible": prob["test_cases"].get("visible", [])}
    return prob
