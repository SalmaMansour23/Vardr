"use client"

import React, { useMemo } from 'react';
import { RiskAnalysis } from '@/lib/data-generator';

interface TraderNetworkGraphProps {
  analysis: RiskAnalysis;
}

export function TraderNetworkGraph({ analysis }: TraderNetworkGraphProps) {
  const nodes = analysis?.networkNodes || [];
  const links = analysis?.networkLinks || [];

  // Simple circle layout for the MVP
  const width = 400;
  const height = 400;
  const radius = 150;
  const centerX = width / 2;
  const centerY = height / 2;

  const nodePositions = useMemo(() => {
    const pos: Record<string, { x: number, y: number }> = {};
    if (!nodes || nodes.length === 0) return pos;

    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      pos[node.id] = {
        x: centerX + radius * Math.cos(angle),
        y: centerY + radius * Math.sin(angle)
      };
    });
    return pos;
  }, [nodes]);

  const isHighRisk = analysis?.riskScore > 60;

  return (
    <div className="relative w-full aspect-square bg-muted/20 rounded-2xl overflow-hidden p-4 border border-border/50">
      <div className="absolute top-4 left-4 z-10">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Trader Coordination</h3>
        <p className="text-xs text-muted-foreground/60">Cluster analysis for {nodes.length} entities</p>
      </div>
      
      <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} className="transform scale-95 origin-center">
        {/* Links */}
        {links.map((link, i) => {
          const source = nodePositions[link.source];
          const target = nodePositions[link.target];
          if (!source || !target) return null;
          
          return (
            <line
              key={i}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              stroke={isHighRisk ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
              strokeWidth={isHighRisk ? 1.5 : 0.5}
              strokeOpacity={isHighRisk ? 0.6 : 0.2}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const pos = nodePositions[node.id];
          if (!pos) return null;
          return (
            <g key={node.id} className="network-node">
              <circle
                cx={pos.x}
                cy={pos.y}
                r={6}
                fill={isHighRisk ? 'hsl(var(--destructive))' : 'hsl(var(--primary))'}
                className={isHighRisk ? 'glow-anomaly' : ''}
              />
              <title>{node.id}</title>
            </g>
          );
        })}
      </svg>

      {isHighRisk && nodes.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-1.5 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
          <span className="text-[10px] font-bold text-destructive uppercase tracking-tighter">Suspicious Cluster Detected</span>
        </div>
      )}
    </div>
  );
}