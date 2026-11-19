/**
 * Contacts brought to one importer by its fiches techniques (owner,
 * 2026-11-19): taps on Appel, WhatsApp, Comparer and the quote requests,
 * over 7 / 30 / 90 days, by model, with the requests themselves and a CSV
 * export — what the owner shows a subscribed importer.
 */
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Phone, FileText, Scale, Download, X } from 'lucide-react';
import { siWhatsapp } from 'simple-icons';
import { adminApi, type LeadCounts } from '../../services/adminApi';
import { useToast } from '../../context/ToastContext';
import { displayPhone } from '../../utils/phoneUtils';
import { leadsLine } from '../../utils/importerSubscription';

export { leadsLine };

export const PERIODS = [7, 30, 90] as const;

const WhatsappGlyph = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><path d={siWhatsapp.path} /></svg>
);

const COUNTERS: { key: keyof LeadCounts; label: string; icon: React.ReactNode }[] = [
  { key: 'calls', label: 'Appels', icon: <Phone size={16} aria-hidden="true" /> },
  { key: 'whatsapp_taps', label: 'WhatsApp', icon: <WhatsappGlyph /> },
  { key: 'quotes', label: 'Devis', icon: <FileText size={16} aria-hidden="true" /> },
  { key: 'compares', label: 'Comparaisons', icon: <Scale size={16} aria-hidden="true" /> },
];

const dateFr = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export const ImporterLeadsPanel: React.FC<{ importerId: string; importerName: string; onClose: () => void }> = ({ importerId, importerName, onClose }) => {
  const [days, setDays] = useState<number>(30);
  const [downloading, setDownloading] = useState(false);
  const { addToast } = useToast();
  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin', 'leads', importerId, days],
    queryFn: ({ signal }) => adminApi.getImporterLeads(importerId, days, signal),
    staleTime: 60_000,
  });

  const exportCsv = async () => {
    setDownloading(true);
    try {
      const blob = await adminApi.downloadImporterQuotesCsv(importerId, days);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `devis-${importerName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${days}j.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      addToast(e?.message || 'Export impossible', 'error');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 space-y-5" aria-label={`Statistiques de ${importerName}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-black text-slate-900">Contacts apportés à {importerName}</h3>
          <p className="text-xs text-slate-500">Appuis sur les boutons de ses fiches et demandes de devis envoyées.</p>
        </div>
        <div className="flex items-center gap-2">
          <div role="radiogroup" aria-label="Période" className="inline-flex rounded-lg border border-slate-200 p-0.5">
            {PERIODS.map((d) => (
              <button
                key={d}
                type="button"
                role="radio"
                aria-checked={days === d}
                onClick={() => setDays(d)}
                className={`px-3 py-1.5 rounded-md text-xs font-bold ${days === d ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {d} j
              </button>
            ))}
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Fermer les statistiques"><X size={16} /></button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : isError || !data ? (
        <p className="text-sm text-red-700">Statistiques indisponibles : le serveur n'a peut-être pas encore été mis à jour.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {COUNTERS.map((c) => (
              <div key={c.key} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-600">{c.icon}{c.label}</div>
                <p className="mt-1 text-2xl font-black text-slate-900 tabular-nums">{data.totals[c.key]}</p>
              </div>
            ))}
          </div>

          <div>
            <h4 className="text-sm font-black text-slate-900 mb-2">Par modèle</h4>
            {data.models.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500">
                      <th className="py-2 pr-3 font-bold">Modèle</th>
                      {COUNTERS.map((c) => <th key={c.key} className="py-2 px-2 font-bold text-right">{c.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {data.models.map((m) => (
                      <tr key={m.id} className="border-t border-slate-100">
                        <td className="py-2 pr-3 font-semibold text-slate-900">{m.brand} {m.model}</td>
                        {COUNTERS.map((c) => <td key={c.key} className="py-2 px-2 text-right tabular-nums">{m[c.key]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Aucun contact sur cette période.</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <h4 className="text-sm font-black text-slate-900">Demandes de devis ({data.quotes.length})</h4>
              <button
                type="button"
                onClick={exportCsv}
                disabled={downloading || !data.quotes.length}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Download size={14} aria-hidden="true" />{downloading ? 'Export…' : 'Exporter (CSV)'}
              </button>
            </div>
            {data.quotes.length ? (
              <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl">
                {data.quotes.map((q) => (
                  <li key={q.id} className="p-3 text-sm flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="font-semibold text-slate-900">{q.first_name} {q.last_name}</span>
                    <span className="text-slate-600">{q.brand} {q.model}</span>
                    <a href={`tel:${q.phone}`} className="text-primary-700 font-semibold">{displayPhone(q.phone)}</a>
                    <a href={`mailto:${q.email}`} className="text-primary-700">{q.email}</a>
                    <span className="text-xs text-slate-500 tabular-nums">{dateFr(q.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">Aucune demande sur cette période.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
};

export default ImporterLeadsPanel;
