"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { getProblem, getProblems, runCode } from "@/lib/api";
import { Problem, ProblemSummary, RunResponse, Example } from "@/lib/types";
import { getProgress, setProblemCompleted } from "@/lib/progress";
import dynamic from "next/dynamic";
import { Play, Send, Terminal, ListChecks, Lock, ChevronLeft, CheckCircle2, XCircle, Loader2 } from "lucide-react";
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

function formatExampleInput(inputs: Record<string, string>): string {
  return Object.entries(inputs)
    .map(([k, v]) => `${k} = ${v}`)
    .join("\n");
}

function formatExampleOutput(expected: Record<string, any>): string {
  if (expected.shape) {
    const parts: string[] = [];
    const shapeStr = Array.isArray(expected.shape)
      ? expected.shape.join(", ")
      : expected.shape;
    parts.push(`shape=[${shapeStr}]`);
    if (expected.dtype) parts.push(`dtype=${expected.dtype}`);
    if (expected.device) parts.push(`device=${expected.device}`);
    return parts.join(", ");
  }
  if (expected.value) return expected.value;
  return JSON.stringify(expected);
}

function ProblemSkeleton() {
  return (
    <div className="h-screen flex flex-col bg-background animate-fade-in">
      <div className="h-14 border-b border-border flex items-center px-4 justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md bg-muted animate-shimmer" />
          <div className="w-px h-5 bg-border" />
          <div className="space-y-1.5">
            <div className="h-4 w-40 rounded-md bg-muted animate-shimmer" />
            <div className="h-3 w-24 rounded-md bg-muted animate-shimmer" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-20 rounded-md bg-muted animate-shimmer" />
          <div className="h-8 w-24 rounded-md bg-muted animate-shimmer" />
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <div className="w-[45%] border-r border-border p-6 space-y-6">
          <div className="h-6 w-32 rounded-full bg-muted animate-shimmer" />
          <div className="space-y-3">
            <div className="h-4 w-full rounded-md bg-muted animate-shimmer" />
            <div className="h-4 w-5/6 rounded-md bg-muted animate-shimmer" />
            <div className="h-4 w-4/6 rounded-md bg-muted animate-shimmer" />
          </div>
        </div>
        <div className="flex-1 flex flex-col">
          <div className="flex-1 bg-muted/30 animate-shimmer m-2 rounded-lg" />
          <div className="h-56 border-t border-border p-4 space-y-3">
            <div className="h-4 w-24 rounded-md bg-muted animate-shimmer" />
            <div className="h-20 rounded-lg bg-muted animate-shimmer" />
          </div>
        </div>
      </div>
    </div>
  );
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
  const [leftWidth, setLeftWidth] = useState(45);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const [bottomHeight, setBottomHeight] = useState(224);
  const [isVDragging, setIsVDragging] = useState(false);
  const rightPaneRef = useRef<HTMLDivElement>(null);

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

  const handleMouseDown = useCallback(() => {
    setIsDragging(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      setLeftWidth(Math.max(25, Math.min(70, pct)));
    },
    [isDragging]
  );

  const handleVMouseDown = useCallback(() => {
    setIsVDragging(true);
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, []);

  const handleVMouseUp = useCallback(() => {
    setIsVDragging(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const handleVMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isVDragging || !rightPaneRef.current) return;
      const rect = rightPaneRef.current.getBoundingClientRect();
      const bottom = rect.bottom - e.clientY;
      setBottomHeight(Math.max(120, Math.min(rect.height - 200, bottom)));
    },
    [isVDragging]
  );

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  useEffect(() => {
    if (isVDragging) {
      window.addEventListener("mousemove", handleVMouseMove);
      window.addEventListener("mouseup", handleVMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleVMouseMove);
      window.removeEventListener("mouseup", handleVMouseUp);
    };
  }, [isVDragging, handleVMouseMove, handleVMouseUp]);

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
      <div className="h-screen flex flex-col items-center justify-center gap-5 text-muted-foreground bg-background animate-fade-in">
        <div className="relative">
          <Lock className="w-14 h-14 animate-pulse-soft" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Problem Locked</h1>
          <p className="text-sm">Complete the previous problems to unlock this one.</p>
        </div>
        <button
          onClick={() => router.push("/")}
          className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.97] text-sm font-medium transition-all shadow-lg shadow-primary/20"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (!problem) {
    return <ProblemSkeleton />;
  }

  return (
    <div className="h-screen flex flex-col bg-background animate-fade-in">
      {/* Header */}
      <header className="h-14 border-b border-white/5 flex items-center px-4 justify-between bg-background/60 backdrop-blur-xl shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 rounded-lg hover:bg-white/5 active:scale-95 transition-all text-muted-foreground"
            title="Back to dashboard"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex flex-col">
            <span className="font-semibold text-sm leading-tight tracking-tight">{problem.title}</span>
            <span className="text-xs text-muted-foreground">
              Week {problem.week} · Day {problem.day}
            </span>
          </div>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
              problem.difficulty === "Easy"
                ? "bg-green-500/10 text-green-400 border-green-500/20"
                : problem.difficulty === "Medium"
                ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                : "bg-red-500/10 text-red-400 border-red-500/20"
            }`}
          >
            {problem.difficulty}
          </span>
          {completed && (
            <span className="flex items-center gap-1 text-green-400 text-xs font-medium animate-fade-in">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Completed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRun}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-muted/60 hover:bg-accent/60 hover:shadow-sm active:scale-[0.97] text-sm font-medium transition-all disabled:opacity-50 border border-white/5"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
            Run
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary text-primary-foreground hover:brightness-110 active:scale-[0.97] text-sm font-medium transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            Submit
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div ref={containerRef} className="flex-1 flex overflow-hidden">
        {/* Left: Description */}
        <div
          className="border-r border-white/5 overflow-y-auto bg-card/10"
          style={{ width: `${leftWidth}%` }}
        >
          <div className="max-w-none p-6 space-y-6">
            {/* Focus badge */}
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-accent/40 border border-white/5 text-xs text-muted-foreground font-medium">
              {problem.focus}
            </div>

            {/* Description */}
            <ProblemDescription content={problem.description} />

            {/* Examples */}
            {problem.test_cases && problem.test_cases.visible.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-muted-foreground" />
                  Examples
                </h3>
                <div className="space-y-3">
                  {problem.test_cases.visible.map((ex, i) => (
                    <ExampleCard key={i} example={ex} index={i} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Resizer */}
        <div
          onMouseDown={handleMouseDown}
          className={`w-2 shrink-0 cursor-col-resize relative z-10 flex items-center justify-center transition-colors duration-150 ${
            isDragging ? "bg-primary/40" : "bg-transparent hover:bg-primary/20"
          }`}
        >
          <div
            className={`h-8 w-0.5 rounded-full transition-all duration-150 ${
              isDragging ? "bg-primary" : "bg-border hover:bg-primary/50"
            }`}
          />
        </div>

        {/* Right: Editor + Tests */}
        <div ref={rightPaneRef} className="flex-1 flex flex-col overflow-hidden min-w-0">
          <div className="flex-1 min-h-0 p-3">
            <div className="h-full rounded-xl overflow-hidden border border-white/5 shadow-inner bg-[#1e1e1e]">
              <Editor
                height="100%"
                language="python"
                theme="vs-dark"
                value={code}
                onChange={(v) => setCode(v || "")}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  lineHeight: 22,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 16, bottom: 16 },
                  fontFamily: "ui-monospace, SF Mono, Menlo, monospace",
                  roundedSelection: true,
                }}
              />
            </div>
          </div>

          {/* Vertical Resizer */}
          <div
            onMouseDown={handleVMouseDown}
            className={`h-2 shrink-0 cursor-row-resize relative z-10 flex items-center justify-center transition-colors duration-150 ${
              isVDragging ? "bg-primary/40" : "bg-transparent hover:bg-primary/20"
            }`}
          >
            <div
              className={`w-8 h-0.5 rounded-full transition-all duration-150 ${
                isVDragging ? "bg-primary" : "bg-border hover:bg-primary/50"
              }`}
            />
          </div>

          {/* Bottom Panel */}
          <div
            className="border-t border-white/5 flex flex-col bg-card/40 backdrop-blur-sm shrink-0"
            style={{ height: `${bottomHeight}px` }}
          >
            <div className="relative flex items-center gap-1 px-4 border-b border-white/5">
              <TabButton
                active={activeTab === "testcase"}
                onClick={() => setActiveTab("testcase")}
                icon={<ListChecks className="w-3.5 h-3.5" />}
                label="Testcase"
              />
              <TabButton
                active={activeTab === "result"}
                onClick={() => setActiveTab("result")}
                icon={<Terminal className="w-3.5 h-3.5" />}
                label="Test Result"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4 text-sm">
              {activeTab === "testcase" ? (
                <div className="animate-fade-in">
                  {problem.test_cases && problem.test_cases.visible.length > 0 ? (
                    <div className="space-y-3">
                      {problem.test_cases.visible.map((tc, i) => (
                        <div key={i} className="rounded-xl border border-white/5 bg-muted/30 overflow-hidden hover:border-white/10 transition-colors">
                          <div className="px-3 py-2 border-b border-white/5 bg-muted/50 flex items-center justify-between">
                            <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                              Testcase {i + 1}
                            </span>
                            <span className="text-xs text-muted-foreground">{tc.name}</span>
                          </div>
                          <div className="p-3">
                            <span className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Input</span>
                            <pre className="mt-1 font-mono text-foreground/90 bg-background rounded-lg p-2.5 overflow-x-auto text-xs border border-white/5">
                              {formatExampleInput(tc.inputs)}
                            </pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-sm">
                      No visible test cases available.
                    </div>
                  )}
                </div>
              ) : loading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm animate-fade-in">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Running tests...
                </div>
              ) : results ? (
                <div className="space-y-2 animate-fade-in">
                  {results.results.map((r, i) => (
                    <ResultCard key={i} result={r} index={i} />
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm animate-fade-in">
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

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex items-center gap-1.5 py-2.5 px-3 text-sm transition-colors ${
        active
          ? "text-foreground font-medium"
          : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {label}
      {active && (
        <span className="absolute bottom-0 left-1 right-1 h-0.5 bg-primary rounded-full transition-all duration-200" />
      )}
    </button>
  );
}

function ExampleCard({ example, index }: { example: Example; index: number }) {
  return (
    <div className="rounded-xl border border-white/5 bg-muted/30 overflow-hidden hover:border-white/10 transition-colors">
      <div className="px-3 py-2 border-b border-white/5 bg-muted/50 flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
          Example {index + 1}
        </span>
        <span className="text-xs text-muted-foreground">{example.name}</span>
      </div>
      <div className="p-3 space-y-2 text-xs">
        <div>
          <span className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Input</span>
          <pre className="mt-1 font-mono text-foreground/90 bg-background rounded-lg p-2.5 overflow-x-auto border border-white/5">
            {formatExampleInput(example.inputs)}
          </pre>
        </div>
        <div>
          <span className="text-muted-foreground font-medium uppercase tracking-wide text-[10px]">Expected</span>
          <pre className="mt-1 font-mono text-blue-400/90 bg-background rounded-lg p-2.5 overflow-x-auto border border-white/5">
            {formatExampleOutput(example.expected)}
          </pre>
        </div>
      </div>
    </div>
  );
}

function ResultCard({ result, index }: { result: RunResponse["results"][0]; index: number }) {
  return (
    <div
      className={`rounded-xl border p-3 animate-slide-up ${
        result.passed
          ? "bg-green-500/5 border-green-500/15 border-l-2 border-l-green-400/60"
          : "bg-red-500/5 border-red-500/15 border-l-2 border-l-red-400/60"
      }`}
      style={{ animationDelay: `${index * 60}ms`, opacity: 0 }}
    >
      <div className="flex items-center gap-2 font-medium text-sm">
        {result.passed ? (
          <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400 shrink-0" />
        )}
        <span className={result.passed ? "text-green-400" : "text-red-400"}>{result.name}</span>
      </div>
      {result.error && (
        <div className="mt-2 text-red-400 whitespace-pre-wrap text-xs font-mono bg-red-500/5 rounded-lg p-2.5 border border-red-500/10">
          {result.error}
        </div>
      )}
      {!result.passed && !result.error && (
        <div className="mt-2 space-y-1 text-xs font-mono">
          <div className="flex gap-2">
            <span className="text-muted-foreground shrink-0 w-16">Expected:</span>
            <span className="text-green-400/80">{result.expected}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground shrink-0 w-16">Actual:</span>
            <span className="text-red-400/80">{result.actual}</span>
          </div>
        </div>
      )}
    </div>
  );
}
