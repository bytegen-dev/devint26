import Anthropic from '@anthropic-ai/sdk';

const MODEL = process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-20250514';

function anthropicTimeoutMs(): number {
  const n = Number(process.env.ANTHROPIC_TIMEOUT_MS);
  if (Number.isFinite(n) && n >= 10_000) {
    return Math.min(Math.floor(n), 600_000);
  }
  return 120_000;
}

let client: Anthropic | null = null;

function anthropic(): Anthropic {
  if (!client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }
    client = new Anthropic({ apiKey: key, timeout: anthropicTimeoutMs() });
  }
  return client;
}

export type ActivityLevel = 'high' | 'medium' | 'low';
export type Confidence = 'high' | 'medium' | 'low';

export interface DeveloperReport {
  username: string;
  name: string;
  summary: string;
  primarySkills: string[];
  activityLevel: ActivityLevel;
  trajectory: string;
  bestSuitedFor: string[];
  confidence: Confidence;
  confidenceReason: string;
}

function extractJsonObject(text: string): string {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('no JSON object in model output');
  }
  return text.slice(start, end + 1);
}

export async function parseQueryToGithubSearch(
  query: string,
  location: string | undefined,
): Promise<string> {
  const api = anthropic();
  const system = `Reply with one JSON object only: {"searchQuery":"..."}. 
searchQuery is a GitHub user search string (language:, location:, keywords, etc.).`;
  const user = `Query: ${query}\nLocation hint: ${location ?? 'none'}`;

  const msg = await api.messages.create({
    model: MODEL,
    max_tokens: 512,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const block = msg.content.find((b) => b.type === 'text' && 'text' in b);
  if (!block || block.type !== 'text') {
    throw new Error('no text block from model');
  }
  const raw = extractJsonObject(block.text.trim());
  const parsed = JSON.parse(raw) as { searchQuery?: string };
  if (!parsed.searchQuery || typeof parsed.searchQuery !== 'string') {
    throw new Error('missing searchQuery in model JSON');
  }
  return parsed.searchQuery.trim();
}

export async function generateDeveloperReport(
  username: string,
  githubBundleJson: string,
): Promise<DeveloperReport> {
  const api = anthropic();
  const system = `Assess the developer from the JSON (profile, repos, events). Output one JSON object only.
Fields: username, name, summary (2–4 sentences), primarySkills (string[]), activityLevel (high|medium|low), trajectory (string), bestSuitedFor (string[]), confidence (high|medium|low), confidenceReason (string).`;

  const user = `login: ${username}\n${githubBundleJson}`;

  const msg = await api.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system,
    messages: [{ role: 'user', content: user }],
  });
  const block = msg.content.find((b) => b.type === 'text' && 'text' in b);
  if (!block || block.type !== 'text') {
    throw new Error('no text block from model');
  }
  const raw = extractJsonObject(block.text.trim());
  const parsed = JSON.parse(raw) as DeveloperReport;
  if (!parsed.username || !parsed.summary) {
    throw new Error('invalid report JSON from model');
  }
  return parsed;
}
