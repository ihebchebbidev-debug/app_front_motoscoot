/**
 * TechSpecsBatchImport — "Importer un lot" panel of admin › Fiches techniques.
 *
 * The admin picks a lot file (JSON, max 50 fiches) prepared outside the
 * site, checks the preview, then sends it. Every fiche is created as a
 * DRAFT (invisible to visitors and Google) so it can be checked, given
 * photos and published one by one from the list below.
 */
import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { FileUp, X, Check, AlertTriangle } from 'lucide-react';
import { adminApi } from '../../services/adminApi';
import { parseBatch, BATCH_MAX, type BatchParse } from '../../utils/techSpecBatch';

type Result = Awaited<ReturnType<typeof adminApi.importTechSpecs>>;

export const TechSpecsBatchImport: React.FC<{ onClose: () => void; onImported: () => void }> = ({ onClose, onImported }) => {
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState<BatchParse | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const send = useMutation({
    mutationFn: (fiches: unknown[]) => adminApi.importTechSpecs(fiches),
    onSuccess: (r) => { setResult(r); onImported(); },
  });

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    send.reset();
    setParsed(parseBatch(await file.text()));
  };

  const valid = parsed && parsed.ok ? parsed.rows.filter((r) => !r.problem).length : 0;

  return (
    <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4" aria-labelledby="batch-import-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="batch-import-title" className="text-base font-black text-slate-900">Importer un lot de fiches</h3>
          <p className="text-[12px] text-slate-500 mt-0.5">
            Fichier JSON, {BATCH_MAX} fiches maximum. Les fiches sont créées en <strong>brouillon</strong> :
            invisibles pour les visiteurs et Google tant que vous ne les publiez pas.
          </p>
        </div>
        <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100" aria-label="Fermer l’import">
          <X size={16} />
        </button>
      </div>

      <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-300 text-sm font-bold cursor-pointer hover:bg-slate-50">
        <FileUp size={16} /> Choisir le fichier
        <input type="file" accept="application/json,.json" onChange={pick} className="sr-only" />
      </label>
      {fileName && <span className="ml-3 text-[12px] text-slate-600">{fileName}</span>}

      {parsed && 'error' in parsed && (
        <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{parsed.error}</p>
      )}

      {parsed && parsed.ok && !result && (
        <div className="space-y-3">
          <ul className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg text-sm">
            {parsed.rows.map((r) => (
              <li key={r.index} className="flex items-center justify-between gap-3 px-3 py-2">
                <span className="min-w-0">
                  <span className="font-bold text-slate-800">{r.label}</span>
                  {r.category && <span className="ml-2 text-[11px] text-slate-500">{r.category}</span>}
                </span>
                {r.problem ? (
                  <span className="shrink-0 text-[11px] font-bold text-red-700">{r.problem}</span>
                ) : !r.hasPhoto ? (
                  <span className="shrink-0 text-[11px] text-amber-700">Sans photo</span>
                ) : (
                  <Check size={14} className="shrink-0 text-emerald-600" aria-label="Prête" />
                )}
              </li>
            ))}
          </ul>
          {send.isError && (
            <p role="alert" className="text-sm text-red-700">{(send.error as Error)?.message || 'L’import a échoué.'}</p>
          )}
          <button
            type="button"
            disabled={valid === 0 || send.isPending}
            onClick={() => send.mutate(parsed.fiches)}
            className="px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold disabled:opacity-60"
          >
            {send.isPending ? 'Import en cours…' : `Importer ${valid} fiche${valid > 1 ? 's' : ''} en brouillon`}
          </button>
        </div>
      )}

      {result && (
        <div className="space-y-2 text-sm" role="status">
          <p className="font-bold text-emerald-700">
            {result.created.length} fiche{result.created.length > 1 ? 's' : ''} créée{result.created.length > 1 ? 's' : ''} en brouillon.
          </p>
          {result.skipped.length > 0 && (
            <div>
              <p className="font-bold text-slate-700">{result.skipped.length} non importée(s) :</p>
              <ul className="list-disc pl-5 text-slate-600">
                {result.skipped.map((s) => <li key={s.index}>{s.label} — {s.reason}</li>)}
              </ul>
            </div>
          )}
          {result.warnings.length > 0 && (
            <div>
              <p className="font-bold text-amber-700 flex items-center gap-1"><AlertTriangle size={14} /> À compléter :</p>
              <ul className="list-disc pl-5 text-slate-600">
                {result.warnings.map((w, i) => <li key={i}>{w.label} — {w.message}</li>)}
              </ul>
            </div>
          )}
          <p className="text-[12px] text-slate-500">
            Filtrez la liste sur « Brouillons », ajoutez les photos, puis cliquez sur « Publier » fiche par fiche.
          </p>
        </div>
      )}
    </section>
  );
};

export default TechSpecsBatchImport;
