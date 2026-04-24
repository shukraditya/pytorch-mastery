"use client";

import { useEffect, useState, useMemo } from "react";
import { getProblems } from "@/lib/api";
import { ProblemSummary } from "@/lib/types";
import { getProgress, arePrerequisitesMet } from "@/lib/progress";
import { CheckCircle2, Lock, ArrowLeft, Map as MapIcon } from "lucide-react";
import { useRouter } from "next/navigation";

interface NodeLayout {
  id: string;
  x: number;
  y: number;
  level: number;
}

interface EdgeLayout {
  from: string;
  to: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const NODE_WIDTH = 140;
const NODE_HEIGHT = 48;
const COL_WIDTH = 180;
const ROW_GAP = 64;
const MARGIN_X = 40;
const MARGIN_Y = 32;

function computeTopology(problems: ProblemSummary[]): Map<string, number> {
  const levels = new Map<string, number>();

  function getLevel(id: string): number {
    if (levels.has(id)) return levels.get(id)!;
    const p = problems.find((pr) => pr.id === id);
    if (!p || p.prerequisites.length === 0) {
      levels.set(id, 0);
      return 0;
    }
    const maxParent = Math.max(...p.prerequisites.map(getLevel));
    const level = maxParent + 1;
    levels.set(id, level);
    return level;
  }

  for (const p of problems) getLevel(p.id);
  return levels;
}

function buildLayout(problems: ProblemSummary[]): {
  nodes: NodeLayout[];
  edges: EdgeLayout[];
  width: number;
  height: number;
} {
  const levels = computeTopology(problems);
  const maxLevel = Math.max(0, ...Array.from(levels.values()));

  const byLevel = new Map<number, ProblemSummary[]>();
  for (const p of problems) {
    const lv = levels.get(p.id) ?? 0;
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv)!.push(p);
  }

  // Sort within each level alphabetically by title for stability
  for (const [, arr] of byLevel) {
    arr.sort((a, b) => a.title.localeCompare(b.title));
  }

  const nodeMap = new Map<string, NodeLayout>();
  let maxY = 0;

  for (let lv = 0; lv <= maxLevel; lv++) {
    const arr = byLevel.get(lv) ?? [];
    const totalHeight = arr.length * NODE_HEIGHT + (arr.length - 1) * ROW_GAP;
    const startY = MARGIN_Y + Math.max(0, (600 - totalHeight) / 2);

    arr.forEach((p, i) => {
      const x = MARGIN_X + lv * COL_WIDTH;
      const y = startY + i * (NODE_HEIGHT + ROW_GAP);
      nodeMap.set(p.id, { id: p.id, x, y, level: lv });
      maxY = Math.max(maxY, y + NODE_HEIGHT);
    });
  }

  const edges: EdgeLayout[] = [];
  for (const p of problems) {
    const to = nodeMap.get(p.id);
    if (!to) continue;
    for (const prereqId of p.prerequisites) {
      const from = nodeMap.get(prereqId);
      if (from) {
        edges.push({
          from: prereqId,
          to: p.id,
          x1: from.x + NODE_WIDTH,
          y1: from.y + NODE_HEIGHT / 2,
          x2: to.x - 10,
          y2: to.y + NODE_HEIGHT / 2,
        });
      }
    }
  }

  const width = MARGIN_X * 2 + maxLevel * COL_WIDTH + NODE_WIDTH;
  const height = maxY + MARGIN_Y;

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
    width,
    height,
  };
}

function StatusBadge({
  completed,
  unlocked,
}: {
  completed: boolean;
  unlocked: boolean;
}) {
  if (completed) {
    return (
      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
        <CheckCircle2 className="w-3 h-3 text-white" />
      </span>
    );
  }
  if (!unlocked) {
    return (
      <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-muted flex items-center justify-center border border-border">
        <Lock className="w-2.5 h-2.5 text-muted-foreground" />
      </span>
    );
  }
  return null;
}

export default function SkillTreePage() {
  const router = useRouter();
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<string | null>(null);

  useEffect(() => {
    getProblems().then((data) => {
      setProblems(data);
      setLoading(false);
    });
  }, []);

  const progress = useMemo(() => getProgress(), []);

  const { nodes, edges, width, height } = useMemo(() => {
    if (problems.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };
    return buildLayout(problems);
  }, [problems]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, ProblemSummary>();
    for (const p of problems) m.set(p.id, p);
    return m;
  }, [problems]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-muted-foreground">
        Loading skill tree...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="h-14 border-b border-white/5 flex items-center px-4 justify-between bg-background/60 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/")}
            className="p-1.5 rounded-lg hover:bg-white/5 active:scale-95 transition-all text-muted-foreground"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="w-px h-5 bg-white/10" />
          <div className="flex items-center gap-2">
            <MapIcon className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm tracking-tight">Skill Tree</span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
            Completed
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-primary" />
            Unlocked
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-muted border border-border" />
            Locked
          </div>
        </div>
      </header>

      {/* Graph */}
      <div className="p-6 overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto"
          style={{ minWidth: width, minHeight: height }}
        >
          <defs>
            <marker
              id="arrowhead"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.15)" />
            </marker>
            <marker
              id="arrowhead-active"
              markerWidth="8"
              markerHeight="6"
              refX="7"
              refY="3"
              orient="auto"
            >
              <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.4)" />
            </marker>
          </defs>

          {/* Edges */}
          {edges.map((e, i) => {
            const isHovered = hovered === e.from || hovered === e.to;
            const dx = e.x2 - e.x1;
            const c1x = e.x1 + dx * 0.5;
            const c2x = e.x2 - dx * 0.5;
            const path = `M ${e.x1} ${e.y1} C ${c1x} ${e.y1}, ${c2x} ${e.y2}, ${e.x2} ${e.y2}`;

            return (
              <path
                key={i}
                d={path}
                fill="none"
                stroke={isHovered ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.1)"}
                strokeWidth={isHovered ? 2 : 1}
                markerEnd={isHovered ? "url(#arrowhead-active)" : "url(#arrowhead)"}
                className="transition-all duration-200"
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((n) => {
            const p = nodeMap.get(n.id);
            if (!p) return null;

            const completed = !!progress[p.id];
            const unlocked = arePrerequisitesMet(p.prerequisites, progress);

            const isLocked = !unlocked && !completed;
            const isCompleted = completed;

            let fill = "rgba(255,255,255,0.03)";
            let stroke = "rgba(255,255,255,0.08)";
            let textColor = "rgba(255,255,255,0.5)";

            if (isCompleted) {
              fill = "rgba(34,197,94,0.08)";
              stroke = "rgba(34,197,94,0.3)";
              textColor = "rgba(74,222,128,0.9)";
            } else if (unlocked) {
              fill = p.tier === "core" ? "rgba(251,146,60,0.06)" : "rgba(96,165,250,0.06)";
              stroke = p.tier === "core" ? "rgba(251,146,60,0.25)" : "rgba(96,165,250,0.2)";
              textColor = "rgba(255,255,255,0.85)";
            }

            const isHovered = hovered === p.id;

            return (
              <g
                key={p.id}
                transform={`translate(${n.x}, ${n.y})`}
                className={isLocked ? "cursor-not-allowed" : "cursor-pointer"}
                onMouseEnter={() => setHovered(p.id)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => router.push(`/problem/${p.id}`)}
              >
                <rect
                  width={NODE_WIDTH}
                  height={NODE_HEIGHT}
                  rx={10}
                  fill={fill}
                  stroke={isHovered ? "rgba(255,255,255,0.4)" : stroke}
                  strokeWidth={isHovered ? 2 : 1}
                  className="transition-all duration-200"
                />
                <text
                  x={NODE_WIDTH / 2}
                  y={18}
                  textAnchor="middle"
                  fill={textColor}
                  fontSize={10}
                  fontWeight={600}
                  className="pointer-events-none select-none"
                >
                  {p.title}
                </text>
                <text
                  x={NODE_WIDTH / 2}
                  y={34}
                  textAnchor="middle"
                  fill={isHovered ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.35)"}
                  fontSize={9}
                  className="pointer-events-none select-none"
                >
                  {p.difficulty} · {p.time_estimate}
                </text>

                {/* Status dot */}
                {isCompleted && (
                  <circle cx={NODE_WIDTH - 6} cy={8} r={4} fill="#22c55e" />
                )}
                {isLocked && (
                  <circle
                    cx={NODE_WIDTH - 6}
                    cy={8}
                    r={4}
                    fill="rgba(255,255,255,0.05)"
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth={1}
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
