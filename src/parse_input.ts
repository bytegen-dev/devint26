export interface StartJobPayload {
  query: string;
  location?: string;
  limit: number;
}

export function parseInputDataArray(inputData: unknown): StartJobPayload | null {
  if (!Array.isArray(inputData)) {
    return null;
  }
  const map: Record<string, string> = {};
  for (const row of inputData) {
    if (row && typeof row === 'object' && 'key' in row && 'value' in row) {
      const k = String((row as { key: unknown }).key);
      const v = (row as { value: unknown }).value;
      map[k] = v == null ? '' : String(v);
    }
  }
  const query = map.query?.trim();
  if (!query) {
    return null;
  }
  const limitRaw = map.limit?.trim();
  const parsedLimit = limitRaw ? parseInt(limitRaw, 10) : 5;
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(parsedLimit, 1), 10)
    : 5;
  const location = map.location?.trim() || undefined;
  return { query, location, limit };
}
