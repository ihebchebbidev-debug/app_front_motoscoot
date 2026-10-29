
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Hook universel pour gérer les appels asynchrones en production.
 * Gère le chargement, l'erreur, et surtout l'annulation lors du démontage.
 */
export function useAsync<T>(asyncFunction: (signal: AbortSignal) => Promise<T>, immediate = true) {
  const [status, setStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const execute = useCallback(async () => {
    // Annuler la requête précédente si elle existe
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Créer un nouveau contrôleur pour cette requête
    abortControllerRef.current = new AbortController();
    
    setStatus('pending');
    setValue(null);
    setError(null);

    try {
      const response = await asyncFunction(abortControllerRef.current.signal);
      setValue(response);
      setStatus('success');
      return response;
    } catch (e: any) {
      if (e.name === 'AbortError') return; // Silence aborts
      setError(e);
      setStatus('error');
      throw e;
    }
  }, [asyncFunction]);

  useEffect(() => {
    if (immediate) {
      execute();
    }
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [execute, immediate]);

  return { execute, status, value, error };
}
