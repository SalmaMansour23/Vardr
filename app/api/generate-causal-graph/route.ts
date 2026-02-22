import { NextRequest, NextResponse } from 'next/server';
import { openRouterChat } from '../../lib/openrouter';
import { parseJsonFromModel } from '../../lib/parse-json-from-model';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPEN_ROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPEN_ROUTER_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Parse request body (support frontend shape: narratives, market_events, posts)
    const body = await request.json();
    const drift_time = body.drift_time ?? (body.market_events?.[0] ? 'unknown' : null);
    const public_posts = body.public_posts ?? body.posts ?? [];
    const related_events = body.related_events ?? body.market_events ?? [];

    if (!drift_time || typeof drift_time !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "drift_time" or "market_events" for context' },
        { status: 400 }
      );
    }

    if (!Array.isArray(public_posts)) {
      return NextResponse.json(
        { error: 'Missing or invalid "public_posts" or "posts" array' },
        { status: 400 }
      );
    }

    if (!Array.isArray(related_events)) {
      return NextResponse.json(
        { error: 'Missing or invalid "related_events" or "market_events" array' },
        { status: 400 }
      );
    }

    // If related_events are objects (e.g. { type, date }), stringify for prompt
    const relatedEventsList = related_events.map((e: any) =>
      typeof e === 'string' ? e : [e.type, e.date].filter(Boolean).join(' ')
    ).filter(Boolean);

    // Build the causal graph generation prompt
    const postsText = public_posts.length > 0
      ? public_posts.map((p: any, i: number) => {
          const text = typeof p === 'string' ? p : p.text || p.content || '';
          const timestamp = typeof p === 'object' && p.timestamp ? ` [${p.timestamp}]` : '';
          return `${i + 1}. [NARRATIVE]${timestamp} ${text}`;
        }).join('\n')
      : 'No public posts.';

    const eventsText = relatedEventsList.length > 0
      ? relatedEventsList.map((e: string, i: number) => `${i + 1}. [EVENT] ${e}`).join('\n')
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

    const result = await openRouterChat(apiKey, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Generate the causal graph now. Return only JSON.' },
      ],
      temperature: 0.2,
      max_tokens: 2500,
    });

    if ('error' in result) {
      console.error('Open Router API error:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    const fallbackGraph = { nodes: [], edges: [] };

    let parsedResult: { nodes?: any[]; edges?: any[] };
    try {
      parsedResult = parseJsonFromModel(result.content);
    } catch (parseError) {
      console.warn('Causal graph parse failed, returning fallback:', result.content?.substring(0, 200) || '(empty)');
      return NextResponse.json(fallbackGraph);
    }

    if (!Array.isArray(parsedResult.nodes)) {
      console.warn('Invalid response: missing nodes array, using fallback');
      return NextResponse.json(fallbackGraph);
    }
    if (!Array.isArray(parsedResult.edges)) {
      console.warn('Invalid response: missing edges array, using fallback');
      return NextResponse.json(fallbackGraph);
    }

    for (const node of parsedResult.nodes) {
      if (!node.id || !node.type) {
        node.id = node.id ?? 'unknown';
        node.type = 'Market';
      }
      const validTypes = ['Narrative', 'Market', 'Event'];
      if (!validTypes.includes(node.type)) {
        node.type = 'Market';
      }
    }

    for (const edge of parsedResult.edges) {
      if (!edge.from || !edge.to || typeof edge.weight !== 'number' || !edge.reasoning) {
        continue;
      }
      edge.weight = Math.max(0, Math.min(1, edge.weight));
    }

    const validEdges = parsedResult.edges.filter(
      (e: any) => e.from && e.to && typeof e.weight === 'number' && e.reasoning
    );

    return NextResponse.json({ nodes: parsedResult.nodes, edges: validEdges });
  } catch (error) {
    console.error('Causal graph generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
