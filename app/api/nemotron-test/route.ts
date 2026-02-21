import { NextResponse } from 'next/server';

async function callNemotron() {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: 'NVIDIA_API_KEY not configured' },
      { status: 500 }
    );
  }

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
            role: 'user',
            content: 'Explain inflation in one paragraph.',
          },
        ],
        temperature: 0.5,
        max_tokens: 300,
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

  // Extract the generated text from the response
  const generatedText = data.choices?.[0]?.message?.content;

  if (!generatedText) {
    return NextResponse.json(
      { error: 'No content returned from model' },
      { status: 500 }
    );
  }

  return NextResponse.json({ result: generatedText });
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
