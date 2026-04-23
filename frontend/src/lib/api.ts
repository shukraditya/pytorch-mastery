import { Problem, ProblemSummary, RunResponse } from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getProblems(): Promise<ProblemSummary[]> {
  return fetchJson("/problems");
}

export async function getProblem(id: string): Promise<Problem> {
  return fetchJson(`/problems/${id}`);
}

export async function runCode(
  problemId: string,
  code: string,
  mode: "run" | "submit" = "run"
): Promise<RunResponse> {
  const res = await fetch(`${API_URL}/execute/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ problem_id: problemId, code, mode }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
