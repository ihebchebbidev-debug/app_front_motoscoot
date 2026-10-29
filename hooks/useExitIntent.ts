import { useState, useEffect, useCallback, useRef } from 'react';

interface UseExitIntentOptions {
  threshold?: number; // Distance from top of window to trigger
  scrollThreshold?: number; // Pixels scrolled up to trigger
  delay?: number; // Delay before showing
  disabled?: boolean; // Disable the hook
}

export function useExitIntent({
  threshold = 20,
  scrollThreshold = 150,
  delay = 0,
  disabled = false,
}: UseExitIntentOptions = {}) {
  const [isTriggered, setIsTriggered] = useState(false);
  const maxScrollY = useRef(typeof window !== 'undefined' ? window.scrollY : 0);

  const trigger = useCallback(() => {
    if (disabled || isTriggered) return;
    
    setTimeout(() => {
      setIsTriggered(true);
    }, delay);
  }, [disabled, isTriggered, delay]);

  useEffect(() => {
    if (disabled) return;

    // Reset maxScrollY when enabling
    maxScrollY.current = window.scrollY;

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      
      // If scroll jumps to top (e.g., navigation), reset maxScroll
      if (currentScrollY < 50 && maxScrollY.current > 100) {
        maxScrollY.current = currentScrollY;
        return;
      }
      
      // Update max scroll
      if (currentScrollY > maxScrollY.current) {
        maxScrollY.current = currentScrollY;
      }
      
      // Trigger if scrolling up fast/significantly from the max scroll position
      if (maxScrollY.current - currentScrollY > scrollThreshold) {
        trigger();
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, [disabled, threshold, scrollThreshold, trigger]);

  const reset = useCallback(() => {
    setIsTriggered(false);
    maxScrollY.current = typeof window !== 'undefined' ? window.scrollY : 0;
  }, []);

  return { isTriggered, reset };
}
