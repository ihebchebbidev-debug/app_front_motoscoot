import type { SortOption } from '../hooks/useListingFilters';

/**
 * Tri choisi sur téléphone : un seul tri visible à la fois.
 *
 * Exception cachée : quand « Autour de moi » est actif, 'proximity' reste en
 * second, car le rayon ne filtre que si 'proximity' est dans le tri
 * (filtersToServerParams). Le tri appliqué est toujours le premier.
 */
export function nextPhoneSort(option: SortOption, current: SortOption[]): SortOption[] {
  const keepGeo = option !== 'proximity' && current.includes('proximity');
  return keepGeo ? [option, 'proximity'] : [option];
}
