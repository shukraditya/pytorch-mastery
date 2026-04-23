import json
import subprocess
import sys
import tempfile
import textwrap
from pathlib import Path

from app.services.problem_loader import load_problem


def _build_harness(problem: dict, user_code: str, test_cases: list[dict]) -> str:
    func_name = problem["function_name"]
    validation = problem.get("validation", {})
    val_type = validation.get("type", "allclose")
    rtol = validation.get("rtol", 1e-05)
    atol = validation.get("atol", 1e-08)

    tc_json = json.dumps(test_cases)

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
                expected_tensor = _eval_expected(expected["value"], _globals)
                if not torch.allclose(out, expected_tensor, rtol=1e-05, atol=1e-08):
                    ok = False
                    msgs.append(f"value mismatch: {{out.tolist()}} vs {{expected_tensor.tolist()}}")
            passed = ok
            actual = f"shape={{list(out.shape)}}, dtype={{str(out.dtype).replace('torch.', '')}}, device={{out.device}}"
            _exp_parts = []
            if "shape" in expected:
                _exp_parts.append(f"shape={{expected['shape']}}")
            if "dtype" in expected:
                _exp_parts.append(f"dtype={{expected['dtype']}}")
            if "device" in expected:
                _exp_parts.append(f"device={{expected['device']}}")
            expected_str = ", ".join(_exp_parts)
            error = "; ".join(msgs) if msgs else None
        """)
    elif val_type == "allclose":
        check_logic = textwrap.dedent(f"""\
            if "value" in expected:
                expected_tensor = _eval_expected(expected["value"], _globals)
                passed = torch.allclose(out, expected_tensor, rtol={rtol}, atol={atol})
                actual = str(out.tolist())
                expected_str = str(expected_tensor.tolist())
                error = None
            else:
                ok = True
                msgs = []
                if "shape" in expected and list(out.shape) != expected["shape"]:
                    ok = False
                    msgs.append(f"shape mismatch: {{list(out.shape)}} vs {{expected['shape']}}")
                if "dtype" in expected and str(out.dtype).replace("torch.", "") != expected["dtype"]:
                    ok = False
                    msgs.append(f"dtype mismatch: {{out.dtype}} vs {{expected['dtype']}}")
                if "device" in expected and str(out.device) != expected["device"]:
                    ok = False
                    msgs.append(f"device mismatch: {{out.device}} vs {{expected['device']}}")
                passed = ok
                actual = f"shape={{list(out.shape)}}, dtype={{str(out.dtype).replace('torch.', '')}}, device={{out.device}}"
                expected_str = str(expected)
                error = "; ".join(msgs) if msgs else None
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
            if "value" in expected:
                expected_tensor = _eval_expected(expected["value"], _globals)
                passed = torch.equal(out, expected_tensor)
                actual = str(out.tolist())
                expected_str = str(expected_tensor.tolist())
                error = None
            else:
                ok = True
                msgs = []
                if "shape" in expected and list(out.shape) != expected["shape"]:
                    ok = False
                    msgs.append(f"shape mismatch: {list(out.shape)} vs {expected['shape']}")
                if "dtype" in expected and str(out.dtype).replace("torch.", "") != expected["dtype"]:
                    ok = False
                    msgs.append(f"dtype mismatch: {out.dtype} vs {expected['dtype']}")
                if "device" in expected and str(out.device) != expected["device"]:
                    ok = False
                    msgs.append(f"device mismatch: {out.device} vs {expected['device']}")
                passed = ok
                actual = f"shape={list(out.shape)}, dtype={str(out.dtype).replace('torch.', '')}, device={out.device}"
                expected_str = str(expected)
                error = "; ".join(msgs) if msgs else None
        """)

    harness = f"""import torch
import json
import sys

# ---- user code ----
{user_code}

# ---- test harness ----
test_cases = json.loads({repr(tc_json)})
results = []

def _eval_expected(expr, scope):
    if "\\n" in expr or "import" in expr:
        local = {{}}
        exec(expr, scope, local)
        for v in reversed(list(local.values())):
            if isinstance(v, torch.Tensor):
                return v
        raise ValueError("No tensor found in multi-line expected expression")
    return eval(expr, scope)

for tc in test_cases:
    try:
        _globals = {{"torch": torch}}
        setup = tc.get("setup", "")
        if setup:
            exec(setup, _globals)
        inputs = {{k: eval(str(v), _globals) for k, v in tc["inputs"].items()}}
        _globals.update(inputs)
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
                ["uv", "run", "python", str(script_path)],
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
