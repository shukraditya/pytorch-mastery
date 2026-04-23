import os
import yaml
from pathlib import Path

PROBLEMS_DIR = Path(__file__).parent.parent.parent / "problems"


def load_problem(problem_id: str) -> dict:
    path = PROBLEMS_DIR / f"{problem_id}.yml"
    if not path.exists():
        raise FileNotFoundError(f"Problem {problem_id} not found")
    with open(path, "r") as f:
        return yaml.safe_load(f)


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
            })
    return problems
