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
  type EdgeTypes,
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
const COL_WIDTH = 280;
const ROW_GAP = 72;
const TARGET_HANDLE_ID = "target-left";
const SOURCE_HANDLE_ID = "source-right";

interface NodeData extends Record<string, unknown> {
  problem: ProblemSummary;
  completed: boolean;
  unlocked: boolean;
  highlighted: boolean;
  dimmed: boolean;
  onHoverStart: (nodeId: string) => void;
  onHoverEnd: () => void;
}

function SkillNode({ id, data, selected }: NodeProps) {
  const router = useRouter();
  const d = data as NodeData;
  const { problem, completed, unlocked, highlighted, dimmed, onHoverStart, onHoverEnd } = d;
  const isLocked = !unlocked && !completed;

  let borderColor = "rgba(255,255,255,0.1)";
  let bgColor = "rgba(8,12,20,0.9)";
  let titleColor = "rgba(255,255,255,0.72)";
  let metaColor = "rgba(255,255,255,0.42)";

  if (completed) {
    borderColor = "rgba(34,197,94,0.4)";
    bgColor = "rgba(22,61,40,0.9)";
    titleColor = "rgba(74,222,128,1)";
    metaColor = "rgba(74,222,128,0.62)";
  } else if (unlocked) {
    if (problem.tier === "core") {
      borderColor = "rgba(251,146,60,0.35)";
      bgColor = "rgba(61,38,21,0.9)";
    } else {
      borderColor = "rgba(96,165,250,0.3)";
      bgColor = "rgba(20,36,60,0.9)";
    }
    titleColor = "rgba(255,255,255,0.9)";
    metaColor = "rgba(255,255,255,0.56)";
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
        opacity: dimmed ? 0.33 : 1,
        boxShadow: selected
          ? "0 0 0 2px rgba(255,255,255,0.15)"
          : highlighted
            ? "0 0 0 1px rgba(255,255,255,0.2), 0 6px 18px rgba(0,0,0,0.35)"
            : "0 4px 12px rgba(0,0,0,0.3)",
      }}
      onMouseEnter={() => onHoverStart(id)}
      onMouseLeave={onHoverEnd}
      onClick={() => router.push(`/problem/${problem.id}`)}
    >
      <Handle
        id={TARGET_HANDLE_ID}
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
        id={SOURCE_HANDLE_ID}
        type="source"
        position={Position.Right}
        style={{ background: "transparent", border: "none", width: 1, height: 1 }}
      />
    </div>
  );
}

function BezierEdge({
  id,
  data,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  selected,
}: EdgeProps) {
  const edgeData = (data ?? {}) as { span?: number };
  const span = edgeData.span ?? 1;
  const isHighlighted = (data as { highlighted?: boolean } | undefined)?.highlighted ?? false;
  const isDimmed = (data as { dimmed?: boolean } | undefined)?.dimmed ?? false;
  const curvature = span > 2 ? 0.12 : span > 1 ? 0.2 : 0.3;
  const baseStroke = span > 2 ? "rgba(255,255,255,0.1)" : span > 1 ? "rgba(255,255,255,0.14)" : "rgba(255,255,255,0.18)";
  const baseWidth = span > 2 ? 1.2 : span > 1 ? 1.4 : 1.6;

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature,
  });

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        ...style,
        opacity: isDimmed ? 0.18 : 1,
        stroke: selected
          ? "rgba(255,255,255,0.5)"
          : isHighlighted
            ? "rgba(236,253,245,0.9)"
            : baseStroke,
        strokeWidth: selected ? 2.2 : isHighlighted ? baseWidth + 0.8 : baseWidth,
      }}
    />
  );
}

const edgeTypes = {
  bezier: BezierEdge,
} satisfies EdgeTypes;

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

interface GraphDiagnostics {
  expectedEdgeCount: number;
  renderedEdgeCount: number;
  unresolvedPrerequisites: string[];
}

interface HighlightContext {
  active: boolean;
  nodeIds: Set<string>;
  edgeIds: Set<string>;
}

function buildHighlightContext(problems: ProblemSummary[], hoveredNodeId: string | null): HighlightContext {
  if (!hoveredNodeId) {
    return { active: false, nodeIds: new Set(), edgeIds: new Set() };
  }

  const byId = new Map(problems.map((p) => [p.id, p]));
  if (!byId.has(hoveredNodeId)) {
    return { active: false, nodeIds: new Set(), edgeIds: new Set() };
  }

  const childrenByNode = new Map<string, string[]>();
  for (const p of problems) {
    for (const prereqId of p.prerequisites) {
      if (!childrenByNode.has(prereqId)) childrenByNode.set(prereqId, []);
      childrenByNode.get(prereqId)!.push(p.id);
    }
  }

  const nodeIds = new Set<string>([hoveredNodeId]);
  const edgeIds = new Set<string>();

  const parentStack = [hoveredNodeId];
  while (parentStack.length > 0) {
    const currentId = parentStack.pop()!;
    const current = byId.get(currentId);
    if (!current) continue;
    for (const parentId of current.prerequisites) {
      const edgeId = `edge:${parentId}->${currentId}`;
      edgeIds.add(edgeId);
      if (!nodeIds.has(parentId)) {
        nodeIds.add(parentId);
        parentStack.push(parentId);
      }
    }
  }

  const childStack = [hoveredNodeId];
  while (childStack.length > 0) {
    const currentId = childStack.pop()!;
    for (const childId of childrenByNode.get(currentId) ?? []) {
      const edgeId = `edge:${currentId}->${childId}`;
      edgeIds.add(edgeId);
      if (!nodeIds.has(childId)) {
        nodeIds.add(childId);
        childStack.push(childId);
      }
    }
  }

  return { active: true, nodeIds, edgeIds };
}

function buildFlowElements(
  problems: ProblemSummary[],
  progress: Record<string, boolean>,
  highlight: HighlightContext,
  onHoverStart: (nodeId: string) => void,
  onHoverEnd: () => void
): { nodes: Node[]; edges: Edge[]; diagnostics: GraphDiagnostics } {
  const levels = computeTopology(problems);
  const maxLevel = Math.max(0, ...Array.from(levels.values()));
  const nodeIds = new Set(problems.map((problem) => problem.id));

  const byLevel = new Map<number, ProblemSummary[]>();
  for (const p of problems) {
    const lv = levels.get(p.id) ?? 0;
    if (!byLevel.has(lv)) byLevel.set(lv, []);
    byLevel.get(lv)!.push(p);
  }

  const childrenByNode = new Map<string, string[]>();
  for (const p of problems) {
    for (const parentId of p.prerequisites) {
      if (!childrenByNode.has(parentId)) childrenByNode.set(parentId, []);
      childrenByNode.get(parentId)!.push(p.id);
    }
  }

  function average(values: number[]): number {
    return values.length > 0 ? values.reduce((sum, v) => sum + v, 0) / values.length : Number.MAX_SAFE_INTEGER;
  }

  function stableSort(arr: ProblemSummary[], scoreFor: (p: ProblemSummary) => number): void {
    arr.sort((a, b) => {
      const aScore = scoreFor(a);
      const bScore = scoreFor(b);
      if (aScore !== bScore) return aScore - bScore;
      if (a.week !== b.week) return a.week - b.week;
      if (a.day !== b.day) return a.day - b.day;
      return a.title.localeCompare(b.title);
    });
  }

  const nodeOrder = new Map<string, number>();
  for (let lv = 0; lv <= maxLevel; lv++) {
    const arr = byLevel.get(lv) ?? [];
    arr.sort((a, b) => {
      if (a.week !== b.week) return a.week - b.week;
      if (a.day !== b.day) return a.day - b.day;
      return a.title.localeCompare(b.title);
    });
    arr.forEach((p, index) => nodeOrder.set(p.id, index));
  }

  // Multiple barycentric sweeps significantly reduce edge crossings.
  for (let pass = 0; pass < 4; pass++) {
    for (let lv = 1; lv <= maxLevel; lv++) {
      const arr = byLevel.get(lv) ?? [];
      stableSort(arr, (p) => {
        const parentOrders = p.prerequisites
          .map((id) => nodeOrder.get(id))
          .filter((v): v is number => v !== undefined);
        return average(parentOrders);
      });
      arr.forEach((p, index) => nodeOrder.set(p.id, index));
    }

    for (let lv = maxLevel - 1; lv >= 0; lv--) {
      const arr = byLevel.get(lv) ?? [];
      stableSort(arr, (p) => {
        const childOrders = (childrenByNode.get(p.id) ?? [])
          .map((id) => nodeOrder.get(id))
          .filter((v): v is number => v !== undefined);
        return average(childOrders);
      });
      arr.forEach((p, index) => nodeOrder.set(p.id, index));
    }
  }

  const nodes: Node[] = [];

  for (let lv = 0; lv <= maxLevel; lv++) {
    const arr = byLevel.get(lv) ?? [];
    const totalHeight = arr.length * NODE_HEIGHT + (arr.length - 1) * ROW_GAP;
    const startY = Math.max(0, (600 - totalHeight) / 2);

    arr.forEach((p, i) => {
      const x = lv * COL_WIDTH;
      const y = startY + i * (NODE_HEIGHT + ROW_GAP);

      nodes.push({
        id: p.id,
        type: "skill",
        position: { x, y },
        data: {
          problem: p,
          completed: !!progress[p.id],
          unlocked: arePrerequisitesMet(p.prerequisites, progress),
          highlighted: !highlight.active || highlight.nodeIds.has(p.id),
          dimmed: highlight.active && !highlight.nodeIds.has(p.id),
          onHoverStart,
          onHoverEnd,
        },
      });
    });
  }

  const edges: Edge[] = [];
  const unresolvedPrerequisites: string[] = [];
  const edgeIds = new Set<string>();
  let expectedEdgeCount = 0;

  for (const p of problems) {
    for (const prereqId of p.prerequisites) {
      expectedEdgeCount += 1;

      if (!nodeIds.has(prereqId)) {
        unresolvedPrerequisites.push(`${prereqId}->${p.id}`);
        continue;
      }

      const edgeId = `edge:${prereqId}->${p.id}`;
      if (edgeIds.has(edgeId)) continue;
      edgeIds.add(edgeId);

      const sourceLevel = levels.get(prereqId) ?? 0;
      const targetLevel = levels.get(p.id) ?? sourceLevel + 1;
      const span = Math.max(1, targetLevel - sourceLevel);

      edges.push({
        id: edgeId,
        source: prereqId,
        target: p.id,
        sourceHandle: SOURCE_HANDLE_ID,
        targetHandle: TARGET_HANDLE_ID,
        type: "bezier",
        animated: false,
        data: {
          span,
          highlighted: !highlight.active || highlight.edgeIds.has(edgeId),
          dimmed: highlight.active && !highlight.edgeIds.has(edgeId),
        },
        style: { stroke: "rgba(255,255,255,0.12)", strokeWidth: 1.5 },
      });
    }
  }

  return {
    nodes,
    edges,
    diagnostics: {
      expectedEdgeCount,
      renderedEdgeCount: edges.length,
      unresolvedPrerequisites,
    },
  };
}

function logGraphDiagnostics(diagnostics: GraphDiagnostics): void {
  if (process.env.NODE_ENV === "production") return;

  if (diagnostics.unresolvedPrerequisites.length > 0) {
    console.warn(
      `[skill-tree] Unresolved prerequisite references: ${diagnostics.unresolvedPrerequisites.join(", ")}`
    );
  }

  if (diagnostics.expectedEdgeCount !== diagnostics.renderedEdgeCount) {
    console.warn(
      `[skill-tree] Edge count mismatch: expected ${diagnostics.expectedEdgeCount}, rendered ${diagnostics.renderedEdgeCount}`
    );
  }
}

export default function SkillTreePage() {
  const router = useRouter();
  const [problems, setProblems] = useState<ProblemSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const progress = useMemo(() => getProgress(), []);
  const highlightContext = useMemo(
    () => buildHighlightContext(problems, hoveredNodeId),
    [problems, hoveredNodeId]
  );

  const onHoverStart = useCallback((nodeId: string) => {
    setHoveredNodeId(nodeId);
  }, []);

  const onHoverEnd = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  const initialElements = useMemo(() => {
    if (problems.length === 0) {
      return {
        nodes: [],
        edges: [],
        diagnostics: {
          expectedEdgeCount: 0,
          renderedEdgeCount: 0,
          unresolvedPrerequisites: [],
        },
      };
    }
    return buildFlowElements(problems, progress, highlightContext, onHoverStart, onHoverEnd);
  }, [problems, progress, highlightContext, onHoverStart, onHoverEnd]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialElements.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialElements.edges);

  useEffect(() => {
    getProblems().then((data) => {
      setProblems(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (problems.length > 0) {
      const { nodes: newNodes, edges: newEdges, diagnostics } = buildFlowElements(
        problems,
        progress,
        highlightContext,
        onHoverStart,
        onHoverEnd
      );
      setNodes(newNodes);
      setEdges(newEdges);
      logGraphDiagnostics(diagnostics);
    }
  }, [problems, progress, highlightContext, onHoverStart, onHoverEnd, setNodes, setEdges]);

  useEffect(() => {
    if (!hoveredNodeId) return;

    const problemById = new Map(problems.map((p) => [p.id, p]));
    const hovered = problemById.get(hoveredNodeId);
    const hoveredTitle = hovered?.title ?? hoveredNodeId;

    const litNodeTitles = Array.from(highlightContext.nodeIds)
      .map((id) => problemById.get(id)?.title ?? id)
      .sort((a, b) => a.localeCompare(b));

    const litEdgeTitles = Array.from(highlightContext.edgeIds)
      .map((edgeId) => {
        const match = edgeId.match(/^edge:(.+)->(.+)$/);
        if (!match) return edgeId;
        const [, sourceId, targetId] = match;
        const sourceTitle = problemById.get(sourceId)?.title ?? sourceId;
        const targetTitle = problemById.get(targetId)?.title ?? targetId;
        return `${sourceTitle} -> ${targetTitle}`;
      })
      .sort((a, b) => a.localeCompare(b));

    console.log(`[skill-tree] hover node: ${hoveredTitle}`);
    console.log("[skill-tree] lit nodes:", litNodeTitles);
    console.log("[skill-tree] lit edges:", litEdgeTitles);
  }, [hoveredNodeId, highlightContext, problems]);

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
          onNodeMouseEnter={(_: React.MouseEvent, node: Node) => {
            const nodeData = node.data as NodeData | undefined;
            const title = nodeData?.problem?.title ?? node.id;
            console.log(`[skill-tree] onNodeMouseEnter: ${title}`);
            onHoverStart(node.id);
          }}
          onPaneClick={onHoverEnd}
          onPaneMouseLeave={onHoverEnd}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          defaultEdgeOptions={{ type: "bezier" }}
          proOptions={{ hideAttribution: true }}
        >
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
