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
    const { post } = body;

    if (!post || typeof post !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid "post" field in request body' },
        { status: 400 }
      );
    }

    const systemPrompt = `You are a financial intelligence model.

Classify the following post as:
- Neutral
- Speculative
- Rumor-indicative
- Potential leak signal

Return JSON only in this format:
{
  "classification": "",
  "confidence": 0-1,
  "reasoning": ""
}`;

    const result = await openRouterChat(apiKey, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: post },
      ],
      temperature: 0.2,
      max_tokens: 600,
    });

    if ('error' in result) {
      console.error('Open Router API error:', result.error);
      return NextResponse.json(
        { error: result.error },
        { status: 500 }
      );
    }

    try {
      const parsedResult = parseJsonFromModel<{ classification: string; confidence: number; reasoning: string }>(result.content);
      
      // Validate the structure
      if (
        !parsedResult.classification ||
        typeof parsedResult.confidence !== 'number' ||
        !parsedResult.reasoning
      ) {
        console.warn('Invalid response structure:', parsedResult);
        return NextResponse.json(
          { error: 'Invalid response structure from model' },
          { status: 500 }
        );
      }

      return NextResponse.json(parsedResult);
    } catch (parseError) {
      console.warn('Model returned unparseable response (using fallback):', result.content?.substring(0, 100) + '...');

      return NextResponse.json({
        classification: 'Neutral',
        confidence: 0.5,
        reasoning: 'AI response parsing failed. Using safe fallback classification.'
      });
    }
  } catch (error) {
    console.error('Classification error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
