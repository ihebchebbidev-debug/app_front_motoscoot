
/**
 * Limite l'exécution d'une fonction à une fois par intervalle donné.
 * Crucial pour les événements 'scroll' et 'resize'.
 * Version améliorée avec trailing execution pour garantir la capture de l'état final.
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  let lastResult: any;
  let lastArgs: any;
  let timeout: any;

  return function(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      lastResult = func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          func.apply(this, lastArgs);
          lastArgs = null;
        }
      }, limit);
    } else {
      lastArgs = args;
    }
    return lastResult;
  };
};

/**
 * Hook utilitaire pour créer un signal d'annulation de requête.
 */
export const createSafeFetch = () => {
  const controller = new AbortController();
  return {
    signal: controller.signal,
    abort: () => controller.abort()
  };
};
