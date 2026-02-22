const OPEN_ROUTER_URL = process.env.OPEN_ROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'nvidia/nemotron-3-nano-30b-a3b';

/** Nvidia model used for the expert-panel agent (experts + synthesis). Override with OPEN_ROUTER_AGENT_MODEL. */
export function getAgentModel(): string {
  return process.env.OPEN_ROUTER_AGENT_MODEL ?? DEFAULT_MODEL;
}

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterChatOptions {
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  model?: string;
}

export type OpenRouterChatResult =
  | { content: string }
  | { error: string };

/**
 * Call Open Router chat completions (e.g. Nemotron). Returns content or error.
 */
export async function openRouterChat(
  apiKey: string,
  options: OpenRouterChatOptions
): Promise<OpenRouterChatResult> {
  const {
    messages,
    temperature = 0.3,
    max_tokens = 800,
    model = DEFAULT_MODEL,
  } = options;

  try {
    const response = await fetch(OPEN_ROUTER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Open Router API error:', response.status, errorText);
      return { error: `API request failed: ${response.statusText}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (content == null || typeof content !== 'string') {
      return { error: 'No content returned from model' };
    }

    return { content: content.trim() };
  } catch (err) {
    console.error('Open Router chat error:', err);
    return { error: String(err) };
  }
}
