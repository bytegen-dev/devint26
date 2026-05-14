export async function mapPool<T, R>(
  items: readonly T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }
  const results: R[] = new Array(items.length);
  const limit = Math.max(1, Math.min(concurrency, items.length));
  let next = 0;

  async function worker(): Promise<void> {
    for (;;) {
      const idx = next++;
      if (idx >= items.length) {
        return;
      }
      results[idx] = await fn(items[idx]!, idx);
    }
  }

  await Promise.all(Array.from({ length: limit }, () => worker()));
  return results;
}
