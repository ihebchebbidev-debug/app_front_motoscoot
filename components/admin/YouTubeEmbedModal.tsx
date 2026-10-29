/**
 * YouTubeEmbedModal — modal for inserting a YouTube video into the
 * RichTextEditor. Replaces the previous `window.prompt` flow with:
 *   - a real input field (so admins can paste long URLs comfortably),
 *   - live validation feedback as the user types,
 *   - a thumbnail preview pulled from `i.ytimg.com/vi/<id>/hqdefault.jpg`
 *     (no API key required, served by YouTube's CDN),
 *   - an optional full live <iframe> preview button so the admin can confirm
 *     the embed plays before inserting it.
 *
 * The modal stays "dumb" — it doesn't know about the editor. It just
 * validates the URL, shows the preview, and calls `onInsert(videoId)`.
 * The parent (RichTextEditor) builds + sanitizes the embed HTML.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { X, Youtube, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { parseYouTubeId } from './RichTextEditor';

interface Props {
  open: boolean;
  onClose: () => void;
  onInsert: (videoId: string) => void;
}

const EXAMPLE_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

export const YouTubeEmbedModal: React.FC<Props> = ({ open, onClose, onInsert }) => {
  const [url, setUrl] = useState('');
  const [showLive, setShowLive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset state every time the modal re-opens so admins start fresh.
  useEffect(() => {
    if (open) {
      setUrl('');
      setShowLive(false);
      // Defer focus so the modal mount animation doesn't interfere.
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape — standard modal expectation.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const videoId = useMemo(() => parseYouTubeId(url), [url]);
  const isValid = !!videoId;
  const showError = url.trim().length > 0 && !isValid;

  const handleInsert = () => {
    if (!videoId) return;
    onInsert(videoId);
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in"
      onMouseDown={(e) => {
        // Click outside to close, but ignore drags that started inside the dialog.
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-labelledby="yt-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-gradient-to-r from-red-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-red-600 text-white flex items-center justify-center shadow-sm">
              <Youtube size={18} />
            </div>
            <div>
              <h3 id="yt-modal-title" className="text-base font-black text-slate-900 leading-tight">
                Insérer une vidéo YouTube
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Collez l'URL de la vidéo, l'aperçu se génère automatiquement.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Fermer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* URL input */}
          <div>
            <label htmlFor="yt-url" className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1.5">
              URL YouTube
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                id="yt-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && isValid) {
                    e.preventDefault();
                    handleInsert();
                  }
                }}
                placeholder={EXAMPLE_URL}
                className={`w-full px-3.5 py-2.5 pr-10 rounded-xl border text-sm font-medium text-slate-900 placeholder:text-slate-300 transition-all focus:outline-none focus:ring-2 ${
                  showError
                    ? 'border-red-300 focus:border-red-500 focus:ring-red-100'
                    : isValid
                    ? 'border-emerald-300 focus:border-emerald-500 focus:ring-emerald-100'
                    : 'border-slate-200 focus:border-primary-400 focus:ring-primary-100'
                }`}
              />
              {/* Validation icon */}
              {url && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {isValid ? (
                    <CheckCircle2 size={18} className="text-emerald-500" />
                  ) : (
                    <AlertCircle size={18} className="text-red-500" />
                  )}
                </div>
              )}
            </div>
            {showError && (
              <p className="mt-1.5 text-[11px] font-medium text-red-600 flex items-center gap-1">
                <AlertCircle size={12} /> URL invalide. Formats acceptés : youtube.com/watch, youtu.be, shorts.
              </p>
            )}
            {!url && (
              <p className="mt-1.5 text-[11px] text-slate-400">
                Exemple : <span className="font-mono">{EXAMPLE_URL}</span>
              </p>
            )}
          </div>

          {/* Preview */}
          {videoId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
                  Aperçu
                </span>
                <button
                  type="button"
                  onClick={() => setShowLive((v) => !v)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold transition-colors"
                >
                  {showLive ? <EyeOff size={12} /> : <Eye size={12} />}
                  {showLive ? 'Voir miniature' : 'Lecture en direct'}
                </button>
              </div>

              {/* 16:9 responsive container — same ratio as the inserted embed. */}
              <div className="relative w-full rounded-xl overflow-hidden bg-slate-900 shadow-inner" style={{ paddingBottom: '56.25%' }}>
                {showLive ? (
                  <iframe
                    key={videoId}
                    src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                    title="Aperçu YouTube"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="absolute inset-0 w-full h-full border-0"
                  />
                ) : (
                  <>
                    <img
                      key={videoId}
                      // hqdefault always exists for any public video; falls back
                      // server-side if maxresdefault is missing — safer choice.
                      src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                      alt="Miniature YouTube"
                      className="absolute inset-0 w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Play overlay so the thumbnail clearly reads as a video */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                      <div className="w-16 h-16 rounded-full bg-red-600/95 flex items-center justify-center shadow-2xl">
                        <svg viewBox="0 0 24 24" fill="white" className="w-7 h-7 ml-1">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <p className="text-[10px] text-slate-400 font-mono truncate">
                ID : {videoId} · youtube-nocookie.com
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 bg-slate-50 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-200 transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleInsert}
            disabled={!isValid}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-black text-white bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            <Youtube size={15} /> Insérer la vidéo
          </button>
        </div>
      </div>
    </div>
  );
};

export default YouTubeEmbedModal;
