import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, CheckCircle, AlertCircle } from 'lucide-react';

interface TimelineResult {
  public_signal_precedes_drift: boolean;
  risk_level: 'Low' | 'Medium' | 'High';
  explanation: string;
}

interface TimelineRiskPanelProps {
  timelineResult: TimelineResult;
  drift_time?: string;
  announcement_time?: string;
}

export function TimelineRiskPanel({ 
  timelineResult, 
  drift_time, 
  announcement_time 
}: TimelineRiskPanelProps) {
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'High':
        return {
          bg: 'bg-destructive/10 border-destructive/30',
          text: 'text-destructive',
          badge: 'destructive' as const,
          icon: <AlertTriangle size={20} className="text-destructive" />,
          barColor: 'bg-destructive'
        };
      case 'Medium':
        return {
          bg: 'bg-yellow-500/10 border-yellow-500/30',
          text: 'text-yellow-500',
          badge: 'default' as const,
          icon: <AlertCircle size={20} className="text-yellow-500" />,
          barColor: 'bg-yellow-500'
        };
      case 'Low':
      default:
        return {
          bg: 'bg-green-500/10 border-green-500/30',
          text: 'text-green-500',
          badge: 'secondary' as const,
          icon: <CheckCircle size={20} className="text-green-500" />,
          barColor: 'bg-green-500'
        };
    }
  };

  const riskConfig = getRiskColor(timelineResult.risk_level);

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  return (
    <Card className={`border-2 ${riskConfig.bg} rounded-2xl shadow-xl overflow-hidden`}>
      <CardHeader className="p-6 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {riskConfig.icon}
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
                Timeline Risk Assessment
              </h2>
              <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                Information asymmetry analysis
              </p>
            </div>
          </div>
          <Badge variant={riskConfig.badge} className="text-[10px] font-bold uppercase tracking-wide px-3 py-1">
            {timelineResult.risk_level} Risk
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-6 space-y-6">
        {/* Timeline Indicators */}
        {(drift_time || announcement_time) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {drift_time && (
              <div className="space-y-2 p-4 rounded-xl bg-background/50 border border-border/30">
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground uppercase font-bold tracking-wider">
                  <Clock size={12} />
                  Drift Time
                </div>
                <p className="text-sm font-mono font-semibold text-foreground">
                  {formatDateTime(drift_time)}
                </p>
              </div>
            )}
            
            {announcement_time && (
              <div className="space-y-2 p-4 rounded-xl bg-background/50 border border-border/30">
                <div className="flex items-center gap-2 text-[9px] text-muted-foreground uppercase font-bold tracking-wider">
                  <Clock size={12} />
                  Announcement Time
                </div>
                <p className="text-sm font-mono font-semibold text-foreground">
                  {formatDateTime(announcement_time)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Public Signal Indicator */}
        <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
                Public Signal Timeline
              </div>
              <p className="text-sm font-semibold">
                {timelineResult.public_signal_precedes_drift 
                  ? 'Signals detected before price drift'
                  : 'No early signals detected'
                }
              </p>
            </div>
            <Badge 
              variant={timelineResult.public_signal_precedes_drift ? 'destructive' : 'secondary'}
              className="text-[9px] uppercase"
            >
              {timelineResult.public_signal_precedes_drift ? 'Warning' : 'Clear'}
            </Badge>
          </div>
        </div>

        {/* Risk Level Visualization */}
        <div className="space-y-3">
          <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">
            Risk Level Indicator
          </div>
          <div className="flex gap-2">
            <div className="flex-1 h-2 rounded-full bg-border/30 overflow-hidden">
              <div 
                className={`h-full transition-all duration-1000 ${riskConfig.barColor}`}
                style={{ 
                  width: timelineResult.risk_level === 'High' 
                    ? '100%' 
                    : timelineResult.risk_level === 'Medium' 
                    ? '66%' 
                    : '33%' 
                }}
              />
            </div>
            <span className={`text-xs font-bold ${riskConfig.text}`}>
              {timelineResult.risk_level === 'High' ? '100%' : timelineResult.risk_level === 'Medium' ? '66%' : '33%'}
            </span>
          </div>
          <div className="flex justify-between text-[9px] text-muted-foreground uppercase font-bold">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
          </div>
        </div>

        {/* Explanation */}
        <div className="space-y-2 p-5 rounded-xl border-2 border-border/30 bg-background/30">
          <div className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider flex items-center gap-1">
            <AlertCircle size={10} />
            AI Analysis
          </div>
          <p className="text-sm leading-relaxed text-foreground/90">
            {timelineResult.explanation}
          </p>
        </div>

        {/* Alert Footer */}
        {timelineResult.risk_level === 'High' && (
          <div className={`p-4 rounded-xl border-2 ${riskConfig.bg} flex items-start gap-3`}>
            <AlertTriangle size={16} className="text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide text-destructive mb-1">
                High Risk Detected
              </p>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                This event shows significant information asymmetry indicators. Further investigation recommended.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
