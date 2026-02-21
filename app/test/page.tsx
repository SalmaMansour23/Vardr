'use client';

import { useState } from 'react';
import { useSignalTrace } from '../../src/hooks/use-signal-trace';
import { fetchCPIPosts, Post } from '../../src/lib/mock-posts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

export default function TestPage() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [apiTestResult, setApiTestResult] = useState<string>('');

  // Example drift and announcement times
  const driftTime = new Date(Date.now() - 15 * 60 * 60 * 1000).toISOString(); // 15 hours ago
  const announcementTime = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(); // 1 hour ago

  // Use the signal trace hook
  const { classifications, timelineResult, loading, error } = useSignalTrace({
    drift_time: driftTime,
    announcement_time: announcementTime,
    posts: posts.map(p => ({ text: p.text, timestamp: p.timestamp })),
  });

  const handleLoadPosts = async () => {
    setLoadingPosts(true);
    try {
      const mockPosts = await fetchCPIPosts();
      setPosts(mockPosts);
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setLoadingPosts(false);
    }
  };

  const handleTestNemotron = async () => {
    try {
      const response = await fetch('/api/nemotron-test');
      const data = await response.json();
      setApiTestResult(data.result || JSON.stringify(data));
    } catch (err) {
      setApiTestResult('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'High':
        return 'destructive';
      case 'Medium':
        return 'default';
      case 'Low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getClassificationColor = (classification: string) => {
    if (classification.includes('leak')) return 'destructive';
    if (classification.includes('Rumor')) return 'default';
    if (classification.includes('Speculative')) return 'secondary';
    return 'outline';
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">API Testing Dashboard</h1>
        <p className="text-muted-foreground">
          Test all NVIDIA Nemotron API routes and the signal trace system
        </p>
      </div>

      {/* Test Buttons */}
      <div className="flex gap-4">
        <Button onClick={handleTestNemotron}>
          Test Nemotron API
        </Button>
        <Button onClick={handleLoadPosts} disabled={loadingPosts}>
          {loadingPosts ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading...
            </>
          ) : (
            'Load Mock CPI Posts'
          )}
        </Button>
      </div>

      {/* Nemotron Test Result */}
      {apiTestResult && (
        <Card>
          <CardHeader>
            <CardTitle>Nemotron Test Result</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{apiTestResult}</p>
          </CardContent>
        </Card>
      )}

      {/* Posts Display */}
      {posts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Loaded Posts ({posts.length})</CardTitle>
            <CardDescription>
              Drift Time: {new Date(driftTime).toLocaleString()} | 
              Announcement: {new Date(announcementTime).toLocaleString()}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {posts.slice(0, 3).map((post) => (
              <div key={post.id} className="border-l-2 pl-3 py-2">
                <div className="text-xs text-muted-foreground mb-1">
                  {post.author} • {new Date(post.timestamp).toLocaleString()}
                </div>
                <p className="text-sm">{post.text}</p>
              </div>
            ))}
            {posts.length > 3 && (
              <p className="text-xs text-muted-foreground">
                + {posts.length - 3} more posts...
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3">Analyzing signals with Nemotron...</span>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Classifications */}
      {classifications.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Post Classifications</CardTitle>
            <CardDescription>
              AI-powered classification of each post
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {classifications.map((classification, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant={getClassificationColor(classification.classification)}>
                    {classification.classification}
                  </Badge>
                  <Badge variant="outline">
                    Confidence: {(classification.confidence * 100).toFixed(0)}%
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {posts[index]?.text.substring(0, 100)}...
                </p>
                <p className="text-sm">{classification.reasoning}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Timeline Analysis */}
      {timelineResult && (
        <Card>
          <CardHeader>
            <CardTitle>Timeline Analysis</CardTitle>
            <CardDescription>
              Information asymmetry risk assessment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-sm font-medium mb-1">Public Signal Precedes Drift</div>
                <Badge variant={timelineResult.public_signal_precedes_drift ? 'destructive' : 'secondary'}>
                  {timelineResult.public_signal_precedes_drift ? 'YES' : 'NO'}
                </Badge>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Risk Level</div>
                <Badge variant={getRiskColor(timelineResult.risk_level)}>
                  {timelineResult.risk_level}
                </Badge>
              </div>
            </div>
            <div>
              <div className="text-sm font-medium mb-2">Analysis</div>
              <p className="text-sm text-muted-foreground">
                {timelineResult.explanation}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Instructions */}
      {posts.length === 0 && !loading && !error && (
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Click "Test Nemotron API" to verify API connectivity</li>
              <li>Click "Load Mock CPI Posts" to load sample social media posts</li>
              <li>Watch as the system analyzes each post and the timeline</li>
              <li>Review classifications and risk assessment results</li>
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
