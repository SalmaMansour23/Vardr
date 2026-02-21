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
    const { drift_time, public_posts, related_events } = body;

    // Validate input
    if (!drift_time || typeof drift_time !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "drift_time" field' },
        { status: 400 }
      );
    }

    if (!Array.isArray(public_posts)) {
      return NextResponse.json(
        { error: 'Missing or invalid "public_posts" array' },
        { status: 400 }
      );
    }

    if (!Array.isArray(related_events)) {
      return NextResponse.json(
        { error: 'Missing or invalid "related_events" array' },
        { status: 400 }
      );
    }

    // Build the causal graph generation prompt
    const postsText = public_posts.length > 0
      ? public_posts.map((p: any, i: number) => {
          const text = typeof p === 'string' ? p : p.text || p.content || '';
          const timestamp = typeof p === 'object' && p.timestamp ? ` [${p.timestamp}]` : '';
          return `${i + 1}. [NARRATIVE]${timestamp} ${text}`;
        }).join('\n')
      : 'No public posts.';

    const eventsText = related_events.length > 0
      ? related_events.map((e: any, i: number) => {
          const eventName = typeof e === 'string' ? e : e.name || e.event || '';
          return `${i + 1}. [EVENT] ${eventName}`;
        }).join('\n')
      : 'No related events.';

    const systemPrompt = `You are a causal inference engine for financial markets. Build a directed causal graph showing information flow and causal relationships.

DRIFT TIME: ${drift_time}

NARRATIVE SIGNALS (Social media posts, rumors, leaks):
${postsText}

RELATED MACRO EVENTS:
${eventsText}

TASK:
Construct a causal graph with nodes and directed edges representing information flow and causal relationships.

NODE TYPES:
- "Narrative": Social signals, rumors, leaked information
- "Market": Market contracts, price movements, trading behavior  
- "Event": Macro events, announcements, policy decisions

EDGE RULES:
- "from" → "to" means "from" causally influences or precedes "to"
- weight: 0.0 to 1.0 (strength of causal relationship)
- Include reasoning for each edge
- Use actual content from inputs as node IDs (shortened but recognizable)

CRITICAL: Return ONLY valid JSON. No markdown, no explanation, no preamble.

Format:
{
  "nodes": [
    {"id": "node_identifier", "type": "Narrative | Market | Event"}
  ],
  "edges": [
    {"from": "source_node", "to": "target_node", "weight": 0.0-1.0, "reasoning": "why this causal link exists"}
  ]
}`;

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
              content: 'Generate the causal graph now. Return only JSON.',
            },
          ],
          temperature: 0.2,
          max_tokens: 1500,
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
    let generatedText = data.choices?.[0]?.message?.content;

    if (!generatedText) {
      return NextResponse.json(
        { error: 'No content returned from model' },
        { status: 500 }
      );
    }

    // Clean up response - remove markdown code blocks if present
    generatedText = generatedText.trim();
    if (generatedText.startsWith('```json')) {
      generatedText = generatedText.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (generatedText.startsWith('```')) {
      generatedText = generatedText.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    // Parse the JSON response from the model
    try {
      const parsedResult = JSON.parse(generatedText);

      // Validate the structure
      if (!Array.isArray(parsedResult.nodes)) {
        console.warn('Invalid response: missing nodes array', parsedResult);
        return NextResponse.json(
          { error: 'Invalid response structure: missing nodes array' },
          { status: 500 }
        );
      }

      if (!Array.isArray(parsedResult.edges)) {
        console.warn('Invalid response: missing edges array', parsedResult);
        return NextResponse.json(
          { error: 'Invalid response structure: missing edges array' },
          { status: 500 }
        );
      }

      // Validate nodes
      for (const node of parsedResult.nodes) {
        if (!node.id || !node.type) {
          console.warn('Invalid node structure:', node);
          return NextResponse.json(
            { error: 'Invalid node structure: missing id or type' },
            { status: 500 }
          );
        }

        const validTypes = ['Narrative', 'Market', 'Event'];
        if (!validTypes.includes(node.type)) {
          console.warn('Invalid node type:', node.type);
          node.type = 'Market'; // Default fallback
        }
      }

      // Validate edges
      for (const edge of parsedResult.edges) {
        if (!edge.from || !edge.to || typeof edge.weight !== 'number' || !edge.reasoning) {
          console.warn('Invalid edge structure:', edge);
          return NextResponse.json(
            { error: 'Invalid edge structure' },
            { status: 500 }
          );
        }

        // Ensure weight is between 0 and 1
        edge.weight = Math.max(0, Math.min(1, edge.weight));
      }

      return NextResponse.json(parsedResult);
    } catch (parseError) {
      console.error('Failed to parse model response as JSON:', generatedText);
      return NextResponse.json(
        {
          error: 'Failed to parse model response as JSON',
          rawResponse: generatedText.substring(0, 500),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Causal graph generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
