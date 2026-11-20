/**
 * « Rapport » of one importer (owner, 2026-11-19): what its fiches brought
 * it — taps on Appel, WhatsApp, Comparer and the quote requests — over 7,
 * 30 or 90 days, to show or send to a subscribed importer.
 *
 * Same side drawer as the visitor detail (AudienceTab VisitorDrawer) and
 * the same StatCard as the Overview, so the admin reads as one tool.
 * Esc closes it, focus goes in and comes back to the « Rapport » button.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Phone, FileText, Scale, Download, X, Copy, Check, Loader2 } from 'lucide-react';
import { siWhatsapp } from 'simple-icons';
import { adminApi } from '../../services/adminApi';
import { useToast } from '../../context/ToastContext';
import { displayPhone } from '../../utils/phoneUtils';
import { StatCard } from './AdminPrimitives';
import { leadsLine, subscriptionStatus, dailyTotals, reportSummary } from '../../utils/importerSubscription';

export { leadsLine };
export const PERIODS = [7, 30, 90] as const;

export const WhatsappIcon: React.FC<{ size?: number; className?: string; strokeWidth?: number }> = ({ size = 20, className }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" className={className}><path d={siWhatsapp.path} /></svg>
);

const dateFr = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

interface Props { importerId: string; importerName: string; onClose: () => void; returnFocus?: HTMLElement | null }

export const ImporterLeadsPanel: React.FC<Props> = ({ importerId, importerName, onClose, returnFocus }) => {
  const [days, setDays] = useState<number>(30);
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { addToast } = useToast();
  const panelRef = useRef<HTMLElement>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'leads', importerId, days],
    queryFn: ({ signal }) => adminApi.getImporterLeads(importerId, days, signal),
    staleTime: 60_000,
    retry: false,
  });

  // Esc closes; focus goes into the drawer and back to its opener.
  useEffect(() => {
    panelRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); returnFocus?.focus?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const daily = useMemo(() => (data ? dailyTotals(data.daily, days) : []), [data, days]);
  const peak = Math.max(1, ...daily.map((d) => d.n));
  const total = data ? data.totals.calls + data.totals.whatsapp_taps + data.totals.quotes + data.totals.compares : 0;
  const status = subscriptionStatus(data?.importer.subscription_until);

  const exportCsv = async () => {
    setDownloading(true);
    try {
      const blob = await adminApi.downloadImporterQuotesCsv(importerId, days);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devis-${importerName.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-')}-${days}j.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      addToast(e?.message || 'Export impossible', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const copySummary = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(reportSummary(importerName, days, data.totals, data.models));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      addToast('Copie impossible : sélectionnez le texte à la main.', 'error');
    }
  };

  const cell = (n: number) => <td className={`py-2.5 px-3 text-right tabular-nums ${n ? 'text-slate-900' : 'text-slate-300'}`}>{n}</td>;

  // Portal at the page root, above the admin header and sidebar (they sit
  // above z-80, so the drawer's own header was hidden under them).
  return createPortal(
    <div className="fixed inset-0 z-[1000] flex" role="presentation">
      <div className="flex-1 bg-black/40" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="importer-report-title"
        className="w-full max-w-3xl h-full bg-slate-50 border-l border-slate-200 overflow-y-auto outline-none"
      >
        <header className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 id="importer-report-title" className="text-lg font-black text-slate-900 truncate">Rapport · {importerName}</h2>
              <p className="mt-0.5 text-[12px] text-slate-500">
                Contacts apportés par ses fiches sur Moto-Scoot.tn
                {data && <> · Abonnement : <span className={status.tone === 'on' ? 'text-emerald-700 font-bold' : status.tone === 'soon' ? 'text-amber-700 font-bold' : 'font-bold'}>{status.label}</span></>}
              </p>
            </div>
            <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Fermer le rapport"><X size={18} /></button>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div role="radiogroup" aria-label="Période" className="inline-flex rounded-lg bg-slate-100 p-0.5">
              {PERIODS.map((d) => (
                <button
                  key={d}
                  type="button"
                  role="radio"
                  aria-checked={days === d}
                  onClick={() => setDays(d)}
                  className={`min-w-[72px] px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${days === d ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                >
                  {d} jours
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={copySummary} disabled={!data} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}{copied ? 'Copié' : 'Copier le résumé'}
              </button>
              <button type="button" onClick={exportCsv} disabled={downloading || !data?.quotes.length} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 disabled:opacity-50">
                <Download size={14} aria-hidden="true" />{downloading ? 'Export…' : 'Demandes (CSV)'}
              </button>
            </div>
          </div>
        </header>

        <div className="p-6 space-y-6">
          {isLoading ? (
            <div className="py-16 flex items-center justify-center text-slate-500"><Loader2 size={22} className="animate-spin" aria-label="Chargement" /></div>
          ) : isError || !data ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              Statistiques indisponibles. Le serveur doit d'abord être mis à jour (PR « demandes de devis, compteurs et abonnement »).
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={Phone} label="Appels" value={data.totals.calls} tone="slate" />
                <StatCard icon={WhatsappIcon as any} label="WhatsApp" value={data.totals.whatsapp_taps} tone="green" />
                <StatCard icon={FileText} label="Demandes de devis" value={data.totals.quotes} tone="orange" />
                <StatCard icon={Scale} label="Comparaisons" value={data.totals.compares} tone="blue" />
              </div>

              <section className="bg-white rounded-xl border border-slate-200 p-5" aria-labelledby="report-daily">
                <div className="flex items-baseline justify-between mb-4">
                  <h3 id="report-daily" className="text-sm font-black text-slate-900">Activité par jour</h3>
                  <span className="text-xs text-slate-500 tabular-nums">{total} contact{total > 1 ? 's' : ''} en {days} jours</span>
                </div>
                {total ? (
                  <div className="flex items-end gap-[2px] h-24" role="img" aria-label={`Contacts par jour sur ${days} jours, au plus ${peak} en un jour`}>
                    {daily.map((d) => (
                      <div key={d.day} className="flex-1 h-full flex items-end" title={`${d.label} : ${d.n} contact${d.n > 1 ? 's' : ''}`}>
                        <div className={`w-full rounded-t-[2px] ${d.n ? 'bg-primary-600' : 'bg-slate-100'}`} style={{ height: d.n ? `${Math.max(6, (d.n / peak) * 100)}%` : '3px' }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Aucun contact sur cette période.</p>
                )}
              </section>

              <section className="bg-white rounded-xl border border-slate-200 overflow-hidden" aria-labelledby="report-models">
                <h3 id="report-models" className="px-5 pt-5 pb-3 text-sm font-black text-slate-900">Par modèle</h3>
                {data.models.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th scope="col" className="py-2.5 px-5 text-left font-bold">Modèle</th>
                          <th scope="col" className="py-2.5 px-3 text-right font-bold">Appels</th>
                          <th scope="col" className="py-2.5 px-3 text-right font-bold">WhatsApp</th>
                          <th scope="col" className="py-2.5 px-3 text-right font-bold">Devis</th>
                          <th scope="col" className="py-2.5 px-3 text-right font-bold">Comp.</th>
                          <th scope="col" className="py-2.5 px-5 text-right font-bold">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.models.map((m) => (
                          <tr key={m.id}>
                            <th scope="row" className="py-2.5 px-5 text-left font-semibold text-slate-900">{m.brand} {m.model}</th>
                            {cell(m.calls)}{cell(m.whatsapp_taps)}{cell(m.quotes)}{cell(m.compares)}
                            <td className="py-2.5 px-5 text-right font-black tabular-nums text-slate-900">{m.calls + m.whatsapp_taps + m.quotes + m.compares}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="px-5 pb-5 text-sm text-slate-500">Aucun contact sur cette période.</p>
                )}
              </section>

              <section className="bg-white rounded-xl border border-slate-200 overflow-hidden" aria-labelledby="report-quotes">
                <h3 id="report-quotes" className="px-5 pt-5 pb-3 text-sm font-black text-slate-900">Demandes de devis <span className="text-slate-400 tabular-nums">({data.quotes.length})</span></h3>
                {data.quotes.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
                        <tr>
                          <th scope="col" className="py-2.5 px-5 text-left font-bold">Date</th>
                          <th scope="col" className="py-2.5 px-3 text-left font-bold">Nom</th>
                          <th scope="col" className="py-2.5 px-3 text-left font-bold">Modèle</th>
                          <th scope="col" className="py-2.5 px-5 text-left font-bold">Contact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.quotes.map((q) => (
                          <tr key={q.id} className="align-top">
                            <td className="py-2.5 px-5 text-slate-500 tabular-nums whitespace-nowrap">{dateFr(q.created_at)}</td>
                            <td className="py-2.5 px-3 font-semibold text-slate-900">{q.first_name} {q.last_name}</td>
                            <td className="py-2.5 px-3 text-slate-700">{q.brand} {q.model}</td>
                            <td className="py-2.5 px-5">
                              <a href={`tel:${q.phone}`} className="block font-semibold text-primary-700 hover:underline tabular-nums">{displayPhone(q.phone)}</a>
                              <a href={`mailto:${q.email}`} className="block text-slate-600 hover:underline break-all">{q.email}</a>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="px-5 pb-5 text-sm text-slate-500">Aucune demande sur cette période.</p>
                )}
              </section>
            </>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
};

export default ImporterLeadsPanel;
