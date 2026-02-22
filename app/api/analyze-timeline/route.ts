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

    // Parse request body
    const body = await request.json();
    const { drift_time, announcement_time, posts } = body;

    // Validate input
    if (!drift_time || typeof drift_time !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "drift_time" field' },
        { status: 400 }
      );
    }

    if (!announcement_time || typeof announcement_time !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "announcement_time" field' },
        { status: 400 }
      );
    }

    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json(
        { error: 'Missing or invalid "posts" array' },
        { status: 400 }
      );
    }

    // Validate posts structure
    for (const post of posts) {
      if (!post.text || !post.timestamp) {
        return NextResponse.json(
          { error: 'Each post must have "text" and "timestamp" fields' },
          { status: 400 }
        );
      }
    }

    // Build the analysis prompt
    const postsText = posts
      .map((p, i) => `Post ${i + 1} (${p.timestamp}):\n${p.text}`)
      .join('\n\n');

    const systemPrompt = `You are a financial intelligence analyst specializing in information asymmetry detection.

Analyze the timeline of social media posts in relation to market price drift events.

Given:
- Price drift occurred at: ${drift_time}
- Official announcement time: ${announcement_time}
- Social media posts with timestamps

Determine:
1. Whether any public signals (posts) preceded the price drift
2. The severity of information asymmetry risk
3. Whether this suggests potential insider information leakage

Return JSON only in this exact format. Do not include markdown, code fences, or any extra text. Use double quotes for all keys and string values.
{
  "public_signal_precedes_drift": boolean,
  "risk_level": "Low | Medium | High",
  "explanation": ""
}`;

    const userPrompt = `Posts to analyze:\n\n${postsText}`;

    const result = await openRouterChat(apiKey, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 800,
    });

    if ('error' in result) {
      console.error('Open Router API error:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    if (!result.content) {
      console.warn('No content returned from model');
      return NextResponse.json(
        { error: 'No content returned from model' },
        { status: 500 }
      );
    }

    try {
      const parsedResult = parseJsonFromModel<{
        public_signal_precedes_drift?: boolean | string;
        risk_level?: string;
        explanation?: string;
      }>(result.content);

      // Coerce public_signal_precedes_drift from string if needed
      if (typeof parsedResult.public_signal_precedes_drift !== 'boolean') {
        const v = String(parsedResult.public_signal_precedes_drift).toLowerCase();
        parsedResult.public_signal_precedes_drift = v === 'true';
      }

      // Normalize risk_level to Low | Medium | High
      if (typeof parsedResult.risk_level === 'string') {
        const normalized = parsedResult.risk_level.trim().toLowerCase();
        if (normalized === 'low' || normalized === 'medium' || normalized === 'high') {
          parsedResult.risk_level = normalized.charAt(0).toUpperCase() + normalized.slice(1);
        } else {
          parsedResult.risk_level = 'Low';
        }
      } else {
        parsedResult.risk_level = 'Low';
      }

      if (typeof parsedResult.explanation !== 'string') {
        parsedResult.explanation = parsedResult.explanation != null ? String(parsedResult.explanation) : '';
      }

      return NextResponse.json(parsedResult);
    } catch (parseError) {
      console.warn('Timeline analysis parse error (using fallback):', result.content?.substring(0, 100) + '...');

      return NextResponse.json({
        public_signal_precedes_drift: false,
        risk_level: 'Low',
        explanation: 'Timeline analysis response parsing failed. Using safe fallback result.'
      });
    }
  } catch (error) {
    console.error('Timeline analysis error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
