"use client"

import React, { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceArea,
  ReferenceLine,
  Label
} from 'recharts';
import { TradeData } from '@/lib/data-generator';
import { format } from 'date-fns';

interface ProbabilityChartProps {
  data: TradeData[];
  announcementTime?: number;
}

export function ProbabilityChart({ data, announcementTime }: ProbabilityChartProps) {
  const chartData = useMemo(() => {
    return data.map(d => ({
      ...d,
      displayTime: format(d.timestamp, 'HH:mm'),
      upperBound: d.probability + 0.05,
      lowerBound: d.probability - 0.05,
    }));
  }, [data]);

  const announcementDisplayTime = announcementTime ? format(announcementTime, 'HH:mm') : null;

  // Find the pre-event window (30 mins before announcement)
  const preEventStartTime = announcementTime ? announcementTime - 30 * 60000 : null;
  const preEventStartDisplay = preEventStartTime ? format(preEventStartTime, 'HH:mm') : null;

  return (
    <div className="w-full h-[400px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorProb" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="colorDrift" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0}/>
            </linearGradient>
            <linearGradient id="anomalyGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="rgba(239, 68, 68, 0.4)" stopOpacity={0.4}/>
              <stop offset="95%" stopColor="rgba(239, 68, 68, 0)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
          <XAxis 
            dataKey="displayTime" 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
            interval={20}
          />
          <YAxis 
            domain={[0, 1]} 
            axisLine={false} 
            tickLine={false} 
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
            itemStyle={{ color: 'hsl(var(--foreground))' }}
            labelStyle={{ color: 'hsl(var(--muted-foreground))', fontSize: '10px' }}
          />
          
          {/* Pre-Event Window Background */}
          {preEventStartDisplay && announcementDisplayTime && (
            <ReferenceArea 
              x1={preEventStartDisplay} 
              x2={announcementDisplayTime} 
              fill="rgba(211, 83, 59, 0.05)" 
              stroke="none"
            >
              <Label 
                value="PRE-EVENT WINDOW" 
                position="center" 
                fill="rgba(211, 83, 59, 0.2)" 
                fontSize={12} 
                fontWeight="bold" 
              />
            </ReferenceArea>
          )}

          {/* Expected Drift Band */}
          <Area 
            type="monotone" 
            dataKey="upperBound" 
            stroke="none" 
            fill="url(#colorDrift)" 
            fillOpacity={1} 
          />
          <Area 
            type="monotone" 
            dataKey="lowerBound" 
            stroke="none" 
            fill="hsl(var(--background))" 
            fillOpacity={1} 
          />

          {/* Probability Line */}
          <Area 
            type="monotone" 
            dataKey="probability" 
            stroke="hsl(var(--primary))" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorProb)" 
          />

          {/* Announcement Marker */}
          {announcementDisplayTime && (
            <ReferenceLine x={announcementDisplayTime} stroke="hsl(var(--destructive))" strokeDasharray="5 5">
              <Label 
                value="OFFICIAL ANNOUNCEMENT" 
                position="top" 
                fill="hsl(var(--destructive))" 
                fontSize={10} 
                fontWeight="bold" 
              />
            </ReferenceLine>
          )}

          {/* Highlight Anomaly Regions */}
          {data.map((d, i) => {
            if (d.isAnomaly) {
              return (
                <ReferenceArea 
                  key={i}
                  x1={chartData[i].displayTime} 
                  x2={chartData[i+1]?.displayTime || chartData[i].displayTime} 
                  fill="rgba(239, 68, 68, 0.15)" 
                  stroke="none"
                />
              );
            }
            return null;
          })}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
