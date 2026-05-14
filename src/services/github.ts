const GITHUB_API = 'https://api.github.com';

export interface GithubUserSummary {
  login: string;
  id: number;
  avatar_url?: string;
  html_url?: string;
}

export interface GithubProfile {
  login: string;
  name: string | null;
  bio: string | null;
  company: string | null;
  location: string | null;
  blog: string | null;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
}

export interface GithubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  pushed_at: string | null;
  html_url: string;
  topics?: string[];
}

export interface GithubEvent {
  type: string;
  created_at: string;
  repo?: { name: string };
  payload?: Record<string, unknown>;
}

function headers(token: string): HeadersInit {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'devint26-talent-agent',
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parseRetryAfterMs(res: Response): number | null {
  const ra = res.headers.get('retry-after');
  if (!ra) {
    return null;
  }
  const sec = parseInt(ra, 10);
  if (!Number.isNaN(sec)) {
    return sec * 1000;
  }
  const date = Date.parse(ra);
  if (!Number.isNaN(date)) {
    return Math.max(0, date - Date.now());
  }
  return null;
}

function isGithubRateLimit(res: Response, bodySample: string): boolean {
  if (res.status === 429) {
    return true;
  }
  if (res.status !== 403) {
    return false;
  }
  const remaining = res.headers.get('x-ratelimit-remaining');
  if (remaining === '0') {
    return true;
  }
  return /rate limit/i.test(bodySample);
}

/** Truncate, strip controls, normalize whitespace (GitHub user search q). */
export function sanitizeGithubUserSearchQuery(raw: string): string {
  const noControls = raw.replace(/[\u0000-\u001F\u007F]/g, ' ');
  const collapsed = noControls.replace(/\s+/g, ' ').trim();
  const max = Number(process.env.GITHUB_SEARCH_QUERY_MAX_LENGTH) || 256;
  return collapsed.slice(0, max);
}

async function ghFetch<T>(token: string, path: string): Promise<T> {
  const maxAttempts = Number(process.env.GITHUB_MAX_RETRIES) || 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(`${GITHUB_API}${path}`, { headers: headers(token) });
    if (res.ok) {
      return res.json() as Promise<T>;
    }

    const text = await res.text().catch(() => '');
    const sample = text.slice(0, 500);

    if (attempt < maxAttempts && isGithubRateLimit(res, sample)) {
      const retryMs =
        parseRetryAfterMs(res) ?? Math.min(60_000, 1000 * 2 ** attempt);
      await sleep(retryMs);
      continue;
    }

    throw new Error(`GitHub ${res.status} ${path}: ${sample.slice(0, 200)}`);
  }

  throw new Error(`GitHub request exhausted retries: ${path}`);
}

export async function searchUsers(
  token: string,
  searchQuery: string,
  limit: number,
): Promise<GithubUserSummary[]> {
  const safe = sanitizeGithubUserSearchQuery(searchQuery);
  if (!safe) {
    throw new Error('GitHub search query is empty after sanitization');
  }
  const q = encodeURIComponent(safe);
  const perPage = Math.min(Math.max(limit, 1), 10);
  const data = await ghFetch<{ items: GithubUserSummary[] }>(
    token,
    `/search/users?q=${q}&per_page=${perPage}`,
  );
  return data.items ?? [];
}

export async function fetchUserProfile(token: string, username: string): Promise<GithubProfile> {
  return ghFetch<GithubProfile>(token, `/users/${encodeURIComponent(username)}`);
}

export async function fetchUserRepos(token: string, username: string): Promise<GithubRepo[]> {
  return ghFetch<GithubRepo[]>(
    token,
    `/users/${encodeURIComponent(username)}/repos?sort=updated&per_page=20`,
  );
}

export async function fetchUserEvents(token: string, username: string): Promise<GithubEvent[]> {
  return ghFetch<GithubEvent[]>(
    token,
    `/users/${encodeURIComponent(username)}/events?per_page=30`,
  );
}

export interface UserGithubBundle {
  profile: GithubProfile;
  repos: GithubRepo[];
  events: GithubEvent[];
}

export async function fetchUserBundle(token: string, username: string): Promise<UserGithubBundle> {
  const [profile, repos, events] = await Promise.all([
    fetchUserProfile(token, username),
    fetchUserRepos(token, username),
    fetchUserEvents(token, username),
  ]);
  return { profile, repos, events };
}
