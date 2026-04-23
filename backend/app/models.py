from pydantic import BaseModel
from typing import Literal


class TestCaseResult(BaseModel):
    name: str
    passed: bool
    actual: str | None = None
    expected: str | None = None
    error: str | None = None


class RunRequest(BaseModel):
    problem_id: str
    code: str
    mode: Literal["run", "submit"] = "run"


class RunResponse(BaseModel):
    passed: bool
    results: list[TestCaseResult]
