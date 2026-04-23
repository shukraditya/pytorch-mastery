import json
import os
import subprocess
import tempfile
import textwrap
from pathlib import Path

from app.services.problem_loader import load_problem


SAFE_GLOBALS = {"torch": __import__("torch")}


def _precompute_expected(expected: dict, val_type: str) -> dict:
    if val_type in ("allclose", "equality"):
        expr = expected.get("value", "")
        if "\n" in expr or "import" in expr:
            local_vars = {}
            exec(expr, SAFE_GLOBALS, local_vars)
            tensor = None
            for v in reversed(list(local_vars.values())):
                if isinstance(v, SAFE_GLOBALS["torch"].Tensor):
                    tensor = v
                    break
            if tensor is None:
                raise ValueError("Could not find tensor in expected expression")
            expected = {**expected, "value": repr(tensor)}
    return expected


def _build_harness(problem: dict, user_code: str, test_cases: list[dict]) -> str:
    func_name = problem["function_name"]
    validation = problem.get("validation", {})
    val_type = validation.get("type", "allclose")
    rtol = validation.get("rtol", 1e-05)
    atol = validation.get("atol", 1e-08)

    # Precompute any expression-based expected values
    processed_tests = []
    for tc in test_cases:
        processed = dict(tc)
        processed["expected"] = _precompute_expected(tc["expected"], val_type)
        processed_tests.append(processed)

    tc_json = json.dumps(processed_tests)

    if val_type == "match_tensor":
        check_logic = textwrap.dedent(f"""\
            ok = True
            msgs = []
            if out.shape != tuple(expected.get("shape", [])):
                ok = False
                msgs.append(f"shape mismatch: {{out.shape}} vs {{expected.get('shape')}}")
            if "dtype" in expected and str(out.dtype).replace("torch.", "") != expected["dtype"]:
                ok = False
                msgs.append(f"dtype mismatch: {{out.dtype}} vs {{expected['dtype']}}")
            if "device" in expected and str(out.device) != expected["device"]:
                ok = False
                msgs.append(f"device mismatch: {{out.device}} vs {{expected['device']}}")
            if "value" in expected:
                expected_tensor = eval(expected["value"], {{"torch": torch}})
                if not torch.allclose(out, expected_tensor, rtol=1e-05, atol=1e-08):
                    ok = False
                    msgs.append(f"value mismatch: {{out.tolist()}} vs {{expected_tensor.tolist()}}")
            passed = ok
            actual = f"shape={{out.shape}}, dtype={{out.dtype}}, device={{out.device}}"
            expected_str = str(expected)
            error = "; ".join(msgs) if msgs else None
        """)
    elif val_type == "allclose":
        check_logic = textwrap.dedent(f"""\
            expected_tensor = eval(expected["value"], {{"torch": torch}})
            passed = torch.allclose(out, expected_tensor, rtol={rtol}, atol={atol})
            actual = str(out.tolist())
            expected_str = str(expected_tensor.tolist())
            error = None
        """)
    elif val_type == "length":
        check_logic = textwrap.dedent("""\
            expected_len = expected.get("length", 0)
            passed = len(out) == expected_len
            actual = str(len(out))
            expected_str = str(expected_len)
            error = None
        """)
    else:
        check_logic = textwrap.dedent("""\
            expected_tensor = eval(expected["value"], {"torch": torch})
            passed = torch.equal(out, expected_tensor)
            actual = str(out.tolist())
            expected_str = str(expected_tensor.tolist())
            error = None
        """)

    harness = f"""import torch
import json
import sys

# ---- user code ----
{user_code}

# ---- test harness ----
test_cases = json.loads({repr(tc_json)})
results = []

for tc in test_cases:
    try:
        _globals = {{"torch": torch}}
        setup = tc.get("setup", "")
        if setup:
            exec(setup, _globals)
        inputs = {{k: eval(str(v), _globals) for k, v in tc["inputs"].items()}}
        out = {func_name}(**inputs)
        expected = tc["expected"]

{textwrap.indent(check_logic, '        ')}

        results.append({{
            "name": tc["name"],
            "passed": bool(passed),
            "actual": actual,
            "expected": expected_str,
            "error": error,
        }})
    except Exception as e:
        results.append({{
            "name": tc["name"],
            "passed": False,
            "actual": None,
            "expected": None,
            "error": str(e),
        }})

print(json.dumps(results))
"""
    return harness


def run_problem(problem_id: str, user_code: str, mode: str = "run") -> dict:
    problem = load_problem(problem_id)
    all_tests = problem.get("test_cases", {})

    if mode == "run":
        tests = all_tests.get("visible", [])
    else:
        tests = all_tests.get("visible", []) + all_tests.get("hidden", [])

    harness = _build_harness(problem, user_code, tests)

    with tempfile.TemporaryDirectory() as tmpdir:
        script_path = Path(tmpdir) / "harness.py"
        script_path.write_text(harness)

        try:
            proc = subprocess.run(
                ["python", str(script_path)],
                capture_output=True,
                text=True,
                timeout=10,
            )
        except subprocess.TimeoutExpired:
            return {
                "passed": False,
                "results": [
                    {
                        "name": "Execution",
                        "passed": False,
                        "actual": None,
                        "expected": None,
                        "error": "Execution timed out after 10s",
                    }
                ],
            }

        if proc.returncode != 0:
            return {
                "passed": False,
                "results": [
                    {
                        "name": "Execution",
                        "passed": False,
                        "actual": None,
                        "expected": None,
                        "error": f"Runtime error:\n{proc.stderr}",
                    }
                ],
            }

        try:
            output_line = proc.stdout.strip().splitlines()[-1]
            results = json.loads(output_line)
        except (IndexError, json.JSONDecodeError) as e:
            return {
                "passed": False,
                "results": [
                    {
                        "name": "Execution",
                        "passed": False,
                        "actual": proc.stdout,
                        "expected": "JSON result array",
                        "error": f"Failed to parse output: {e}",
                    }
                ],
            }

    passed = all(r["passed"] for r in results)
    return {"passed": passed, "results": results}
