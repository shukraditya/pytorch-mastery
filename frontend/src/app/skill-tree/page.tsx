"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
  type EdgeProps,
  Handle,
  Position,
  getBezierPath,
  BaseEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { getProblems } from "@/lib/api";
import { ProblemSummary } from "@/lib/types";
import { getProgress, arePrerequisitesMet } from "@/lib/progress";
import { ArrowLeft, Map as MapIcon, CheckCircle2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

const NODE_WIDTH = 160;
const NODE_HEIGHT = 56;
const COL_WIDTH = 220;
const ROW_GAP = 80;

interface NodeData extends Record<string, unknown> {
  problem: ProblemSummary;
  completed: boolean;
  unlocked: boolean;
}

function SkillNode({ data, selected }: NodeProps) {
  const router = useRouter();
  const d = data as NodeData;
  const { problem, completed, unlocked } = d;
  const isLocked = !unlocked && !completed;

  let borderColor = "rgba(255,255,255,0.1)";
  let bgColor = "rgba(255,255,255,0.03)";
  let titleColor = "rgba(255,255,255,0.6)";
  let metaColor = "rgba(255,255,255,0.3)";

  if (completed) {
    borderColor = "rgba(34,197,94,0.4)";
    bgColor = "rgba(34,197,94,0.08)";
    titleColor = "rgba(74,222,128,1)";
    metaColor = "rgba(74,222,128,0.5)";
  } else if (unlocked) {
    if (problem.tier === "core") {
      borderColor = "rgba(251,146,60,0.35)";
      bgColor = "rgba(251,146,60,0.08)";
    } else {
      borderColor = "rgba(96,165,250,0.3)";
      bgColor = "rgba(96,165,250,0.06)";
    }
    titleColor = "rgba(255,255,255,0.9)";
    metaColor = "rgba(255,255,255,0.45)";
  }

  if (selected) {
    borderColor = "rgba(255,255,255,0.6)";
  }

  return (
    <div
      className={`relative rounded-xl border px-3 py-2 transition-all duration-200 ${
        isLocked ? "cursor-not-allowed" : "cursor-pointer hover:scale-[1.02]"
      }`}
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT,
        backgroundColor: bgColor,
        borderColor: borderColor,
        boxShadow: selected
          ? "0 0 0 2px rgba(255,255,255,0.15)"
          : "0 4px 12px rgba(0,0,0,0.3)",
      }}
      onClick={() => router.push(`/problem/${problem.id}`)}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: "transparent", border: "none", width: 1, height: 1 }}
      />
      <div className="flex flex-col justify-center h-full">
        <div className="flex items-center gap-1.5">
          <span
            className="text-[11px] font-semibold truncate leading-tight"
            style={{ color: titleColor }}
          >
            {problem.title}
          </span>
          {completed && <CheckCircle2 className="w-3 h-3 text-green-400 shrink-0" />}
          {isLocked && <Lock className="w-3 h-3 text-muted-foreground shrink-0" />}
        </div>
        <span className="text-[10px] mt-0.5" style={{ color: metaColor }}>
          {problem.difficulty} · {problem.time_estimate}
        </span>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        style={{ background: "transparent", border: "none", width: 1, height: 1 }}
      />
    </div>
  );
}

function BezierEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  selected,
}: EdgeProps) {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.35,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        ...style,
        stroke: selected ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.12)",
        strokeWidth: selected ? 2 : 1.5,
      }}
      markerEnd="url(#arrowhead)"
    />
  );
}

const edgeTypes = {
  bezier: BezierEdge,
} as any;

const nodeTypes: Record<string, React.ComponentType<NodeProps>> = {
  skill: SkillNode as React.ComponentType<NodeProps>,
};

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

function buildFlowElements(problems: ProblemSummary[], progress: Record<string, boolean>): { nodes: Node[]; edges: Edge[] } {
  const levels = computeTopology(problems);
  const maxLevel = Math.max(0, ...Array.from(levels.values()));

  const byLevel = new Map<number, ProblemSummary[]>();
  for (const p of problems) {
    const lv = levels.get(p.id) ?? 0;
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv)!.push(p);
  }

  for (const [, arr] of byLevel) {
    arr.sort((a, b) => a.title.localeCompare(b.title));
  }

  const nodes: Node[] = [];
  let maxY = 0;

  for (let lv = 0; lv <= maxLevel; lv++) {
    const arr = byLevel.get(lv) ?? [];
    const totalHeight = arr.length * NODE_HEIGHT + (arr.length - 1) * ROW_GAP;
    const startY = Math.max(0, (600 - totalHeight) / 2);

    arr.forEach((p, i) => {
      const x = lv * COL_WIDTH;
      const y = startY + i * (NODE_HEIGHT + ROW_GAP);
      maxY = Math.max(maxY, y + NODE_HEIGHT);

      nodes.push({
        id: p.id,
        type: "skill",
        position: { x, y },
        data: {
          problem: p,
          completed: !!progress[p.id],
          unlocked: arePrerequisitesMet(p.prerequisites, progress),
        },
      });
    });
  }

  const edges: Edge[] = [];
  for (const p of problems) {
    for (const prereqId of p.prerequisites) {
      edges.push({
        id: `${prereqId}-${p.id}`,
        source: prereqId,
        target: p.id,
        type: "bezier",
        animated: false,
        style: { stroke: "rgba(255,255,255,0.12)", strokeWidth: 1.5 },
      });
    }
  }

  return { nodes, edges };
}

export default function SkillTreePage() {
  const router = useRouter();
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const progress = useMemo(() => getProgress(), []);

  const initialElements = useMemo(() => {
    if (problems.length === 0) return { nodes: [], edges: [] };
    return buildFlowElements(problems, progress);
  }, [problems, progress]);

  const [nodes, , onNodesChange] = useNodesState(initialElements.nodes);
  const [edges, , onEdgesChange] = useEdgesState(initialElements.edges);

  useEffect(() => {
    getProblems().then((data) => {
      setProblems(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (problems.length > 0) {
      const { nodes: newNodes, edges: newEdges } = buildFlowElements(problems, progress);
      onNodesChange(newNodes.map((n) => ({ type: "add" as const, item: n })));
      onEdgesChange(newEdges.map((e) => ({ type: "add" as const, item: e })));
    }
  }, [problems, progress, onNodesChange, onEdgesChange]);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      router.push(`/problem/${node.id}`);
    },
    [router]
  );

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center text-muted-foreground">
        Loading skill tree...
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="h-14 border-b border-white/5 flex items-center px-4 justify-between bg-background/60 backdrop-blur-xl shrink-0 z-10">
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
            <span className="w-2.5 h-2.5 rounded-full border border-orange-400" />
            Core
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-blue-400" />
            Depth
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-muted border border-border" />
            Locked
          </div>
        </div>
      </header>

      {/* React Flow */}
      <div className="flex-1 relative">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          defaultEdgeOptions={{ type: "bezier" }}
          proOptions={{ hideAttribution: true }}
        >
          <svg style={{ position: "absolute", width: 0, height: 0 }}>
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="7"
                refY="3"
                orient="auto"
              >
                <polygon points="0 0, 8 3, 0 6" fill="rgba(255,255,255,0.25)" />
              </marker>
            </defs>
          </svg>
          <Background color="rgba(255,255,255,0.03)" gap={20} size={1} />
          <Controls
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              borderColor: "rgba(255,255,255,0.1)",
            }}
          />
          <MiniMap
            nodeStrokeWidth={3}
            zoomable
            pannable
            style={{
              backgroundColor: "rgba(0,0,0,0.5)",
              borderColor: "rgba(255,255,255,0.1)",
            }}
            nodeColor={(node) => {
              const data = (node.data as unknown) as NodeData;
              if (data.completed) return "#22c55e";
              if (!data.unlocked) return "rgba(255,255,255,0.1)";
              return data.problem.tier === "core" ? "#fb923c" : "#60a5fa";
            }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
