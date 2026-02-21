"use client"

import React from 'react';
import { cn } from '@/lib/utils';

interface RiskMeterProps {
  score: number;
  className?: string;
}

export function RiskMeter({ score, className }: RiskMeterProps) {
  // Determine color based on score
  const getColorClass = (val: number) => {
    if (val < 30) return 'text-green-500';
    if (val < 70) return 'text-yellow-500';
    return 'text-red-500';
  };

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className={cn("relative flex flex-col items-center justify-center", className)}>
      <svg className="w-48 h-48 transform -rotate-90">
        <circle
          cx="96"
          cy="96"
          r="40"
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          className="text-muted"
        />
        <circle
          cx="96"
          cy="96"
          r="40"
          stroke="currentColor"
          strokeWidth="8"
          fill="transparent"
          strokeDasharray={circumference}
          style={{ strokeDashoffset, transition: 'stroke-dashoffset 0.5s ease' }}
          className={cn(getColorClass(score), "transition-all duration-1000")}
        />
      </svg>
      <div className="absolute flex flex-col items-center mt-[-4px]">
        <span className="text-4xl font-bold font-headline leading-none">{score}</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium">Risk Score</span>
      </div>
    </div>
  );
}
