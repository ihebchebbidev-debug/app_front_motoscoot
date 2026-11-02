import type { TechSpec } from '../types';

const VALID_CATEGORIES = ['Roadster', 'Sportive', 'Trail', 'Scooter', 'Custom', 'Off-road'];

export function normalizeCategory(c?: string): TechSpec['category'] {
  if (!c) return 'Roadster';
  const found = VALID_CATEGORIES.find((v) => v.toLowerCase() === c.toLowerCase());
  if (found) return found as TechSpec['category'];
  // Admin free-text variants ("Maxi Scooter", "Scooter / Adventure (ADV)",
  // "MotoTrail adventure") used to fall back to Roadster.
  if (/scooter/i.test(c)) return 'Scooter';
  if (/trail/i.test(c)) return 'Trail';
  return 'Roadster';
}
