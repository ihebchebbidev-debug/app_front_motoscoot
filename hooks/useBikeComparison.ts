import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { TechSpec, ViewStateName, NavigationParams } from '../types';
import { techSpecsApi } from '../services/techSpecsApi';
import { parseNumericValue, getSpecValue, ComparisonRow } from '../utils/comparisonUtils';
import { canSelectComparisonId, parseComparisonIds } from '../utils/comparisonSelection';

interface UseBikeComparisonProps {
  initialIds?: string;
  onNavigate?: (view: ViewStateName, params?: NavigationParams) => void;
  maxSlots?: number;
}

type SpecId = number | string;
type Slot = SpecId | null;

/**
 * Parse a comma-separated id list. Accepts both numeric (legacy) and UUID
 * (current Postgres schema) ids. Previously this code coerced everything via
 * `parseInt(id, 10)`, which silently dropped UUIDs and left every slot empty
 * when the page was deep-linked from a tech-spec details page.
 */
function parseIdList(raw: string): SpecId[] {
  return parseComparisonIds(raw, 2);
}

/**
 * Manage 2–4 selected tech specs to compare side-by-side.
 * Uses the backend `/api/tech-specs/compare` endpoint to fetch the actual
 * spec rows for the selected ids.
 */
export const useBikeComparison = ({
  initialIds,
  onNavigate,
  maxSlots = 2,
}: UseBikeComparisonProps) => {
  const [slots, setSlots] = useState<Slot[]>(() => {
    const idsToParse = initialIds;

    const initialSlots: Slot[] = Array(maxSlots).fill(null);
    if (idsToParse) {
      const parsedIds = parseIdList(idsToParse);
      parsedIds.forEach((id, i) => {
        if (i < maxSlots) initialSlots[i] = id;
      });
    }
    return initialSlots;
  });

  // Sync from props (deep-link via URL)
  useEffect(() => {
    if (initialIds !== undefined) {
      const parsedIds = parseIdList(initialIds);
      const newSlots: Slot[] = Array(maxSlots).fill(null);
      parsedIds.forEach((id, i) => {
        if (i < maxSlots) newSlots[i] = id;
      });
      setSlots(newSlots);
    }
  }, [initialIds, maxSlots]);

  // Persist + URL sync
  const syncWithUrl = useCallback((newSlots: Slot[]) => {
    const activeIds = newSlots.filter((id): id is SpecId => id !== null).join(',');
    try {
      localStorage.setItem('compare_ids', activeIds);
    } catch { /* ignore quota errors */ }
    if (onNavigate) {
      onNavigate('comparator', { ids: activeIds });
    }
  }, [onNavigate]);

  // Fetch the actual TechSpec objects for the selected ids
  const activeIds = useMemo(
    () => slots.filter((id): id is SpecId => id !== null),
    [slots],
  );

  const { data: fetchedBikes = [], isLoading, isError, refetch } = useQuery<TechSpec[]>({
    queryKey: ['tech-specs', 'compare', activeIds],
    queryFn: async ({ signal }) => {
      if (!activeIds.length) return [];
      // Try the dedicated /compare endpoint first; if not available, fan out.
      try {
        const bikes = await techSpecsApi.compare(activeIds);
        if (bikes.length !== activeIds.length) throw new Error('Comparaison incomplète');
        return bikes;
      } catch {
        return await Promise.all(
          activeIds.map((id) => techSpecsApi.getById(id, signal)),
        );
      }
    },
    enabled: activeIds.length > 0,
    staleTime: 1000 * 60 * 10,
  });

  const selectedBikes = useMemo(() => {
    const byId = new Map<string, TechSpec>(fetchedBikes.map((b) => [String(b.id), b]));
    return slots.map((id) => (id !== null ? byId.get(String(id)) || null : null));
  }, [slots, fetchedBikes]);

  const activeBikes = useMemo(
    () => selectedBikes.filter((b): b is TechSpec => b !== null),
    [selectedBikes],
  );

  const addBike = useCallback((slotIndex: number, id: SpecId) => {
    setSlots((current) => {
      if (!canSelectComparisonId(current, slotIndex, id)) return current;
      const next = [...current];
      next[slotIndex] = id;
      syncWithUrl(next);
      return next;
    });
  }, [syncWithUrl]);

  const removeBike = useCallback((slotIndex: number) => {
    setSlots((current) => {
      const next = [...current];
      next[slotIndex] = null;
      syncWithUrl(next);
      return next;
    });
  }, [syncWithUrl]);

  const clearAll = useCallback(() => {
    const empty: Slot[] = Array(maxSlots).fill(null);
    setSlots(empty);
    syncWithUrl(empty);
  }, [maxSlots, syncWithUrl]);

  const getWinnerId = useCallback((row: ComparisonRow): SpecId | null => {
    if (activeBikes.length < 2) return null;

    let bestVal = row.better === 'lower' ? Infinity : -Infinity;
    let winnerId: SpecId | null = null;
    let isDraw = false;

    activeBikes.forEach((bike) => {
      const rawVal = getSpecValue(bike, row);
      const numericVal = parseNumericValue(rawVal);

      if (numericVal === 0) return;

      if (row.better === 'lower') {
        if (numericVal < bestVal) {
          bestVal = numericVal;
          winnerId = bike.id;
          isDraw = false;
        } else if (numericVal === bestVal) {
          isDraw = true;
        }
      } else {
        if (numericVal > bestVal) {
          bestVal = numericVal;
          winnerId = bike.id;
          isDraw = false;
        } else if (numericVal === bestVal) {
          isDraw = true;
        }
      }
    });

    return isDraw ? null : winnerId;
  }, [activeBikes]);

  const isRowIdentical = useCallback((row: ComparisonRow): boolean => {
    if (activeBikes.length < 2) return false;
    const values = activeBikes.map((bike) => {
      const val = getSpecValue(bike, row);
      return String(val ?? '').trim().toLowerCase();
    });
    return values.every((v) => v === values[0]);
  }, [activeBikes]);

  return {
    slots,
    isLoading,
    isError,
    refetch,
    selectedBikes,
    activeBikes,
    addBike,
    removeBike,
    clearAll,
    getWinnerId,
    isRowIdentical,
  };
};
