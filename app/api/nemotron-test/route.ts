import { NextResponse } from 'next/server';
import { openRouterChat } from '../../lib/openrouter';

async function callNemotron() {
  const apiKey = process.env.OPEN_ROUTER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'OPEN_ROUTER_API_KEY not configured' },
      { status: 500 }
    );
  }

  const result = await openRouterChat(apiKey, {
    messages: [
      { role: 'user', content: 'Explain inflation in one paragraph.' },
    ],
    temperature: 0.5,
    max_tokens: 300,
  });

  if ('error' in result) {
    console.error('Open Router API error:', result.error);
    return NextResponse.json(
      { error: result.error },
      { status: 500 }
    );
  }

  return NextResponse.json({ result: result.content });
}

export async function GET() {
  try {
    return await callNemotron();
  } catch (error) {
    console.error('Nemotron test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    return await callNemotron();
  } catch (error) {
    console.error('Nemotron test error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
