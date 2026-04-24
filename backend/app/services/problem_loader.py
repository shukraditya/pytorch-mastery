import os
import yaml
from pathlib import Path

PROBLEMS_DIR = Path(__file__).parent.parent.parent / "problems"


def load_problem(problem_id: str) -> dict:
    for f in PROBLEMS_DIR.glob("*.yml"):
        with open(f, "r") as fh:
            data = yaml.safe_load(fh)
            if data.get("id") == problem_id:
                return data
    raise FileNotFoundError(f"Problem {problem_id} not found")


def list_problems() -> list[dict]:
    problems = []
    for f in sorted(PROBLEMS_DIR.glob("*.yml")):
        with open(f, "r") as fh:
            data = yaml.safe_load(fh)
            problems.append({
                "id": data["id"],
                "title": data["title"],
                "week": data["week"],
                "day": data["day"],
                "difficulty": data["difficulty"],
                "focus": data.get("focus", ""),
                "prerequisites": data.get("prerequisites", []),
                "lines_estimate": data.get("lines_estimate", 0),
                "time_estimate": data.get("time_estimate", ""),
                "tier": data.get("tier", "core"),
            })
    return problems
