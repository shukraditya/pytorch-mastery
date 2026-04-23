"use client";

import { useEffect, useState } from "react";
import { getProblems } from "@/lib/api";
import { ProblemSummary } from "@/lib/types";
import { getProgress } from "@/lib/progress";
import { CheckCircle2, Lock } from "lucide-react";

function DifficultyBadge({ level }: { level: string }) {
  const colors: Record<string, string> = {
    Easy: "bg-green-500/20 text-green-400 border-green-500/30",
    Medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    Hard: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium border ${colors[level] || colors.Easy}`}
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
  sorted: ProblemSummary[]
): Map<string, { unlocked: boolean; completed: boolean }> {
  const progress = getProgress();
  const status = new Map<string, { unlocked: boolean; completed: boolean }>();

  for (let i = 0; i < sorted.length; i++) {
    const p = sorted[i];
    const completed = !!progress[p.id];
    let unlocked = false;
    if (i === 0) {
      unlocked = true;
    } else {
      const prev = sorted[i - 1];
      unlocked = !!progress[prev.id];
    }
    status.set(p.id, { unlocked, completed });
  }

  return status;
}

export default function Home() {
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getProblems().then((data) => {
      setProblems(sortProblems(data));
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-muted-foreground">
        Loading...
      </div>
    );
  }

  const byWeek = new Map<number, ProblemSummary[]>();
  for (const p of problems) {
    if (!byWeek.has(p.week)) byWeek.set(p.week, []);
    byWeek.get(p.week)!.push(p);
  }

  const status = getUnlockStatus(problems);

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="text-3xl font-bold mb-2">PyTorch Mastery</h1>
      <p className="text-muted-foreground mb-8">
        LeetCode-style problems to deepen your PyTorch fundamentals.
      </p>

      <div className="space-y-8">
        {Array.from(byWeek.entries()).map(([week, items]) => (
          <section key={week}>
            <h2 className="text-lg font-semibold mb-3 text-foreground">
              Week {week}
            </h2>
            <div className="grid gap-3">
              {items.map((p) => {
                const s = status.get(p.id)!;
                if (!s.unlocked) {
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-border bg-muted/40 opacity-60 cursor-not-allowed"
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground w-12">
                          Day {p.day}
                        </span>
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {p.title}
                            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {p.focus}
                          </div>
                        </div>
                      </div>
                      <DifficultyBadge level={p.difficulty} />
                    </div>
                  );
                }

                return (
                  <a
                    key={p.id}
                    href={`/problem/${p.id}`}
                    className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground w-12">
                        Day {p.day}
                      </span>
                      <div>
                        <div className="font-medium flex items-center gap-2">
                          {p.title}
                          {s.completed && (
                            <CheckCircle2 className="w-4 h-4 text-green-400" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {p.focus}
                        </div>
                      </div>
                    </div>
                    <DifficultyBadge level={p.difficulty} />
                  </a>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
