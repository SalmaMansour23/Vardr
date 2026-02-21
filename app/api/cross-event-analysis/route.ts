import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'NVIDIA_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { primary_event, related_events, public_posts } = body;

    // Validate input
    if (!primary_event || typeof primary_event !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "primary_event" field' },
        { status: 400 }
      );
    }

    if (!Array.isArray(related_events) || related_events.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid "related_events" array' },
        { status: 400 }
      );
    }

    if (!Array.isArray(public_posts)) {
      return NextResponse.json(
        { error: 'Missing or invalid "public_posts" array' },
        { status: 400 }
      );
    }

    // Build the analysis prompt
    const relatedEventsList = related_events.map((e, i) => `${i + 1}. ${e}`).join('\n');
    
    const postsText = public_posts.length > 0
      ? public_posts.map((p: any, i: number) => {
          const text = typeof p === 'string' ? p : p.text || p.content || '';
          const timestamp = typeof p === 'object' && p.timestamp ? ` [${p.timestamp}]` : '';
          return `Post ${i + 1}${timestamp}: ${text}`;
        }).join('\n\n')
      : 'No public posts provided.';

    const systemPrompt = `You are a financial intelligence analyst specializing in cross-event correlation and information flow analysis.

Your task is to analyze relationships between a primary market event and related events by examining public signals and narrative connections.

Primary Event: ${primary_event}

Related Events to Analyze:
${relatedEventsList}

Public Posts/Signals:
${postsText}

Analyze:
1. Direct and indirect relationships between events
2. Potential upstream signals (events that may have leaked information about the primary event)
3. Narrative connections in public discourse
4. Cross-market information flow patterns

For each related event, determine:
- Relationship strength (0.0 to 1.0, where 1.0 is strongest)
- Type of relationship (causal, correlated, narrative, speculative, etc.)
- Evidence from public signals
- Reasoning for the connection

Return JSON only in this exact format:
{
  "linked_events": [
    {
      "event": "event name",
      "relationship_strength": 0.0-1.0,
      "reasoning": "detailed explanation"
    }
  ]
}

Include all related events in your analysis, even if relationship_strength is low.`;

    const response = await fetch(
      'https://integrate.api.nvidia.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'nvidia/nemotron-3-nano-30b-a3b',
          messages: [
            {
              role: 'system',
              content: systemPrompt,
            },
            {
              role: 'user',
              content: 'Perform the cross-event analysis now.',
            },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('NVIDIA API error:', response.status, errorText);
      return NextResponse.json(
        { error: `NVIDIA API request failed: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content;

    if (!generatedText) {
      return NextResponse.json(
        { error: 'No content returned from model' },
        { status: 500 }
      );
    }

    // Parse the JSON response from the model
    try {
      const parsedResult = JSON.parse(generatedText);

      // Validate the structure
      if (!Array.isArray(parsedResult.linked_events)) {
        console.warn('Invalid response structure: missing linked_events array', parsedResult);
        return NextResponse.json(
          { error: 'Invalid response structure from model' },
          { status: 500 }
        );
      }

      // Validate each linked event
      for (const linkedEvent of parsedResult.linked_events) {
        if (
          !linkedEvent.event ||
          typeof linkedEvent.relationship_strength !== 'number' ||
          !linkedEvent.reasoning
        ) {
          console.warn('Invalid linked event structure:', linkedEvent);
          return NextResponse.json(
            { error: 'Invalid linked event structure from model' },
            { status: 500 }
          );
        }

        // Ensure relationship_strength is between 0 and 1
        if (linkedEvent.relationship_strength < 0 || linkedEvent.relationship_strength > 1) {
          linkedEvent.relationship_strength = Math.max(0, Math.min(1, linkedEvent.relationship_strength));
        }
      }

      return NextResponse.json(parsedResult);
    } catch (parseError) {
      console.error('Failed to parse model response as JSON:', generatedText);
      return NextResponse.json(
        {
          error: 'Failed to parse model response',
          rawResponse: generatedText,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Cross-event analysis error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
