"use client";

import { useEffect, useState } from "react";
import { getProblems } from "@/lib/api";
import { ProblemSummary } from "@/lib/types";
import { getProgress, arePrerequisitesMet } from "@/lib/progress";
import { CheckCircle2, Lock, Flame, Map as MapIcon } from "lucide-react";

function DifficultyBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Easy: "bg-green-500/15 text-green-400 border-green-500/25",
    Medium: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
    Hard: "bg-red-500/15 text-red-400 border-red-500/25",
  };
  return (
    <span
      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border uppercase tracking-wider ${colors[level] || colors.Easy}`}
    >
      {level}
    </span>
  );
}

function sortProblems(problems: ProblemSummary[]) {
  return [...problems].sort((a, b) => {
    if (a.week !== b.week) return a.week - b.week;
    if (a.day !== b.day) return a.day - b.day;
    return a.id.localeCompare(b.id);
  });
}

function getUnlockStatus(
  problems: ProblemSummary[]
): Map<string, { unlocked: boolean; completed: boolean; unlocks: string[] }> {
  const progress = getProgress();
  const status = new Map<string, { unlocked: boolean; completed: boolean; unlocks: string[] }>();

  for (const p of problems) {
    const completed = !!progress[p.id];
    const unlocked = arePrerequisitesMet(p.prerequisites, progress);
    const unlocks = problems
      .filter((other) => other.prerequisites.includes(p.id))
      .map((other) => other.id);
    status.set(p.id, { unlocked, completed, unlocks });
  }

  return status;
}

function ProgressRing({ total, completed }: { total: number; completed: number }) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const progress = total > 0 ? completed / total : 0;
  const dashoffset = circumference - progress * circumference;

  return (
    <div className="flex items-center gap-3">
      <div className="relative w-14 h-14">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 52 52">
          <circle
            cx="26"
            cy="26"
            r={radius}
            fill="none"
            stroke="var(--muted)"
            strokeWidth="4"
          />
          <circle
            cx="26"
            cy="26"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={dashoffset}
            className="text-orange-400 transition-all duration-700 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Flame className="w-4 h-4 text-orange-400" />
        </div>
      </div>
      <div>
        <div className="text-2xl font-bold leading-none tracking-tight">
          {completed}/{total}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">completed</div>
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-10 animate-fade-in">
      <div className="h-10 w-64 rounded-lg bg-muted animate-shimmer mb-2" />
      <div className="h-5 w-96 rounded-md bg-muted animate-shimmer mb-10" />
      <div className="space-y-10">
        {[1, 2, 3].map((w) => (
          <div key={w}>
            <div className="h-6 w-24 rounded-md bg-muted animate-shimmer mb-4" />
            <div className="grid gap-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[72px] rounded-xl bg-muted animate-shimmer"
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export default function Home() {
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [tierFilter, setTierFilter] = useState<"all" | "core">("all");

  useEffect(() => {
    getProblems().then((data) => {
      setProblems(sortProblems(data));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <DashboardSkeleton />;
  }

  const byWeek = new Map<number, ProblemSummary[]>();
  for (const p of problems) {
    if (!byWeek.has(p.week)) byWeek.set(p.week, []);
    byWeek.get(p.week)!.push(p);
  }

  const status = getUnlockStatus(problems);
  const completedCount = Array.from(status.values()).filter((s) => s.completed).length;

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 animate-fade-in">
      {/* Hero */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-2">
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-yellow-200 bg-clip-text text-transparent">
              PyTorch Mastery
            </span>
          </h1>
          <p className="text-lg text-muted-foreground font-light">
            LeetCode-style problems to deepen your PyTorch fundamentals.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="/skill-tree"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted/60 hover:bg-accent/60 text-sm font-medium transition-all border border-white/5"
          >
            <MapIcon className="w-4 h-4" />
            Skill Tree
          </a>
          <ProgressRing total={problems.length} completed={completedCount} />
        </div>
      </div>

      {/* Tier toggle */}
      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={() => setTierFilter("all")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            tierFilter === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          All
        </button>
        <button
          onClick={() => setTierFilter("core")}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            tierFilter === "core"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-muted/60 text-muted-foreground hover:text-foreground"
          }`}
        >
          Core Only
        </button>
      </div>

      {/* Weeks */}
      <div className="space-y-10">
        {Array.from(byWeek.entries()).map(([week, items], weekIndex) => {
          const visibleItems =
            tierFilter === "core"
              ? items.filter((p) => p.tier === "core")
              : items;
          if (visibleItems.length === 0) return null;

          return (
            <section
              key={week}
              className="animate-slide-up"
              style={{ animationDelay: `${weekIndex * 60}ms`, opacity: 0 }}
            >
              <h2 className="text-sm font-semibold mb-4 text-muted-foreground uppercase tracking-wider">
                Week {week}
              </h2>
              <div className="grid gap-3">
                {visibleItems.map((p, itemIndex) => {
                  const s = status.get(p.id)!;
                  const delay = weekIndex * 60 + itemIndex * 30;
                  const remainingPrereqs = p.prerequisites.filter(
                    (id) => !getProgress()[id]
                  ).length;

                  if (!s.unlocked) {
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-4 rounded-xl border border-border/60 bg-muted/30 opacity-50 grayscale cursor-not-allowed transition-all duration-200"
                        style={{ animationDelay: `${delay}ms` }}
                      >
                        <div className="flex items-center gap-4">
                          <span className="text-sm text-muted-foreground w-12">
                            Day {p.day}
                          </span>
                          <div className="min-w-0">
                            <div className="font-medium flex items-center gap-2">
                              {p.title}
                              <Lock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {p.focus}
                            </div>
                            {remainingPrereqs > 0 && (
                              <div className="text-[10px] text-muted-foreground mt-0.5">
                                Locked — complete {remainingPrereqs} prerequisite
                                {remainingPrereqs > 1 ? "s" : ""}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[10px] text-muted-foreground tabular-nums">
                            ~{p.lines_estimate} lines
                          </span>
                          <DifficultyBadge level={p.difficulty} />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <a
                      key={p.id}
                      href={`/problem/${p.id}`}
                      className="group flex items-center justify-between p-4 rounded-xl border border-border/60 bg-card hover:bg-accent/40 hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/20 hover:shadow-black/20 transition-all duration-200 ease-out"
                      style={{ animationDelay: `${delay}ms` }}
                    >
                      <div className="flex items-center gap-4 min-w-0">
                        <span className="text-sm text-muted-foreground w-12 shrink-0">
                          Day {p.day}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium flex items-center gap-2 group-hover:text-foreground transition-colors">
                            {p.title}
                            {s.completed && (
                              <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0" />
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {p.focus}
                          </div>
                          {s.completed && s.unlocks.length > 0 && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Unlocks: {s.unlocks.join(", ")}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-[10px] text-muted-foreground tabular-nums">
                          {p.time_estimate}
                        </span>
                        <DifficultyBadge level={p.difficulty} />
                      </div>
                    </a>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </main>
  );
}
