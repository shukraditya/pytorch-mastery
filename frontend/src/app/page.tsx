import Link from "next/link";
import { getProblems } from "@/lib/api";
import { ProblemSummary } from "@/lib/types";

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

function groupByWeek(problems: ProblemSummary[]) {
  const map = new Map<number, ProblemSummary[]>();
  for (const p of problems) {
    if (!map.has(p.week)) map.set(p.week, []);
    map.get(p.week)!.push(p);
  }
  return map;
}

export default async function Home() {
  const problems = await getProblems();
  const byWeek = groupByWeek(problems);

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
              {items.map((p) => (
                <Link
                  key={p.id}
                  href={`/problem/${p.id}`}
                  className="flex items-center justify-between p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground w-12">
                      Day {p.day}
                    </span>
                    <div>
                      <div className="font-medium">{p.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.focus}
                      </div>
                    </div>
                  </div>
                  <DifficultyBadge level={p.difficulty} />
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
