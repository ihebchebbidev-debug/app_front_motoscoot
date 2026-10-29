import React, { Component, ErrorInfo, ReactNode } from 'react';
import { monitoring } from '../../utils/monitoring';

interface Props {
  children: ReactNode;
  /** Optional name for log/UI context (e.g. "Listing details"). */
  boundaryName?: string;
  /** Custom fallback. If provided, takes over rendering (used for sub-boundaries). */
  fallback?: (args: { error: Error; reset: () => void }) => ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
  /** True only in dev mode after we decided to display the debug overlay. */
  showDevDetails: boolean;
}

const RECOVERY_FLAG = 'lov_eb_recovery_count';
const RECOVERY_WINDOW_MS = 15_000;
const MAX_RECOVERIES_IN_WINDOW = 3;

/**
 * Production-grade error boundary.
 *
 * Goal: NEVER show the user a scary "something went wrong / reload" screen.
 *
 * Strategy:
 *   1. Catch the React error, log it to telemetry.
 *   2. In production → render NOTHING and silently navigate the user back
 *      (or to the home page) on the next tick. The transition feels like a
 *      normal navigation, not a crash.
 *   3. Guard against an infinite recovery loop: if the same boundary trips
 *      more than N times in a short window, fall back to a hard reload to
 *      the home page (last resort, still no error UI).
 *   4. In development → show the full debug overlay so the team can fix it.
 *   5. Custom `fallback` prop still wins (sub-boundaries can render an
 *      inline empty state instead of bouncing the whole page).
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null, showDevDetails: false };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    monitoring.captureException(error, {
      componentStack: errorInfo.componentStack,
      boundary: this.props.boundaryName || 'Global',
      url: typeof window !== 'undefined' ? window.location.href : '',
    });
  }

  public componentDidUpdate(_prev: Props, prevState: State) {
    if (!prevState.hasError && this.state.hasError) {
      this.scheduleSilentRecovery();
    }
  }

  private reset = () => {
    this.setState({ hasError: false, error: null, showDevDetails: false });
  };

  /**
   * Track how often this boundary has recovered recently.
   * Returns true if we're still under the safety threshold.
   */
  private trackRecovery(): boolean {
    try {
      const raw = sessionStorage.getItem(RECOVERY_FLAG);
      const now = Date.now();
      const entries: number[] = raw ? JSON.parse(raw) : [];
      const recent = entries.filter((t) => now - t < RECOVERY_WINDOW_MS);
      recent.push(now);
      sessionStorage.setItem(RECOVERY_FLAG, JSON.stringify(recent));
      return recent.length <= MAX_RECOVERIES_IN_WINDOW;
    } catch {
      return true;
    }
  }

  private scheduleSilentRecovery() {
    // Custom fallback: the parent component owns the recovery UX, don't touch
    // navigation. (Used by sub-boundaries that render an inline empty state.)
    if (this.props.fallback) return;

    // Dev mode: surface the error visibly so it gets fixed.
    const isDev = (import.meta as any)?.env?.DEV;
    if (isDev) {
      this.setState({ showDevDetails: true });
      return;
    }

    const safe = this.trackRecovery();

    // Run on next tick so React finishes unmounting the broken subtree first.
    window.setTimeout(() => {
      try {
        if (!safe) {
          // Loop guard: too many failures in a row → hard reset to home.
          // Still no error UI shown to the user.
          try { sessionStorage.removeItem(RECOVERY_FLAG); } catch {}
          window.location.replace('/');
          return;
        }

        // Prefer going back if we have history. Otherwise go to home.
        // history.length > 1 is true even for the initial entry in some
        // browsers, so we additionally check the referrer to avoid bouncing
        // the user off the site.
        const sameOriginReferrer =
          document.referrer && document.referrer.startsWith(window.location.origin);

        if (window.history.length > 1 && sameOriginReferrer) {
          // Reset our boundary state BEFORE navigating so the next route
          // mounts fresh.
          this.reset();
          window.history.back();
        } else {
          // No safe history → soft-navigate home.
          this.reset();
          if (window.location.pathname !== '/') {
            window.location.assign('/');
          } else {
            // Already on home but home itself crashed → reload once.
            window.location.reload();
          }
        }
      } catch {
        // Last-resort: full reload to home.
        try { window.location.replace('/'); } catch {}
      }
    }, 0);
  }

  public render() {
    if (!this.state.hasError) return this.props.children;

    // Sub-boundary: render the caller-supplied inline fallback.
    if (this.props.fallback && this.state.error) {
      return this.props.fallback({ error: this.state.error, reset: this.reset });
    }

    // Dev mode: visible debug overlay.
    if (this.state.showDevDetails && this.state.error) {
      const { error } = this.state;
      return (
        <div
          role="alert"
          className="min-h-[40vh] flex items-center justify-center p-6"
        >
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Dev only
              </span>
              <span className="text-xs font-mono text-muted-foreground">
                {this.props.boundaryName || 'Global'}
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-foreground mb-2">
              {error.name}: {error.message}
            </h1>
            <p className="text-xs text-muted-foreground mb-4">
              In production this would silently navigate the user back instead of showing this screen.
            </p>
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={this.reset}
                className="h-9 px-4 rounded-lg bg-primary-600 text-white text-xs font-bold hover:bg-primary-700"
              >
                Reset boundary
              </button>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="h-9 px-4 rounded-lg bg-muted border border-border text-foreground text-xs font-bold"
              >
                Go back
              </button>
            </div>
            {error.stack && (
              <pre className="p-3 bg-muted border border-border rounded-lg text-[11px] font-mono overflow-auto max-h-64 leading-relaxed">
                {error.stack}
              </pre>
            )}
          </div>
        </div>
      );
    }

    // Production: render NOTHING while the silent recovery navigation runs.
    // The user just sees a brief blank moment between two pages — no scary UI.
    return null;
  }
}
