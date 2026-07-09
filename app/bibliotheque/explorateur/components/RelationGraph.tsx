"use client";

import type { ExplorerGraphEdge, ExplorerGraphNode } from "@/lib/knowledge/types";
import { colors } from "@/lib/theme";

const GROUP_COLORS: Record<string, string> = {
  document: colors.rose.DEFAULT,
  entity: colors.lavender.DEFAULT,
  tag: colors.sage.DEFAULT,
  competence: colors.peach.DEFAULT,
};

type RelationGraphProps = {
  nodes: ExplorerGraphNode[];
  edges: ExplorerGraphEdge[];
};

function layoutNodes(nodes: ExplorerGraphNode[]) {
  const groups = ["document", "entity", "competence", "tag"] as const;
  const grouped = groups.map((group) =>
    nodes.filter((node) => node.group === group),
  );

  const positioned: Array<ExplorerGraphNode & { x: number; y: number }> = [];
  const columnWidth = 180;
  const rowHeight = 56;

  grouped.forEach((groupNodes, columnIndex) => {
    groupNodes.forEach((node, rowIndex) => {
      positioned.push({
        ...node,
        x: 40 + columnIndex * columnWidth,
        y: 30 + rowIndex * rowHeight,
      });
    });
  });

  return positioned;
}

export function RelationGraph({ nodes, edges }: RelationGraphProps) {
  const positionedNodes = layoutNodes(nodes);
  const nodeById = new Map(positionedNodes.map((node) => [node.id, node]));

  const width = Math.max(760, positionedNodes.reduce((max, node) => Math.max(max, node.x + 140), 0));
  const height = Math.max(
    280,
    positionedNodes.reduce((max, node) => Math.max(max, node.y + 40), 0),
  );

  if (nodes.length === 0) {
    return (
      <p className="text-sm font-light" style={{ color: colors.charcoal.faint }}>
        Aucune relation disponible pour ce document.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-white/70 bg-white/50 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="min-w-full" role="img" aria-label="Graphe des relations pédagogiques">
        {edges.map((edge) => {
          const source = nodeById.get(edge.source);
          const target = nodeById.get(edge.target);
          if (!source || !target) return null;

          return (
            <g key={edge.id}>
              <line
                x1={source.x + 60}
                y1={source.y + 16}
                x2={target.x + 60}
                y2={target.y + 16}
                stroke="#d8c8c8"
                strokeWidth="1.2"
                markerEnd="url(#arrow)"
              />
              <text
                x={(source.x + target.x) / 2 + 60}
                y={(source.y + target.y) / 2 + 10}
                fill="#9a9088"
                fontSize="10"
                textAnchor="middle"
              >
                {edge.label}
              </text>
            </g>
          );
        })}

        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="#d8c8c8" />
          </marker>
        </defs>

        {positionedNodes.map((node) => (
          <g key={node.id} transform={`translate(${node.x}, ${node.y})`}>
            <rect
              width="120"
              height="32"
              rx="12"
              fill={`${GROUP_COLORS[node.group] ?? colors.lavender.DEFAULT}33`}
              stroke={`${GROUP_COLORS[node.group] ?? colors.lavender.DEFAULT}88`}
            />
            <text x="10" y="20" fill="#4a4540" fontSize="11">
              {node.label.length > 16 ? `${node.label.slice(0, 15)}…` : node.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
