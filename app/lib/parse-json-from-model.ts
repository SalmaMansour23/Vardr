/**
 * Extract the first brace-balanced JSON object from text (handles trailing content).
 * Only tracks double-quoted strings so content like "reasoning": "text with ( parens" is handled.
 */
function extractFirstJsonObject(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) return text;
  let depth = 0;
  let inDoubleString = false;
  let i = start;
  while (i < text.length) {
    const c = text[i];
    if (inDoubleString) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === '"') {
        inDoubleString = false;
      }
      i++;
      continue;
    }
    if (c === '"') {
      inDoubleString = true;
      i++;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
    i++;
  }
  return text.slice(start);
}

const REPAIR_SUFFIXES = ['"}', '"]}', '"}]}', '"}', ']}', '}'];

/**
 * Parse JSON from model output: strip markdown, extract object, optionally repair truncated JSON.
 */
export function parseJsonFromModel<T = unknown>(raw: string): T {
  let text = (raw ?? '').trim();
  if (!text) {
    throw new Error('Empty model response');
  }
  if (text.startsWith('```json')) {
    text = text.replace(/^```json\s*/, '').replace(/```\s*$/, '');
  } else if (text.startsWith('```')) {
    text = text.replace(/^```\s*/, '').replace(/```\s*$/, '');
  }
  text = extractFirstJsonObject(text);

  let lastError: Error | null = null;
  try {
    return JSON.parse(text) as T;
  } catch (e) {
    lastError = e instanceof Error ? e : new Error(String(e));
  }

  for (const suffix of REPAIR_SUFFIXES) {
    try {
      return JSON.parse(text + suffix) as T;
    } catch {
      continue;
    }
  }

  throw lastError ?? new Error('Failed to parse JSON');
}
