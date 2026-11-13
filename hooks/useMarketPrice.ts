import { useCallback, useEffect, useRef, useState } from 'react';
import { listingsApi, type PriceEstimate } from '../services/listingsApi';

interface MarketPriceInput {
  category?: string;
  brand?: string;
  model?: string;
  year?: string;
  condition?: string;
}

/**
 * The market price of the vehicle being described (none for accessories),
 * asked 800 ms after the last change, the previous request cancelled.
 * `clear()` forgets it and cancels what is on its way (a new deposit).
 */
export function useMarketPrice({ category, brand, model, year, condition }: MarketPriceInput) {
  const [estimate, setEstimate] = useState<PriceEstimate | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    if (request.current) request.current.abort();
  }, []);

  useEffect(() => {
    if (category === 'Accessoires' || !brand) {
      setEstimate(null);
      return;
    }
    cancel();
    timer.current = setTimeout(async () => {
      const ctrl = new AbortController();
      request.current = ctrl;
      try {
        const result = await listingsApi.estimatePrice(
          {
            brand,
            model: model || undefined,
            year: year ? parseInt(year) : undefined,
            condition: condition || undefined,
          },
          ctrl.signal,
        );
        setEstimate(result);
      } catch {
        setEstimate(null);
      }
    }, 800);
    return cancel;
  }, [category, brand, model, year, condition, cancel]);

  const clear = useCallback(() => {
    cancel();
    setEstimate(null);
  }, [cancel]);

  return { estimate, clear };
}
