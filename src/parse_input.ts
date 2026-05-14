export interface StartJobPayload {
  query: string;
  location?: string;
  limit: number;
}

function clampLimit(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  if (!Number.isFinite(n)) return 5;
  return Math.min(Math.max(Math.floor(n), 1), 10);
}

function fromFlatObject(obj: Record<string, unknown>): StartJobPayload | null {
  const query = typeof obj.query === 'string' ? obj.query.trim() : '';
  if (!query) return null;
  const location =
    typeof obj.location === 'string' && obj.location.trim()
      ? obj.location.trim()
      : undefined;
  const limit = clampLimit(obj.limit ?? 5);
  return { query, location, limit };
}

function fromKeyValueArray(arr: unknown[]): StartJobPayload | null {
  const map: Record<string, string> = {};
  for (const row of arr) {
    if (row && typeof row === 'object' && 'key' in row && 'value' in row) {
      const k = String((row as { key: unknown }).key);
      const v = (row as { value: unknown }).value;
      map[k] = v == null ? '' : String(v);
    }
  }
  return fromFlatObject(map);
}

export function parseInputData(inputData: unknown): StartJobPayload | null {
  if (Array.isArray(inputData)) {
    return fromKeyValueArray(inputData);
  }
  if (inputData && typeof inputData === 'object') {
    return fromFlatObject(inputData as Record<string, unknown>);
  }
  return null;
}
