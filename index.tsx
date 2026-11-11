import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { getClerkPublishableKey } from './utils/clerkConfig';
// SiteGate (password gate) removed — site is now fully public.
// Local Tailwind pipeline (replaces the cdn.tailwindcss.com script that used
// to live in index.html). Importing once here means Vite picks it up and
// PostCSS / autoprefixer process it at build time.
import './src/styles/globals.css';

function PreHydrationReveal() {
  React.useLayoutEffect(() => {
    document.documentElement.removeAttribute('data-pre-hydrate');
  }, []);

  return null;
}

// ---------------------------------------------------------------------------
// One-time forced logout
// ---------------------------------------------------------------------------
// When we change auth-related behaviour (here: admin console layout / routing
// reset), we sometimes need to invalidate every active session exactly once
// so the next visit goes through a fresh login. Bump AUTH_BUST_VERSION to
// trigger a one-time clear for ALL currently-logged-in users (admins included).
// This runs once per browser, before React mounts.
const AUTH_BUST_KEY = 'motoscoot_auth_bust_version';
const AUTH_BUST_VERSION = '2026-04-21-admin-shell';
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = localStorage.getItem(AUTH_BUST_KEY);
    if (stored !== AUTH_BUST_VERSION) {
      // Clear every auth-related key we know about. Token storage uses
      // 'auth_token'; legacy duplicates were 'motoscoot_auth_session' /
      // 'admin_auto_redirected'. Wipe them all so the next render sees an
      // anonymous visitor and the app pops the login modal where appropriate.
      localStorage.removeItem('auth_token');
      localStorage.removeItem('motoscoot_auth_session');
      try { sessionStorage.removeItem('admin_auto_redirected'); } catch {}
      localStorage.setItem(AUTH_BUST_KEY, AUTH_BUST_VERSION);
    }
  }
} catch {
  /* localStorage may be unavailable (private mode) — non-fatal */
}

// Disable native scroll restoration so back/forward always start at the top —
// our router-level effect handles scrolling explicitly.
if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual';
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Live Clerk key is domain-locked. Only use the fallback on moto-scoot.tn;
// previews need an explicit development key or Clerk rejects every request.
const PUBLISHABLE_KEY = getClerkPublishableKey();

const root = ReactDOM.createRoot(rootElement);

const tree = (
  <React.StrictMode>
    <PreHydrationReveal />
    <App />
  </React.StrictMode>
);

// Clerk is no longer wrapped around the whole app: components/auth/ClerkIsland
// mounts it lazily only when sign-in is needed (PageSpeed: ~250 KB saved).
void PUBLISHABLE_KEY;
root.render(tree);

