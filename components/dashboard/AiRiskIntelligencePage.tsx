"use client";

import React, { useState } from 'react';
import { Brain, ChevronDown, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { runAiRiskPipeline, AiRiskPipelineOutput } from '@/ai-risk-intelligence/runAiRiskPipeline';
import type { TopicId } from '@/ai-risk-intelligence/data/hardcodedTopicData';

type PipelineStage = 'idle' | 'sentiment' | 'market' | 'geopolitical' | 'mega' | 'complete';
type EntityType = 'government' | 'company' | 'institutional' | null;

const TOPICS: { id: TopicId; name: string; description: string }[] = [
  { id: '2028-election', name: '2028 Presidential Election', description: 'Trump 2028 election prediction' },
  { id: 'fed-rate', name: 'Federal Reserve Rate Decision', description: 'Fed rate hike approval odds' },
  { id: 'tech-earnings', name: 'Tech Company Earnings', description: 'Meta Q4 earnings beat' },
  { id: 'geopolitical', name: 'Geopolitical Escalation', description: 'Major geopolitical event' }
];

interface StageState {
  status: 'pending' | 'running' | 'complete' | 'error';
  output?: any;
  error?: string;
}

interface PipelineState {
  data: StageState;
  sentiment: StageState;
  market: StageState;
  geopolitical: StageState;
  mega: StageState;
}

interface ExpandedStages {
  [key: string]: boolean;
}

export function AiRiskIntelligencePage() {
  const [selectedTopic, setSelectedTopic] = useState<TopicId>('2028-election');
  const [entityType, setEntityType] = useState<EntityType>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStage, setCurrentStage] = useState<PipelineStage>('idle');
  const [pipelineState, setPipelineState] = useState<PipelineState>({
    data: { status: 'pending' },
    sentiment: { status: 'pending' },
    market: { status: 'pending' },
    geopolitical: { status: 'pending' },
    mega: { status: 'pending' }
  });
  const [expandedStages, setExpandedStages] = useState<ExpandedStages>({});
  const [finalReport, setFinalReport] = useState<AiRiskPipelineOutput | null>(null);

  const getAgentsForEntity = (entity: EntityType) => {
    const agents: { [key: string]: string[] } = {
      government: ['sentiment', 'geopolitical', 'mega'],
      company: ['sentiment', 'mega'],
      institutional: ['sentiment', 'market', 'mega']
    };
    return agents[entity || 'government'] || [];
  };

  const handleRunPipeline = async (entity: EntityType) => {
    if (!entity) return;
    
    setEntityType(entity);
    setIsRunning(true);
    setCurrentStage('sentiment');
    setPipelineState({
      data: { status: 'pending' },
      sentiment: { status: 'running' },
      market: { status: 'pending' },
      geopolitical: { status: 'pending' },
      mega: { status: 'pending' }
    });

    try {
      const result = await runAiRiskPipeline(entity, selectedTopic);
      const agents = getAgentsForEntity(entity);

      // Only run sentiment for all entity types
      if (agents.includes('sentiment')) {
        setPipelineState(prev => ({
          ...prev,
          sentiment: { status: 'complete', output: result.sentimentAnalysis }
        }));
        setCurrentStage('sentiment');
      }

      // Geopolitical only for government
      if (agents.includes('geopolitical')) {
        setCurrentStage('geopolitical');
        setPipelineState(prev => ({
          ...prev,
          geopolitical: { status: 'running' }
        }));
        await new Promise(resolve => setTimeout(resolve, 100));

        setPipelineState(prev => ({
          ...prev,
          geopolitical: { status: 'complete', output: result.geopoliticalAnalysis }
        }));
      }

      // Market only for institutional
      if (agents.includes('market')) {
        setCurrentStage('market');
        setPipelineState(prev => ({
          ...prev,
          market: { status: 'running' }
        }));
        await new Promise(resolve => setTimeout(resolve, 100));

        setPipelineState(prev => ({
          ...prev,
          market: { status: 'complete', output: result.marketAnalysis }
        }));
      }

      // Mega risk for all
      if (agents.includes('mega')) {
        setCurrentStage('mega');
        setPipelineState(prev => ({
          ...prev,
          mega: { status: 'running' }
        }));
        await new Promise(resolve => setTimeout(resolve, 100));

        setPipelineState(prev => ({
          ...prev,
          mega: { status: 'complete', output: result.megaRiskAssessment }
        }));
      }

      setCurrentStage('complete');
      setFinalReport(result);

    } catch (error) {
      console.error('Pipeline error:', error);
      setPipelineState(prev => ({
        ...prev,
        [currentStage]: {
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    } finally {
      setIsRunning(false);
    }
  };

  const renderStageIcon = (status: 'pending' | 'running' | 'complete' | 'error') => {
    switch (status) {
      case 'pending':
        return <div className="w-6 h-6 rounded-full border-2 border-muted-foreground/30" />;
      case 'running':
        return <Loader2 size={24} className="text-primary animate-spin" />;
      case 'complete':
        return <CheckCircle2 size={24} className="text-green-500" />;
      case 'error':
        return <AlertCircle size={24} className="text-destructive" />;
    }
  };

  const toggleStageExpanded = (stage: string) => {
    setExpandedStages(prev => ({
      ...prev,
      [stage]: !prev[stage]
    }));
  };

  const renderStage = (
    label: string,
    stageKey: string,
    stage: StageState
  ) => {
    const isExpanded = expandedStages[stageKey];
    const displayOutput = stage.output ? JSON.stringify(stage.output, null, 2).substring(0, 500) + '...' : '';

    return (
      <div
        key={stageKey}
        className={`transition-all duration-300 ${
          stage.status === 'complete' || stage.status === 'running' || stage.status === 'error'
            ? 'opacity-100'
            : 'opacity-60'
        }`}
      >
        <Card
          className={`border-2 transition-all duration-300 ${
            stage.status === 'complete'
              ? 'border-green-500/50 bg-green-500/5'
              : stage.status === 'error'
              ? 'border-destructive/50 bg-destructive/5'
              : stage.status === 'running'
              ? 'border-primary/50 bg-primary/5'
              : 'border-border/30 bg-muted/20'
          }`}
        >
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {renderStageIcon(stage.status)}
                <div>
                  <p className="font-semibold text-foreground">{label}</p>
                  <p className="text-sm text-muted-foreground">
                    {stage.status === 'running'
                      ? 'Processing...'
                      : stage.status === 'complete'
                      ? 'Complete'
                      : stage.status === 'error'
                      ? `Error: ${stage.error}`
                      : 'Pending'}
                  </p>
                </div>
              </div>
              {stage.output && (
                <button
                  onClick={() => toggleStageExpanded(stageKey)}
                  className="p-1 hover:bg-accent rounded transition-colors"
                >
                  <ChevronDown
                    size={20}
                    className={`transition-transform duration-300 ${
                      isExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
              )}
            </div>

            {isExpanded && stage.output && (
              <div className="mt-4 pt-4 border-t border-border/50">
                <pre className="text-xs bg-muted/50 p-3 rounded overflow-x-auto max-h-64 overflow-y-auto text-muted-foreground">
                  {JSON.stringify(stage.output, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </Card>

        {stageKey !== 'mega' && (
          <div className="flex justify-center py-2">
            <div
              className={`w-1 h-6 transition-colors duration-300 ${
                stage.status === 'complete' ? 'bg-green-500' : 'bg-border/50'
              }`}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <Card className="border-border/50 bg-gradient-to-br from-primary/10 to-accent/10 overflow-hidden rounded-2xl shadow-xl border-2 border-primary/20">
        <CardContent className="p-12 text-center space-y-4">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-primary/20 rounded-full">
              <Brain size={48} className="text-primary" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-foreground mb-2">
              AI Risk Intelligence Pipeline
            </h1>
            <p className="text-xl text-muted-foreground">
              Multi-Agent Risk Aggregation System
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Topic Selector */}
      <Card className="border-border/50 bg-card/50 overflow-hidden rounded-2xl shadow-lg border-2 border-accent/30">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Market Topic</h2>
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Select an analysis scenario</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {TOPICS.map((topic) => (
              <button
                key={topic.id}
                onClick={() => setSelectedTopic(topic.id)}
                disabled={isRunning}
                className={`p-4 rounded-xl border-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed group ${
                  selectedTopic === topic.id
                    ? 'border-accent bg-accent/20 shadow-lg'
                    : 'border-border/50 bg-muted/30 hover:bg-muted/50 hover:border-accent/50'
                }`}
              >
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-foreground group-hover:text-accent">
                    {topic.name}
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {topic.description}
                  </p>
                  {selectedTopic === topic.id && (
                    <div className="pt-2 border-t border-accent/30">
                      <span className="inline-block px-2 py-1 rounded bg-accent/20 text-[10px] text-accent font-semibold">
                        Selected
                      </span>
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Master Agent - Entity Type Selector */}
      <Card className="border-border/50 bg-card/50 overflow-hidden rounded-2xl shadow-lg border-2 border-primary/30">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Master Agent</h2>
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Who are you?</p>
            {entityType ? (
              <p className="text-xs text-accent font-semibold mt-3">
                Analyzing: <span className="text-accent font-bold">{TOPICS.find(t => t.id === selectedTopic)?.name}</span>
              </p>
            ) : null}
          </div>

          {!entityType ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Government Agency */}
              <button
                onClick={() => handleRunPipeline('government')}
                disabled={isRunning}
                className="p-6 rounded-xl border-2 border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 hover:border-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-blue-400 group-hover:text-blue-300">Government Agency</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sentiment + Geopolitical Analysis
                  </p>
                  <div className="pt-3 border-t border-blue-500/20 space-y-1">
                    <p className="text-[10px] text-muted-foreground/70">Agents:</p>
                    <div className="flex flex-wrap gap-1">
                      <span className="inline-block px-2 py-1 rounded bg-blue-500/20 text-[10px] text-blue-300">Sentiment</span>
                      <span className="inline-block px-2 py-1 rounded bg-blue-500/20 text-[10px] text-blue-300">Geopolitical</span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Company */}
              <button
                onClick={() => handleRunPipeline('company')}
                disabled={isRunning}
                className="p-6 rounded-xl border-2 border-green-500/30 bg-green-500/10 hover:bg-green-500/20 hover:border-green-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-green-400 group-hover:text-green-300">Company</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sentiment Analysis Only
                  </p>
                  <div className="pt-3 border-t border-green-500/20 space-y-1">
                    <p className="text-[10px] text-muted-foreground/70">Agents:</p>
                    <div className="flex flex-wrap gap-1">
                      <span className="inline-block px-2 py-1 rounded bg-green-500/20 text-[10px] text-green-300">Sentiment</span>
                    </div>
                  </div>
                </div>
              </button>

              {/* Institutional Traders */}
              <button
                onClick={() => handleRunPipeline('institutional')}
                disabled={isRunning}
                className="p-6 rounded-xl border-2 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed group"
              >
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-amber-400 group-hover:text-amber-300">Institutional Traders</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Sentiment + Finance Market Info
                  </p>
                  <div className="pt-3 border-t border-amber-500/20 space-y-1">
                    <p className="text-[10px] text-muted-foreground/70">Agents:</p>
                    <div className="flex flex-wrap gap-1">
                      <span className="inline-block px-2 py-1 rounded bg-amber-500/20 text-[10px] text-amber-300">Sentiment</span>
                      <span className="inline-block px-2 py-1 rounded bg-amber-500/20 text-[10px] text-amber-300">Market Info</span>
                    </div>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <p className="text-sm font-semibold text-foreground">Selected Entity:</p>
                <p className="text-lg font-bold text-primary capitalize">
                  {entityType === 'government' && 'Government Agency'}
                  {entityType === 'company' && 'Company'}
                  {entityType === 'institutional' && 'Institutional Traders'}
                </p>
              </div>
              <Button
                onClick={() => {
                  setEntityType(null);
                  setFinalReport(null);
                  setPipelineState({
                    data: { status: 'pending' },
                    sentiment: { status: 'pending' },
                    market: { status: 'pending' },
                    geopolitical: { status: 'pending' },
                    mega: { status: 'pending' }
                  });
                }}
                variant="outline"
                size="sm"
              >
                Change
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pipeline Visualization */}
      {entityType && (isRunning || finalReport) ? (
        <div className="max-w-2xl mx-auto space-y-6 animate-in slide-in-from-bottom duration-500">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-foreground mb-1">
              Analysis Pipeline
            </h2>
            <p className="text-muted-foreground">
              Sequential execution of risk analysis agents
            </p>
          </div>

          <div className="space-y-0">
            {renderStage('Sentiment Analysis Agent', 'sentiment', pipelineState.sentiment)}
            {getAgentsForEntity(entityType).includes('market') && renderStage('Market Analysis Agent', 'market', pipelineState.market)}
            {getAgentsForEntity(entityType).includes('geopolitical') && renderStage('Geopolitical Analysis Agent', 'geopolitical', pipelineState.geopolitical)}
            {renderStage('Mega Risk Assessment', 'mega', pipelineState.mega)}
          </div>
        </div>
      ) : null}

      {/* Final Report Section */}
      {finalReport && (
        <div className="max-w-4xl mx-auto space-y-6 animate-in slide-in-from-bottom duration-700">
          <div className="border-t border-border/30 pt-8">
            <div className="text-center mb-6 space-y-2">
              <h2 className="text-3xl font-bold text-foreground">
                🏛️ Insider Trading Risk Assessment
              </h2>
              <p className="text-sm text-muted-foreground">
                Topic: <span className="font-semibold text-foreground">{TOPICS.find(t => t.id === selectedTopic)?.name}</span> | Entity: <span className="font-semibold text-foreground">{entityType === 'government' ? 'Government Agency' : entityType === 'company' ? 'Company' : 'Institutional Trader'}</span>
              </p>
            </div>

            {/* Risk Score Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {/* Composite Score */}
              <Card className="border-2 border-primary/30 bg-gradient-to-br from-primary/10 to-transparent">
                <CardContent className="p-6 text-center space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Composite Score
                  </p>
                  <p className="text-5xl font-bold text-primary">
                    {(finalReport.megaRiskAssessment.compositeScore * 100).toFixed(1)}%
                  </p>
                  <div className="inline-block px-4 py-2 rounded-full bg-primary/20 border border-primary/50">
                    <p className="text-sm font-semibold text-primary">
                      {finalReport.megaRiskAssessment.finalRiskLevel}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Insider Probability */}
              <Card className="border-2 border-accent/30 bg-gradient-to-br from-accent/10 to-transparent">
                <CardContent className="p-6 text-center space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Insider Trading Probability
                  </p>
                  <p className="text-5xl font-bold text-accent">
                    {(finalReport.megaRiskAssessment.insiderTradingProbability * 100).toFixed(1)}%
                  </p>
                  <div className="inline-block px-4 py-2 rounded-full bg-accent/20 border border-accent/50">
                    <p className="text-sm font-semibold text-accent">
                      {finalReport.megaRiskAssessment.compositeRiskConclusion.probabilityClassification}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Execution Time */}
              <Card className="border-2 border-green-500/30 bg-gradient-to-br from-green-500/10 to-transparent">
                <CardContent className="p-6 text-center space-y-3">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Pipeline Duration
                  </p>
                  <p className="text-5xl font-bold text-green-600">
                    {(finalReport.pipelineExecutionTimeMs / 1000).toFixed(1)}s
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {finalReport.pipelineExecutionTimeMs}ms total
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Evidence Summary */}
            <Card className="border-2 border-border/50 mb-8">
              <CardContent className="p-8 space-y-6">
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-3">
                    Evidence Analysis
                  </h3>
                  <p className="text-foreground leading-relaxed">
                    {finalReport.megaRiskAssessment.compositeRiskConclusion.evidenceSummary}
                  </p>
                </div>

                {/* Recommended Actions */}
                {finalReport.megaRiskAssessment.compositeRiskConclusion.recommendedActions.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-foreground mb-4">
                      Recommended Actions
                    </h3>
                    <ul className="space-y-2">
                      {finalReport.megaRiskAssessment.compositeRiskConclusion.recommendedActions.map(
                        (action, idx) => (
                          <li
                            key={idx}
                            className="flex gap-3 text-foreground p-3 bg-muted/50 rounded-lg"
                          >
                            <span className="font-bold text-primary min-w-6">{idx + 1}.</span>
                            <span>{action}</span>
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Full Report Button */}
            <div className="flex justify-center">
              <Button
                onClick={() => {
                  const reportWindow = window.open();
                  if (reportWindow) {
                    reportWindow.document.write(
                      '<pre style="white-space: pre-wrap; word-wrap: break-word; font-family: monospace; padding: 20px; background: #1a1a1a; color: #e0e0e0; font-size: 12px;">' +
                      finalReport.megaRiskAssessment.report +
                      '</pre>'
                    );
                  }
                }}
                className="gap-2 px-8 py-3 rounded-lg bg-primary/20 border border-primary/50 hover:bg-primary/30 transition-colors"
              >
                <Brain size={18} />
                View Full Institutional Report
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Spacer */}
      <div className="h-8" />
    </div>
  );
}
