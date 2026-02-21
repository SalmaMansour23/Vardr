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

Return JSON only in this exact format:
{
  "public_signal_precedes_drift": boolean,
  "risk_level": "Low | Medium | High",
  "explanation": ""
}`;

    const userPrompt = `Posts to analyze:\n\n${postsText}`;

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
              content: userPrompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 800,
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
        typeof parsedResult.public_signal_precedes_drift !== 'boolean' ||
        !parsedResult.risk_level ||
        !parsedResult.explanation
      ) {
        console.warn('Invalid response structure:', parsedResult);
        return NextResponse.json(
          { error: 'Invalid response structure from model' },
          { status: 500 }
        );
      }

      // Validate risk_level enum
      const validRiskLevels = ['Low', 'Medium', 'High'];
      if (!validRiskLevels.includes(parsedResult.risk_level)) {
        console.warn('Invalid risk_level value:', parsedResult.risk_level);
        return NextResponse.json(
          { error: 'Invalid risk_level value from model' },
          { status: 500 }
        );
      }

      return NextResponse.json(parsedResult);
    } catch (parseError) {
      console.warn('⚠️ Timeline analysis parse error (using fallback):', generatedText.substring(0, 100) + '...');
      
      // Return a fallback result
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
