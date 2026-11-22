import React, { useRef, useState } from 'react';
import { CLAUDE_ARTICLE_PROMPT, importArticleJsonLd, type ImportedArticle } from '../../utils/articleJsonLd';

interface Props {
  onImport: (article: ImportedArticle) => void;
  sanitize: (html: string) => string;
}

export default function ArticleJsonLdImport({ onImport, sanitize }: Props) {
  const [source, setSource] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualCopy, setManualCopy] = useState(false);
  const revision = useRef(0);

  async function readFile(file: File) {
    const version = ++revision.current;
    setLoading(true);
    setSource('');
    setError('');
    try {
      const value = await file.text();
      if (version === revision.current) setSource(value);
    } catch {
      if (version === revision.current) setError('Lecture du fichier impossible. Vous pouvez coller son contenu ci-dessous.');
    } finally {
      if (version === revision.current) setLoading(false);
    }
  }

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(CLAUDE_ARTICLE_PROMPT);
      setCopied(true);
    } catch {
      setManualCopy(true);
    }
  }

  function apply() {
    try {
      onImport(importArticleJsonLd(source, sanitize));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import impossible.');
    }
  }

  return (
    <section aria-label="Importer un article JSON-LD" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
      <h3 className="font-bold text-slate-900">Données structurées (JSON-LD)</h3>
      <p className="text-sm text-slate-600">Collez la réponse de Claude ou choisissez un fichier. Vous pourrez relire et modifier l’article dans l’éditeur.</p>
      <button type="button" onClick={copyPrompt} className="text-sm font-bold text-primary-700 underline">
        {copied ? 'Consigne copiée' : 'Copier la consigne pour Claude'}
      </button>
      {manualCopy && <textarea readOnly autoFocus onFocus={e => e.target.select()} value={CLAUDE_ARTICLE_PROMPT}
        aria-label="Consigne à copier pour Claude" rows={6} className="w-full rounded-lg border p-3 text-sm" />}
      <label className="block text-sm font-bold text-slate-700">
        Fichier JSON ou JSON-LD
        <input type="file" accept=".json,.jsonld,.json-ld,application/json,application/ld+json" className="mt-1 block w-full font-normal"
          onChange={e => {
            const file = e.currentTarget.files?.[0];
            e.currentTarget.value = '';
            if (file) void readFile(file);
          }} />
      </label>
      <label className="block text-sm font-bold text-slate-700">
        Contenu JSON-LD
        <textarea rows={8} spellCheck={false} value={source} aria-invalid={!!error}
          placeholder='{"@context":"https://schema.org","@type":"BlogPosting",…}'
          className="mt-1 block w-full rounded-lg border border-slate-200 p-3 font-mono text-sm font-normal"
          onChange={e => { revision.current++; setLoading(false); setSource(e.target.value); setError(''); }} />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="button" disabled={!source.trim() || loading} onClick={apply}
        className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
        {loading ? 'Lecture du fichier…' : 'Remplir l’éditeur'}
      </button>
    </section>
  );
}
