/**
 * ChaosEngine has been moved out of the production bundle.
 * Re-import it manually from `utils/chaosEngine.dev.ts` ONLY in dev tools
 * if you need stress-testing utilities. Shipping it to prod ballooned the
 * bundle and exposed risky DOM-fuzzing helpers to end users.
 */
export const ChaosEngine = {
  triggerEventStorm: () => Promise.resolve(),
  simulateInputStorm: () => Promise.resolve(),
  saturateMemory: () => Promise.resolve(),
};
