/**
 * Telemetry Service - Façade pour le monitoring de production (Sentry, LogRocket, etc.)
 * Permet d'isoler la logique de log du code métier.
 */

import { trackEvent as trackGa4Event } from '../services/analytics';
import { toGa4Event } from './ga4Events';

type LogLevel ='info' | 'warn' | 'error' | 'fatal';

interface EventContext {
  [key: string]: any;
}

class TelemetryService {
  private isProduction = true;

  /**
   * Capture une exception avec son stack trace et un contexte supplémentaire
   */
  public captureException(error: Error, context: EventContext = {}) {
    if (!this.isProduction) {
      // eslint-disable-next-line no-console
      console.error('[Telemetry Exception]', error, context);
      return;
    }

    // TODO: intégration réelle (ex: Sentry.captureException(error, { extra: context }))
    // In production, silently drop until a real provider is wired.
  }

  /**
   * Log un événement utilisateur ou système (Analytics/Audit Trail)
   */
  public trackEvent(name: string, properties: EventContext = {}) {
    if (!this.isProduction) {
      // eslint-disable-next-line no-console
      console.log(`[Telemetry Event: ${name}]`, properties);
      return;
    }

    // Contacts, deposits and shares go to Google Analytics (utils/ga4Events.ts).
    const ga = toGa4Event(name, properties);
    if (ga) trackGa4Event(ga.name, ga.params);
  }

  /**
   * Log un message simple avec un niveau de sévérité
   */
  public captureMessage(message: string, level: LogLevel = 'info', context: EventContext = {}) {
    if (!this.isProduction) {
      // eslint-disable-next-line no-console
      console.log(`[Monitoring-${level.toUpperCase()}]`, message, context);
    }
    // TODO: send to logging provider in production
  }
}

export const monitoring = new TelemetryService();
