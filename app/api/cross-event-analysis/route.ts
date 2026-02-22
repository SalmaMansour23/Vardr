import { NextRequest, NextResponse } from 'next/server';
import { openRouterChat } from '../../lib/openrouter';
import { parseJsonFromModel } from '../../lib/parse-json-from-model';

const FALLBACK_CROSS_EVENT = { linked_events: [] };

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPEN_ROUTER_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPEN_ROUTER_API_KEY not configured' },
        { status: 500 }
      );
    }

    // Parse request body (support frontend shape: primary_event object, related_events objects, posts)
    const body = await request.json();
    const rawPrimary = body.primary_event;
    const primary_event = typeof rawPrimary === 'string'
      ? rawPrimary
      : rawPrimary && typeof rawPrimary === 'object'
        ? [rawPrimary.type, rawPrimary.drift_time].filter(Boolean).join(' at ')
        : '';
    const related_events_raw = body.related_events ?? [];
    const related_events = Array.isArray(related_events_raw) ? related_events_raw : [];
    const public_posts = body.public_posts ?? body.posts ?? [];

    if (!primary_event) {
      return NextResponse.json(
        { error: 'Missing or invalid "primary_event" field' },
        { status: 400 }
      );
    }

    if (related_events.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid "related_events" array' },
        { status: 400 }
      );
    }

    if (!Array.isArray(public_posts)) {
      return NextResponse.json(
        { error: 'Missing or invalid "public_posts" or "posts" array' },
        { status: 400 }
      );
    }

    // Build the analysis prompt (related_events can be objects { type, date } or strings)
    const relatedEventsList = related_events.map((e: any, i: number) =>
      `${i + 1}. ${typeof e === 'string' ? e : [e.type, e.date].filter(Boolean).join(' ')}`
    ).join('\n');
    
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

    const result = await openRouterChat(apiKey, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Perform the cross-event analysis now.' },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    if ('error' in result) {
      console.error('Open Router API error:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    let parsedResult: { linked_events?: any[] };
    try {
      parsedResult = parseJsonFromModel(result.content);
    } catch (parseError) {
      console.warn('Cross-event parse failed, returning fallback:', result.content?.substring(0, 200) || '(empty)');
      return NextResponse.json(FALLBACK_CROSS_EVENT);
    }

    if (!Array.isArray(parsedResult.linked_events)) {
      console.warn('Invalid response: missing linked_events, using fallback');
      return NextResponse.json(FALLBACK_CROSS_EVENT);
    }

    const validEvents = parsedResult.linked_events.filter(
      (e: any) => e?.event != null && typeof e.relationship_strength === 'number' && e.reasoning != null
    );
    for (const e of validEvents) {
      e.relationship_strength = Math.max(0, Math.min(1, e.relationship_strength));
    }

    return NextResponse.json({ linked_events: validEvents });
  } catch (error) {
    console.error('Cross-event analysis error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
