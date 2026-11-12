import { analytics } from './posthog';

/**
 * Sends only the structured operational records introduced for PostHog Logs
 * (after cookie consent, see ./posthog.ts). Existing console and application
 * loggers intentionally remain local.
 */
export const posthogLogs = {
  applicationStarted() {
    analytics.log('info', 'web application started', { event: 'web_application_started', runtime: 'browser' });
  },

  apiRequestFailed(method: string, statusCode: number) {
    analytics.log('warn', 'api request failed', { event: 'api_request_failed', method, status_code: statusCode });
  },

  reactRenderFailed(boundary: string) {
    analytics.log('error', 'react render failed', { event: 'react_render_failed', boundary });
  },
};
