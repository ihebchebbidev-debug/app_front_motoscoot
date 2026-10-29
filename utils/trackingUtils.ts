export const VISITS_KEY = 'motoscoot_brand_visits';

// Cap the number of distinct brands we keep in localStorage so the visit map
// can't grow unbounded over months of browsing (which would eventually trip
// the storage quota and silently fail every subsequent write).
const MAX_TRACKED_BRANDS = 100;

/** Persist a visit map, evicting least-visited brands when over the cap. */
const writeVisits = (visits: Record<string, number>) => {
  let entries = Object.entries(visits);
  if (entries.length > MAX_TRACKED_BRANDS) {
    entries = entries
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_TRACKED_BRANDS);
  }
  const trimmed = Object.fromEntries(entries);
  try {
    localStorage.setItem(VISITS_KEY, JSON.stringify(trimmed));
  } catch {
    // Quota exceeded — drop the map entirely rather than leaving a corrupt blob.
    try { localStorage.removeItem(VISITS_KEY); } catch { /* ignore */ }
  }
};

export const trackBrandVisit = async (brand: string) => {
  if (!brand) return;
  
  // 1. Local storage fallback (pour une réactivité immédiate côté client)
  try {
    const visits = JSON.parse(localStorage.getItem(VISITS_KEY) || '{}');
    visits[brand] = (visits[brand] || 0) + 1;
    writeVisits(visits);
  } catch (e) {
    console.error("Could not track visit locally", e);
  }

  // 2. API call (community-wide tracking)
  try {
    const { apiClient } = await import('../services/apiClient');
    await apiClient.post('/brands/visit', { brand });
  } catch {
    // Suppress — tracking is best-effort and must never alert the user.
  }
};

export const fetchPopularBrands = async (allBrands: string[], defaultBrands: string[], limit: number = 6): Promise<string[]> => {
  try {
    const { apiClient } = await import('../services/apiClient');
    const data = await apiClient.get<{ brands?: string[] }>('/brands/popular');
    if (data?.brands && data.brands.length > 0) {
      const validBrands = data.brands.filter((b: string) => allBrands.includes(b));
      const result = new Set<string>(validBrands);
      for (const b of defaultBrands) {
        if (result.size >= limit) break;
        result.add(b);
      }
      return Array.from(result).slice(0, limit);
    }
  } catch {
    // API not reachable — fall through to local-storage fallback.
  }
  return getPopularBrands(allBrands, defaultBrands, limit);
};

export const getPopularBrands = (allBrands: string[], defaultBrands: string[], limit: number = 6): string[] => {
  try {
    const visits = JSON.parse(localStorage.getItem(VISITS_KEY) || '{}');
    const sortedVisited = Object.entries(visits)
      .sort((a: any, b: any) => b[1] - a[1])
      .map(entry => entry[0])
      .filter(brand => allBrands.includes(brand as string));

    const result = new Set<string>(sortedVisited);
    for (const b of defaultBrands) {
      if (result.size >= limit) break;
      result.add(b);
    }
    return Array.from(result).slice(0, limit);
  } catch (e) {
    return defaultBrands.slice(0, limit);
  }
};
