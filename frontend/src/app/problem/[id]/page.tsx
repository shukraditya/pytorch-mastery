"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getProblem, getProblems, runCode } from "@/lib/api";
import { Problem, ProblemSummary, RunResponse } from "@/lib/types";
import { getProgress, setProblemCompleted } from "@/lib/progress";
import dynamic from "next/dynamic";
import { Play, Send, Terminal, ListChecks, Lock } from "lucide-react";
import ProblemDescription from "@/components/ProblemDescription";

const Editor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

function sortProblems(problems: ProblemSummary[]) {
  return [...problems].sort((a, b) => {
    if (a.week !== b.week) return a.week - b.week;
    if (a.day !== b.day) return a.day - b.day;
    return a.id.localeCompare(b.id);
  });
}

function isUnlocked(sorted: ProblemSummary[], id: string): boolean {
  const idx = sorted.findIndex((p) => p.id === id);
  if (idx <= 0) return true;
  const progress = getProgress();
  const prev = sorted[idx - 1];
  return !!progress[prev.id];
}

export default function ProblemPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [problem, setProblem] = useState<Problem | null>(null);
  const [code, setCode] = useState("");
  const [results, setResults] = useState<RunResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"testcase" | "result">("testcase");
  const [locked, setLocked] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    getProblems().then((all) => {
      const sorted = sortProblems(all);
      if (!isUnlocked(sorted, id)) {
        setLocked(true);
        return;
      }
      getProblem(id).then((p) => {
        setProblem(p);
        setCode(p.starter_code);
        setCompleted(!!getProgress()[id]);
      });
    });
  }, [id]);

  async function handleRun() {
    if (!problem) return;
    setLoading(true);
    setActiveTab("result");
    try {
      const res = await runCode(problem.id, code, "run");
      setResults(res);
    } catch (e) {
      setResults({
        passed: false,
        results: [
          {
            name: "Request",
            passed: false,
            actual: null,
            expected: null,
            error: e instanceof Error ? e.message : String(e),
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!problem) return;
    setLoading(true);
    setActiveTab("result");
    try {
      const res = await runCode(problem.id, code, "submit");
      setResults(res);
      if (res.passed) {
        setProblemCompleted(problem.id);
        setCompleted(true);
      }
    } catch (e) {
      setResults({
        passed: false,
        results: [
          {
            name: "Request",
            passed: false,
            actual: null,
            expected: null,
            error: e instanceof Error ? e.message : String(e),
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  }

  if (locked) {
    return (
      <div className="h-screen flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <Lock className="w-12 h-12" />
        <h1 className="text-xl font-semibold text-foreground">Problem Locked</h1>
        <p>Complete the previous problems to unlock this one.</p>
        <button
          onClick={() => router.push("/")}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!problem) {
    return (
      <div className="h-screen flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 border-b border-border flex items-center px-4 justify-between bg-card">
        <div className="flex items-center gap-3">
          <span className="font-semibold">{problem.title}</span>
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium border ${
              problem.difficulty === "Easy"
                ? "bg-green-500/20 text-green-400 border-green-500/30"
                : problem.difficulty === "Medium"
                ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                : "bg-red-500/20 text-red-400 border-red-500/30"
            }`}
          >
            {problem.difficulty}
          </span>
          {completed && (
            <span className="text-green-400 text-sm font-medium">Completed</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-muted hover:bg-accent text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Play className="w-4 h-4" />
            Run
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
            Submit
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 overflow-hidden">
        {/* Left: Description */}
        <div className="border-r border-border overflow-y-auto p-6 space-y-4">
          <div className="text-sm text-muted-foreground">
            Week {problem.week} · Day {problem.day} · {problem.focus}
          </div>
          <ProblemDescription content={problem.description} />
        </div>

        {/* Right: Editor + Tests */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0">
            <Editor
              height="100%"
              language="python"
              theme="vs-dark"
              value={code}
              onChange={(v) => setCode(v || "")}
              options={{
                minimap: { enabled: false },
                fontSize: 14,
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 16 },
              }}
            />
          </div>

          {/* Bottom Panel */}
          <div className="h-48 border-t border-border flex flex-col bg-card">
            <div className="flex items-center gap-4 px-4 border-b border-border">
              <button
                onClick={() => setActiveTab("testcase")}
                className={`flex items-center gap-1.5 py-2 text-sm border-b-2 transition-colors ${
                  activeTab === "testcase"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <ListChecks className="w-4 h-4" />
                Testcase
              </button>
              <button
                onClick={() => setActiveTab("result")}
                className={`flex items-center gap-1.5 py-2 text-sm border-b-2 transition-colors ${
                  activeTab === "result"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Terminal className="w-4 h-4" />
                Test Result
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 text-sm">
              {activeTab === "testcase" ? (
                <div className="text-muted-foreground">
                  Click Run to execute visible test cases.
                </div>
              ) : results ? (
                <div className="space-y-2">
                  {results.results.map((r, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded border ${
                        r.passed
                          ? "bg-green-500/10 border-green-500/20"
                          : "bg-red-500/10 border-red-500/20"
                      }`}
                    >
                      <div className="flex items-center gap-2 font-medium">
                        <span
                          className={
                            r.passed ? "text-green-400" : "text-red-400"
                          }
                        >
                          {r.passed ? "✓" : "✗"}
                        </span>
                        {r.name}
                      </div>
                      {r.error && (
                        <div className="mt-1 text-red-400 whitespace-pre-wrap text-xs">
                          {r.error}
                        </div>
                      )}
                      {!r.passed && !r.error && (
                        <div className="mt-1 space-y-1 text-xs">
                          <div className="text-muted-foreground">
                            Expected: {r.expected}
                          </div>
                          <div className="text-muted-foreground">
                            Actual: {r.actual}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground">
                  Run or Submit to see results.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
