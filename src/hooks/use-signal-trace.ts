import { useState, useEffect } from 'react';

interface Post {
  text: string;
  timestamp: string;
}

interface Classification {
  classification: string;
  confidence: number;
  reasoning: string;
}

interface TimelineResult {
  public_signal_precedes_drift: boolean;
  risk_level: 'Low' | 'Medium' | 'High';
  explanation: string;
}

interface UseSignalTraceParams {
  drift_time: string;
  announcement_time: string;
  posts: Post[];
}

interface UseSignalTraceResult {
  classifications: Classification[];
  timelineResult: TimelineResult | null;
  loading: boolean;
  error: string | null;
}

export function useSignalTrace({
  drift_time,
  announcement_time,
  posts,
}: UseSignalTraceParams): UseSignalTraceResult {
  const [classifications, setClassifications] = useState<Classification[]>([]);
  const [timelineResult, setTimelineResult] = useState<TimelineResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!drift_time || !announcement_time || !posts || posts.length === 0) {
      return;
    }

    const analyzeSignals = async () => {
      setLoading(true);
      setError(null);
      setClassifications([]);
      setTimelineResult(null);

      try {
        // Step 1: Classify each post (with individual error handling)
        const classificationPromises = posts.map(async (post) => {
          try {
            const response = await fetch('/api/classify-post', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ post: post.text }),
            });

            if (!response.ok) {
              console.warn('⚠️ Classification API error (using fallback):', response.status, post.text.substring(0, 40) + '...');
              // Return fallback classification instead of throwing
              return {
                classification: 'Neutral',
                confidence: 0.5,
                reasoning: 'Classification API error - using safe fallback'
              };
            }

            const data = await response.json();
            
            // Validate the response has the expected structure
            if (!data.classification || typeof data.confidence !== 'number') {
              console.warn('⚠️ Invalid classification structure (using fallback):', Object.keys(data));
              return {
                classification: 'Neutral',
                confidence: 0.5,
                reasoning: 'Invalid API response structure - using safe fallback'
              };
            }
            
            return data;
          } catch (err) {
            console.warn('⚠️ Classification exception (using fallback):', err instanceof Error ? err.message : 'Unknown error');
            // Return fallback classification
            return {
              classification: 'Neutral',
              confidence: 0.5,
              reasoning: 'Network or parsing error - using safe fallback'
            };
          }
        });

        const classificationResults = await Promise.all(classificationPromises);
        setClassifications(classificationResults);

        // Step 2: Analyze timeline
        const timelineResponse = await fetch('/api/analyze-timeline', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            drift_time,
            announcement_time,
            posts,
          }),
        });

        if (!timelineResponse.ok) {
          console.warn('⚠️ Timeline analysis API error (using fallback):', timelineResponse.status);
          // Use fallback timeline result instead of throwing
          setTimelineResult({
            public_signal_precedes_drift: false,
            risk_level: 'Low',
            explanation: 'Timeline analysis unavailable - using safe fallback.'
          });
        } else {
          const timelineData = await timelineResponse.json();
          setTimelineResult(timelineData);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
        console.warn('⚠️ Signal trace error (analysis partially completed):', errorMessage);
        
        // Set a fallback timeline result if we don't have one
        if (!timelineResult) {
          setTimelineResult({
            public_signal_precedes_drift: false,
            risk_level: 'Low',
            explanation: 'Analysis encountered an error - using safe fallback.'
          });
        }
        
        // Only set error if we have no data at all
        if (classifications.length === 0) {
          setError(errorMessage);
        }
      } finally {
        setLoading(false);
      }
    };

    analyzeSignals();
  }, [drift_time, announcement_time, posts]);

  return {
    classifications,
    timelineResult,
    loading,
    error,
  };
}
