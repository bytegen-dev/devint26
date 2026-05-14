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

export interface NotableProject {
  name: string;
  why: string;
}

export interface DeveloperReport {
  username: string;
  name: string;
  summary: string;
  primarySkills: string[];
  secondarySkills: string[];
  activityLevel: ActivityLevel;
  notableProjects: NotableProject[];
  strengths: string[];
  weaknesses: string[];
  workStyle: string;
  trajectory: string;
  bestSuitedFor: string[];
  hiringAdvice: string;
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
  const system = `You are a senior technical recruiter and engineering manager producing a talent intelligence report from GitHub data. Analyze the developer's profile, repos, and recent events. Be specific and opinionated — generic observations are useless.

Output one JSON object with these fields:
- username (string)
- name (string)
- summary (string, 3–5 sentences of genuine insight — what makes this developer distinctive, not a restatement of their bio)
- primarySkills (string[], top 3–5 core technologies they demonstrably use)
- secondarySkills (string[], 2–4 emerging or less-proven skills based on repo evidence)
- activityLevel ("high"|"medium"|"low")
- notableProjects (array of {name, why} — 2–4 repos that reveal the most about their abilities, with specific reasons why each matters)
- strengths (string[], 2–4 specific technical or professional strengths with evidence from the data)
- weaknesses (string[], 1–3 gaps, risks, or concerns a hiring manager should know — e.g. "no testing visible", "all repos are forks", "no collaboration signals")
- workStyle (string, 1–2 sentences — solo builder vs team player, breadth vs depth, shipping pace, evidence of code review or PR workflow)
- trajectory (string, 2–3 sentences — what direction is this person heading? Are they growing, plateauing, or pivoting? Base this on chronological repo/event patterns)
- bestSuitedFor (string[], 3–5 specific role types or team contexts)
- hiringAdvice (string, 2–3 sentences — what to probe in an interview, what risks to watch for, what this profile doesn't tell you)
- confidence ("high"|"medium"|"low")
- confidenceReason (string, what data drove the confidence level — sparse repos lower it, org contributions raise it)`;

  const user = `login: ${username}\n${githubBundleJson}`;

  const msg = await api.messages.create({
    model: MODEL,
    max_tokens: 4096,
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
