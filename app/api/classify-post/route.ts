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
              content: post,
            },
          ],
          temperature: 0.2,
          max_tokens: 500,
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
      // Remove markdown code blocks if present
      let cleanedText = generatedText.trim();
      
      // Remove ```json and ``` markers
      cleanedText = cleanedText.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
      
      // Try to extract JSON object if there's surrounding text
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
      
      const parsedResult = JSON.parse(cleanedText);
      
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
      console.warn('⚠️ Model returned unparseable response (using fallback):', generatedText.substring(0, 100) + '...');
      
      // Return a fallback classification
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
