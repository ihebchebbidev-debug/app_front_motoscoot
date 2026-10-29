/** Older external API deployments resolve editorial content by slug only. */
export async function resolveEditorial<T extends { id: number | string; slug?: string }>(
  id: number | string,
  get: (key: string) => Promise<T>,
  list: (page: number) => Promise<{ rows: T[]; totalPages?: number }>,
): Promise<T> {
  try { return await get(String(id)); } catch (error) {
    if ((error as { status?: number }).status !== 404) throw error;
    for (let page = 1; page <= 100; page++) {
      const data = await list(page);
      const hit = data.rows.find(row => String(row.id) === String(id) || row.slug === String(id));
      if (hit?.slug) return await get(hit.slug);
      if (data.rows.length < 100 || (data.totalPages && page >= data.totalPages)) throw error;
    }
    throw new Error('Le catalogue est temporairement indisponible.');
  }
}