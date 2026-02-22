import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, TrendingUp, Shield, Activity } from 'lucide-react';

interface Classification {
  classification: string;
  confidence: number;
  reasoning: string;
}

interface Post {
  text: string;
  timestamp?: string;
}

interface SocialSignalPanelProps {
  classifications: Classification[];
  posts?: Post[];
  /** When true, show card with empty state when no classifications (e.g. in place of sentiment signals). */
  showEmptyState?: boolean;
}

export function SocialSignalPanel({ classifications, posts = [], showEmptyState = false }: SocialSignalPanelProps) {
  const getClassificationVariant = (classification: string): 'destructive' | 'default' | 'secondary' => {
    const lowerClass = classification.toLowerCase();
    if (lowerClass.includes('rumor') || lowerClass.includes('leak')) {
      return 'destructive';
    }
    if (lowerClass.includes('speculative')) {
      return 'default';
    }
    return 'secondary';
  };

  const getClassificationIcon = (classification: string) => {
    const lowerClass = classification.toLowerCase();
    if (lowerClass.includes('rumor') || lowerClass.includes('leak')) {
      return <AlertTriangle size={14} className="text-destructive" />;
    }
    if (lowerClass.includes('speculative')) {
      return <TrendingUp size={14} className="text-yellow-500" />;
    }
    return <Shield size={14} className="text-green-500" />;
  };

  const getClassificationColor = (classification: string) => {
    const lowerClass = classification.toLowerCase();
    if (lowerClass.includes('rumor') || lowerClass.includes('leak')) {
      return 'border-destructive/30 bg-destructive/5';
    }
    if (lowerClass.includes('speculative')) {
      return 'border-yellow-500/30 bg-yellow-500/5';
    }
    return 'border-green-500/30 bg-green-500/5';
  };

  const isEmpty = classifications.length === 0;
  if (isEmpty && !showEmptyState) {
    return null;
  }

  return (
    <Card className="border-border/50 bg-card/30 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[min(60vh,520px)]">
      <CardHeader className="p-6 border-b border-border/50 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-primary" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Social Signal Analysis
              </h2>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                AI-powered classification of market signals
              </p>
            </div>
          </div>
          {!isEmpty && (
            <Badge variant="outline" className="text-[9px] uppercase border-primary/20 text-primary">
              {classifications.length} Signal{classifications.length !== 1 ? 's' : ''}
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-6 overflow-y-auto min-h-0 flex-1">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Activity size={32} className="mb-3 opacity-50" />
            <p className="text-xs font-medium">Run analysis to see AI-powered classification of market signals.</p>
            <p className="text-[10px] mt-1">Classification, confidence, and reasoning will appear here.</p>
          </div>
        ) : (
        <div className="space-y-4">
          {classifications.map((classification, index) => {
            const post = posts[index];
            const variant = getClassificationVariant(classification.classification);
            const icon = getClassificationIcon(classification.classification);
            const cardColor = getClassificationColor(classification.classification);
            
            return (
              <div
                key={index}
                className={`rounded-xl border-2 ${cardColor} p-5 space-y-4 transition-all hover:shadow-lg`}
              >
                {/* Header with Classification and Confidence */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {icon}
                    <Badge variant={variant} className="text-[10px] font-bold uppercase tracking-wide">
                      {classification.classification}
                    </Badge>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">
                      Confidence
                    </span>
                    <span className={`text-sm font-bold ${
                      classification.confidence > 0.7 ? 'text-foreground' : 'text-muted-foreground'
                    }`}>
                      {Math.round(classification.confidence * 100)}%
                    </span>
                  </div>
                </div>

                {/* Post Text */}
                {post && (
                  <div className="space-y-1">
                    <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">
                      Post Content
                    </div>
                    <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                      <p className="text-sm leading-relaxed italic text-foreground/90">
                        "{post.text}"
                      </p>
                      {post.timestamp && (
                        <p className="text-[10px] text-muted-foreground mt-2 font-mono">
                          {new Date(post.timestamp).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* AI Reasoning */}
                <div className="space-y-1">
                  <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
                    <Activity size={10} />
                    AI Analysis
                  </div>
                  <div className="p-3 rounded-lg bg-muted/20 border border-border/20">
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {classification.reasoning}
                    </p>
                  </div>
                </div>

                {/* Risk Indicator Bar */}
                <div className="pt-2">
                  <div className="h-1 w-full bg-border/30 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        variant === 'destructive'
                          ? 'bg-destructive'
                          : variant === 'default'
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                      }`}
                      style={{ width: `${classification.confidence * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        )}
      </CardContent>
    </Card>
  );
}
