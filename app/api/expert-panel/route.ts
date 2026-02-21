import { NextRequest, NextResponse } from 'next/server';

interface ExpertReport {
  expert_type: string;
  risk_assessment: number;
  key_findings: string[];
  reasoning: string;
}

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
    const { contract_data, trade_data, public_signals } = body;

    // Validate input
    if (!contract_data || typeof contract_data !== 'object') {
      return NextResponse.json(
        { error: 'Missing or invalid "contract_data" field' },
        { status: 400 }
      );
    }

    // Build data summaries
    const contractSummary = `
Contract: ${contract_data.name || 'Unknown'}
Description: ${contract_data.description || 'N/A'}
Announcement Time: ${contract_data.announcementTime ? new Date(contract_data.announcementTime).toISOString() : 'N/A'}
Current Price: ${contract_data.currentPrice || 'N/A'}
Risk Score: ${contract_data.riskScore || 'N/A'}
`;

    const tradeDataArray = Array.isArray(trade_data) ? trade_data : [];
    const tradeSummary = tradeDataArray.slice(0, 30).map((trade: any, i: number) => {
      return `${i + 1}. ${trade.traderId} | ${trade.direction} | Size: ${trade.size} | ${new Date(trade.timestamp).toISOString()}`;
    }).join('\n');

    const publicSignalsArray = Array.isArray(public_signals) ? public_signals : [];
    const signalsSummary = publicSignalsArray.slice(0, 20).map((signal: any, i: number) => {
      const text = typeof signal === 'string' ? signal : signal.text || signal.content || '';
      const timestamp = typeof signal === 'object' && signal.timestamp ? ` [${signal.timestamp}]` : '';
      return `${i + 1}.${timestamp} ${text}`;
    }).join('\n');

    // Expert 1: Statistical Analyst
    const statisticalPrompt = `You are a Statistical Analyst specializing in quantitative market anomaly detection.

MARKET DATA:
${contractSummary}

TRADE DATA SAMPLE:
${tradeSummary}

ANALYSIS FOCUS:
- Price drift patterns and deviations
- Volume anomalies and spikes
- Z-scores and statistical outliers
- Time-series anomalies
- Pre-event vs post-event metrics

Assess information asymmetry risk from a purely statistical perspective.

Return ONLY valid JSON:
{
  "expert_type": "Statistical Analyst",
  "risk_assessment": 0-100,
  "key_findings": ["finding1", "finding2", "finding3"],
  "reasoning": "detailed statistical analysis"
}`;

    // Expert 2: Narrative Intelligence Analyst
    const narrativePrompt = `You are a Narrative Intelligence Analyst specializing in information flow and social signal analysis.

MARKET DATA:
${contractSummary}

PUBLIC SIGNALS:
${signalsSummary}

ANALYSIS FOCUS:
- Public signal timing relative to market events
- Rumor propagation patterns
- Information cascade detection
- Narrative-to-market correlations
- Leak indicators in public discourse

Assess information asymmetry risk from narrative intelligence perspective.

Return ONLY valid JSON:
{
  "expert_type": "Narrative Intelligence Analyst",
  "risk_assessment": 0-100,
  "key_findings": ["finding1", "finding2", "finding3"],
  "reasoning": "detailed narrative analysis"
}`;

    // Expert 3: Market Microstructure Expert
    const microstructurePrompt = `You are a Market Microstructure Expert specializing in trading behavior and coordination patterns.

MARKET DATA:
${contractSummary}

TRADE DATA SAMPLE:
${tradeSummary}

ANALYSIS FOCUS:
- Trade sequencing patterns
- Cross-account coordination indicators
- Order flow imbalances
- Trade timing clustering
- Informed trader behavior signatures

Assess information asymmetry risk from microstructure perspective.

Return ONLY valid JSON:
{
  "expert_type": "Market Microstructure Expert",
  "risk_assessment": 0-100,
  "key_findings": ["finding1", "finding2", "finding3"],
  "reasoning": "detailed microstructure analysis"
}`;

    // Call all three experts in parallel
    const expertPromises = [
      callExpert(apiKey, statisticalPrompt),
      callExpert(apiKey, narrativePrompt),
      callExpert(apiKey, microstructurePrompt),
    ];

    const expertReports = await Promise.all(expertPromises);

    // Check if any expert calls failed
    const failedExperts = expertReports.filter((report) => 'error' in report);
    if (failedExperts.length > 0) {
      return NextResponse.json(
        {
          error: 'One or more expert analyses failed',
          details: failedExperts,
        },
        { status: 500 }
      );
    }

    // Type assertion after validation
    const validReports = expertReports as ExpertReport[];

    // Build synthesis prompt
    const synthesisPrompt = `You are a Senior Intelligence Director synthesizing multiple expert reports.

EXPERT REPORTS:

1. STATISTICAL ANALYST REPORT:
Risk Assessment: ${validReports[0].risk_assessment}/100
Key Findings: ${validReports[0].key_findings.join('; ')}
Reasoning: ${validReports[0].reasoning}

2. NARRATIVE INTELLIGENCE ANALYST REPORT:
Risk Assessment: ${validReports[1].risk_assessment}/100
Key Findings: ${validReports[1].key_findings.join('; ')}
Reasoning: ${validReports[1].reasoning}

3. MARKET MICROSTRUCTURE EXPERT REPORT:
Risk Assessment: ${validReports[2].risk_assessment}/100
Key Findings: ${validReports[2].key_findings.join('; ')}
Reasoning: ${validReports[2].reasoning}

SYNTHESIS TASK:
Produce a unified integrity assessment weighing all three expert perspectives. Consider:
- Areas of agreement vs disagreement
- Relative weight of statistical vs behavioral vs narrative evidence
- Overall confidence in the assessment

Return ONLY valid JSON:
{
  "final_risk_score": 0-100,
  "confidence": 0.0-1.0,
  "summary": "comprehensive synthesis of all expert findings"
}`;

    // Final synthesis call
    const synthesisReport = await callSynthesis(apiKey, synthesisPrompt);

    if ('error' in synthesisReport) {
      return NextResponse.json(
        {
          error: 'Synthesis analysis failed',
          details: synthesisReport.error,
        },
        { status: 500 }
      );
    }

    // Return complete expert panel results
    return NextResponse.json({
      expert_reports: validReports,
      final_assessment: synthesisReport,
    });
  } catch (error) {
    console.error('Expert panel analysis error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Call a single expert with specific prompt
 */
async function callExpert(apiKey: string, systemPrompt: string): Promise<ExpertReport | { error: string }> {
  try {
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
              content: 'Provide your expert analysis now. Return only JSON.',
            },
          ],
          temperature: 0.4,
          max_tokens: 800,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Expert call failed:', response.status, errorText);
      return { error: `API request failed: ${response.statusText}` };
    }

    const data = await response.json();
    let generatedText = data.choices?.[0]?.message?.content;

    if (!generatedText) {
      return { error: 'No content returned from model' };
    }

    // Clean up response
    generatedText = generatedText.trim();
    if (generatedText.startsWith('```json')) {
      generatedText = generatedText.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (generatedText.startsWith('```')) {
      generatedText = generatedText.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    const parsed = JSON.parse(generatedText);

    // Validate structure
    if (
      !parsed.expert_type ||
      typeof parsed.risk_assessment !== 'number' ||
      !Array.isArray(parsed.key_findings) ||
      !parsed.reasoning
    ) {
      return { error: 'Invalid expert report structure' };
    }

    // Clamp risk assessment to 0-100
    parsed.risk_assessment = Math.max(0, Math.min(100, parsed.risk_assessment));

    return parsed as ExpertReport;
  } catch (error) {
    console.error('Expert call error:', error);
    return { error: String(error) };
  }
}

/**
 * Call synthesis model to combine expert reports
 */
async function callSynthesis(
  apiKey: string,
  systemPrompt: string
): Promise<{ final_risk_score: number; confidence: number; summary: string } | { error: string }> {
  try {
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
              content: 'Provide your unified synthesis now. Return only JSON.',
            },
          ],
          temperature: 0.3,
          max_tokens: 600,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Synthesis call failed:', response.status, errorText);
      return { error: `API request failed: ${response.statusText}` };
    }

    const data = await response.json();
    let generatedText = data.choices?.[0]?.message?.content;

    if (!generatedText) {
      return { error: 'No content returned from synthesis model' };
    }

    // Clean up response
    generatedText = generatedText.trim();
    if (generatedText.startsWith('```json')) {
      generatedText = generatedText.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (generatedText.startsWith('```')) {
      generatedText = generatedText.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    const parsed = JSON.parse(generatedText);

    // Validate structure
    if (
      typeof parsed.final_risk_score !== 'number' ||
      typeof parsed.confidence !== 'number' ||
      !parsed.summary
    ) {
      return { error: 'Invalid synthesis report structure' };
    }

    // Clamp values
    parsed.final_risk_score = Math.max(0, Math.min(100, parsed.final_risk_score));
    parsed.confidence = Math.max(0, Math.min(1, parsed.confidence));

    return parsed;
  } catch (error) {
    console.error('Synthesis call error:', error);
    return { error: String(error) };
  }
}
