"use client";

import React, { useEffect, useState } from 'react';
import { Brain, ChevronDown, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  runAiRiskPipeline,
  AiRiskPipelineOutput,
  FlaggedBetContextSummary,
} from '@/ai-risk-intelligence/runAiRiskPipeline';
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

const KEYWORD_TO_TOPIC_RULES: Array<{ regex: RegExp; topic: TopicId }> = [
  { regex: /\b(fed|fomc|powell|rate cut|interest rate|bps|inflation)\b/i, topic: 'fed-rate' },
  { regex: /\b(earnings|guidance|release|gta|apple|meta|microsoft|tesla|company|corporate)\b/i, topic: 'tech-earnings' },
  { regex: /\b(iran|israel|russia|ukraine|strike|war|missile|regime|khamenei|greenland|ceasefire|attack)\b/i, topic: 'geopolitical' },
  { regex: /\b(trump|election|nominate|nomination|candidate|president|democrat|republican)\b/i, topic: '2028-election' },
];

function parseFocusKeywords(raw: string): string[] {
  return raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part, idx, arr) => arr.findIndex((x) => x.toLowerCase() === part.toLowerCase()) === idx)
    .slice(0, 20);
}

function inferTopicFromKeywords(keywords: string[]): TopicId {
  const text = keywords.join(' ').toLowerCase();
  for (const rule of KEYWORD_TO_TOPIC_RULES) {
    if (rule.regex.test(text)) return rule.topic;
  }
  return 'geopolitical';
}

export function AiRiskIntelligencePage() {
  const [selectedTopic, setSelectedTopic] = useState<TopicId>('geopolitical');
  const [focusKeywordsInput, setFocusKeywordsInput] = useState('');
  const [entityType, setEntityType] = useState<EntityType>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [keywordError, setKeywordError] = useState('');
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
  const [flaggedContext, setFlaggedContext] = useState<FlaggedBetContextSummary | null>(null);

  const focusKeywords = parseFocusKeywords(focusKeywordsInput);
  const inferredTopic = inferTopicFromKeywords(focusKeywords);

  useEffect(() => {
    if (focusKeywordsInput.trim()) return;
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlKeywords = (params.get('keywords') || '').trim();
    const urlTitle = (params.get('title') || '').trim();
    if (urlKeywords) {
      setFocusKeywordsInput(urlKeywords);
      return;
    }
    if (urlTitle) {
      setFocusKeywordsInput(urlTitle);
    }
  }, [focusKeywordsInput]);

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

    const parsedKeywords = parseFocusKeywords(focusKeywordsInput);
    if (parsedKeywords.length === 0) {
      setKeywordError('Enter at least one keyword, company, government, or market before selecting an agent.');
      return;
    }

    setKeywordError('');
    const topicForRun = inferTopicFromKeywords(parsedKeywords);
    setSelectedTopic(topicForRun);
    setEntityType(entity);
    setFinalReport(null);
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
      let contextPayload: FlaggedBetContextSummary | undefined;
      setContextLoading(true);
      try {
        const url = new URL('/api/flagged-bets-context', window.location.origin);
        url.searchParams.set('window', '30d');
        url.searchParams.set('limit', '30');
        url.searchParams.set('keywords', parsedKeywords.join(','));
        const contextResp = await fetch(url.toString(), { cache: 'no-store' });
        if (contextResp.ok) {
          const payload = (await contextResp.json()) as FlaggedBetContextSummary;
          contextPayload = payload;
          setFlaggedContext(payload);
        } else {
          const payload = await contextResp.json().catch(() => ({}));
          setFlaggedContext(null);
          setKeywordError(payload?.error || 'Keyword context could not be loaded. Analysis still ran.');
        }
      } catch {
        setFlaggedContext(null);
        setKeywordError('Keyword context could not be loaded. Analysis still ran.');
      } finally {
        setContextLoading(false);
      }

      const result = await runAiRiskPipeline(entity, topicForRun, {
        focusKeywords: parsedKeywords,
        flaggedBetContext: contextPayload,
      });
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
              Vardr Risk Officer Report
            </h1>
            <p className="text-lg text-muted-foreground max-w-4xl mx-auto">
              Built with top-of-the-line NVIDIA Nemotron technology, this report uses specialist agents trained on the proprietary Vardr Model plus context-dependent intelligence to deliver comprehensive risk mitigation recommendations.
            </p>
            <p className="text-sm text-muted-foreground max-w-4xl mx-auto">
              The Vardr Model fuses anomaly scoring, informed-trader probability estimation, and leak-plausibility context into an auditable insider-risk framework across Kalshi and Polymarket.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Keyword Selector */}
      <Card className="border-border/50 bg-card/50 overflow-hidden rounded-2xl shadow-lg border-2 border-accent/30">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Step 1: Focus Keywords</h2>
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">
              Enter companies, governments, markets, or terms tied to divergence/spread/liquidity
            </p>
          </div>

          <div className="space-y-3">
            <Textarea
              value={focusKeywordsInput}
              onChange={(e) => setFocusKeywordsInput(e.target.value)}
              placeholder="Examples: Iran strike, Fed rate cuts, GTA VI release, Kalshi spread widening, Polymarket liquidity"
              rows={3}
              disabled={isRunning}
              className="text-sm"
            />
            <div className="flex flex-wrap gap-2">
              {focusKeywords.map((keyword) => (
                <span key={keyword} className="px-2 py-1 rounded bg-accent/20 text-[11px] text-accent font-semibold">
                  {keyword}
                </span>
              ))}
              {focusKeywords.length === 0 ? (
                <span className="text-xs text-muted-foreground">No keywords entered yet.</span>
              ) : null}
            </div>
            <div className="text-xs text-muted-foreground">
              Internal scenario mapping: <span className="font-semibold text-foreground">{TOPICS.find(t => t.id === inferredTopic)?.name || inferredTopic}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              Active run scenario: <span className="font-semibold text-foreground">{TOPICS.find(t => t.id === selectedTopic)?.name || selectedTopic}</span>
            </div>
            {keywordError ? <p className="text-xs text-destructive">{keywordError}</p> : null}
          </div>
        </CardContent>
      </Card>

      {/* Master Agent - Entity Type Selector */}
      <Card className="border-border/50 bg-card/50 overflow-hidden rounded-2xl shadow-lg border-2 border-primary/30">
        <CardContent className="p-8 space-y-6">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-foreground">Step 2: Master Agent</h2>
            <p className="text-sm text-muted-foreground uppercase tracking-wider font-semibold">Who are you?</p>
            {entityType ? (
              <p className="text-xs text-accent font-semibold mt-3">
                Analyzing keywords: <span className="text-accent font-bold">{focusKeywords.join(', ') || '--'}</span>
              </p>
            ) : null}
          </div>

          {!entityType ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Government Agency */}
              <button
                onClick={() => handleRunPipeline('government')}
                disabled={isRunning || focusKeywords.length === 0}
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
                disabled={isRunning || focusKeywords.length === 0}
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
                disabled={isRunning || focusKeywords.length === 0}
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
                  setFlaggedContext(null);
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
                Keywords: <span className="font-semibold text-foreground">{(finalReport.analysisContext?.focusKeywords || focusKeywords).join(', ') || '--'}</span> | Entity: <span className="font-semibold text-foreground">{entityType === 'government' ? 'Government Agency' : entityType === 'company' ? 'Company' : 'Institutional Trader'}</span>
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

            <Card className="border-2 border-accent/30 mb-8">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold text-foreground">Keyword-Linked Flagged Bets Context</h3>
                  {contextLoading ? (
                    <span className="text-xs text-muted-foreground">Loading flagged bets context...</span>
                  ) : null}
                </div>
                {flaggedContext ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Matched <span className="font-semibold text-foreground">{flaggedContext.total_matches}</span> flagged bets in the {flaggedContext.window} window.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded bg-muted/40">
                        <p className="text-muted-foreground">INVESTIGATE</p>
                        <p className="font-bold text-foreground">{flaggedContext.band_counts?.INVESTIGATE ?? 0}</p>
                      </div>
                      <div className="p-3 rounded bg-muted/40">
                        <p className="text-muted-foreground">WATCHLIST</p>
                        <p className="font-bold text-foreground">{flaggedContext.band_counts?.WATCHLIST ?? 0}</p>
                      </div>
                      <div className="p-3 rounded bg-muted/40">
                        <p className="text-muted-foreground">LOW</p>
                        <p className="font-bold text-foreground">{flaggedContext.band_counts?.LOW ?? 0}</p>
                      </div>
                      <div className="p-3 rounded bg-muted/40">
                        <p className="text-muted-foreground">Top Keyword Hits</p>
                        <p className="font-bold text-foreground">
                          {Object.entries(flaggedContext.keyword_hit_counts || {})
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 1)
                            .map(([k, v]) => `${k} (${v})`)[0] || '--'}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {(flaggedContext.rows || []).slice(0, 6).map((row, idx) => (
                        <div key={`${row.market_id || row.market_title}-${idx}`} className="p-3 rounded bg-muted/30 border border-border/40">
                          <p className="text-sm font-medium text-foreground">{row.market_title || row.market_id}</p>
                          <p className="text-xs text-muted-foreground">
                            {(row.platform || '--').toUpperCase()} | {(row.band || 'LOW').toUpperCase()} | risk {(row.risk_score === null || row.risk_score === undefined) ? '--' : `${(row.risk_score * 100).toFixed(2)}%`}
                          </p>
                          <p className="text-xs text-accent mt-1">
                            matched keywords: {(row.matched_keywords || []).join(', ') || '--'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No keyword-matched flagged bets found for this run.
                  </p>
                )}
              </CardContent>
            </Card>

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
