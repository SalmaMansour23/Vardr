'use client';

import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  MarkerType,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';

interface CausalNode {
  id: string;
  type: 'Narrative' | 'Market' | 'Event';
}

interface CausalEdge {
  from: string;
  to: string;
  weight: number;
  reasoning: string;
}

interface CausalGraphVisualizerProps {
  nodes: CausalNode[];
  edges: CausalEdge[];
}

export function CausalGraphVisualizer({ nodes, edges }: CausalGraphVisualizerProps) {
  // Convert causal nodes to React Flow nodes
  const flowNodes: Node[] = useMemo(() => {
    return nodes.map((node, index) => {
      const getNodeColor = (type: string) => {
        switch (type) {
          case 'Narrative':
            return {
              bg: 'rgba(239, 68, 68, 0.2)', // red
              border: 'rgb(239, 68, 68)',
              text: 'rgb(254, 202, 202)',
            };
          case 'Market':
            return {
              bg: 'rgba(59, 130, 246, 0.2)', // blue
              border: 'rgb(59, 130, 246)',
              text: 'rgb(191, 219, 254)',
            };
          case 'Event':
            return {
              bg: 'rgba(168, 85, 247, 0.2)', // purple
              border: 'rgb(168, 85, 247)',
              text: 'rgb(233, 213, 255)',
            };
          default:
            return {
              bg: 'rgba(107, 114, 128, 0.2)',
              border: 'rgb(107, 114, 128)',
              text: 'rgb(209, 213, 219)',
            };
        }
      };

      const colors = getNodeColor(node.type);
      const angle = (index / nodes.length) * 2 * Math.PI;
      const radius = 250;

      return {
        id: node.id,
        type: 'default',
        position: {
          x: 400 + radius * Math.cos(angle),
          y: 300 + radius * Math.sin(angle),
        },
        data: {
          label: (
            <div className="text-center">
              <div className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: colors.text }}>
                {node.type}
              </div>
              <div className="text-sm font-medium" style={{ color: 'white' }}>
                {node.id.length > 30 ? `${node.id.substring(0, 30)}...` : node.id}
              </div>
            </div>
          ),
        },
        style: {
          background: colors.bg,
          border: `2px solid ${colors.border}`,
          borderRadius: '12px',
          padding: '16px',
          width: 200,
          backdropFilter: 'blur(10px)',
          boxShadow: `0 0 20px ${colors.border}40`,
        },
        sourcePosition: Position.Right,
        targetPosition: Position.Left,
      };
    });
  }, [nodes]);

  // Convert causal edges to React Flow edges
  const flowEdges: Edge[] = useMemo(() => {
    return edges.map((edge, index) => {
      const getEdgeColor = (weight: number) => {
        if (weight >= 0.7) return 'rgb(239, 68, 68)'; // red - strong
        if (weight >= 0.4) return 'rgb(253, 224, 71)'; // yellow - medium
        return 'rgb(156, 163, 175)'; // gray - weak
      };

      const color = getEdgeColor(edge.weight);
      const strokeWidth = 1 + edge.weight * 3; // 1-4px based on weight

      return {
        id: `edge-${index}`,
        source: edge.from,
        target: edge.to,
        type: 'smoothstep',
        animated: edge.weight > 0.7,
        label: `${Math.round(edge.weight * 100)}%`,
        labelStyle: {
          fill: color,
          fontWeight: 700,
          fontSize: 11,
          background: 'rgba(0, 0, 0, 0.8)',
          padding: '4px 8px',
          borderRadius: '4px',
        },
        labelBgStyle: {
          fill: 'rgba(0, 0, 0, 0.8)',
          fillOpacity: 0.9,
        },
        style: {
          stroke: color,
          strokeWidth,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: 20,
          height: 20,
          color,
        },
        data: {
          reasoning: edge.reasoning,
        },
      };
    });
  }, [edges]);

  const [rfNodes, setNodes, onNodesChange] = useNodesState(flowNodes);
  const [rfEdges, setEdges, onEdgesChange] = useEdgesState(flowEdges);

  // Update nodes and edges when props change
  React.useEffect(() => {
    setNodes(flowNodes);
  }, [flowNodes, setNodes]);

  React.useEffect(() => {
    setEdges(flowEdges);
  }, [flowEdges, setEdges]);

  const onEdgeClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    if (edge.data?.reasoning) {
      alert(`Causal Reasoning:\n\n${edge.data.reasoning}`);
    }
  }, []);

  if (nodes.length === 0) {
    return (
      <div className="w-full h-[600px] flex items-center justify-center bg-background/50 rounded-2xl border-2 border-border/30">
        <div className="text-center space-y-2">
          <p className="text-sm text-muted-foreground uppercase font-bold tracking-wider">
            No Causal Graph Data
          </p>
          <p className="text-xs text-muted-foreground">
            Generate a causal graph to visualize information flow
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-[600px] rounded-2xl overflow-hidden border-2 border-border/30 shadow-2xl">
      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgeClick={onEdgeClick}
        fitView
        attributionPosition="bottom-right"
        style={{
          background: 'rgb(3, 7, 18)',
        }}
      >
        <Background
          color="#334155"
          gap={16}
          size={1}
          style={{ background: 'rgb(3, 7, 18)' }}
        />
        <Controls
          style={{
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgb(51, 65, 85)',
            borderRadius: '8px',
          }}
        />
        <MiniMap
          nodeColor={(node: Node) => {
            const type = nodes.find((n) => n.id === node.id)?.type;
            switch (type) {
              case 'Narrative':
                return 'rgb(239, 68, 68)';
              case 'Market':
                return 'rgb(59, 130, 246)';
              case 'Event':
                return 'rgb(168, 85, 247)';
              default:
                return 'rgb(107, 114, 128)';
            }
          }}
          style={{
            background: 'rgba(15, 23, 42, 0.9)',
            border: '1px solid rgb(51, 65, 85)',
            borderRadius: '8px',
          }}
          maskColor="rgba(0, 0, 0, 0.6)"
        />
      </ReactFlow>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-md border border-border/50 rounded-lg p-4 space-y-2 shadow-xl">
        <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-2">
          Node Types
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500/50 border-2 border-red-500" />
          <span className="text-xs text-foreground">Narrative Signals</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500/50 border-2 border-blue-500" />
          <span className="text-xs text-foreground">Market Contracts</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500/50 border-2 border-purple-500" />
          <span className="text-xs text-foreground">Macro Events</span>
        </div>
        <div className="border-t border-border/30 pt-2 mt-2">
          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-2">
            Edge Weight
          </div>
          <div className="text-xs text-muted-foreground">
            Click edges for reasoning
          </div>
        </div>
      </div>
    </div>
  );
}
