/**
 * DeveloperTab — admin-only "ticket board" between the client and the
 * developer. Admins can:
 *   - Create a ticket (title, description, optional screenshot via paste,
 *     drag-and-drop or file picker).
 *   - Move a ticket through statuses: nouveau → en_cours → done | refusé.
 *   - Delete a ticket they no longer need.
 *
 * Screenshots are uploaded through the existing /uploads/single endpoint
 * (same one every other admin uploader uses), so no new storage plumbing
 * is required server-side.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  Plus, Loader2, Trash2, ImagePlus, X, AlertCircle, ChevronDown, Pencil,
  Code2, Clock, CheckCircle2, XCircle, Sparkles, UploadCloud, ClipboardPaste,
} from 'lucide-react';
import {
  useAdminDevTickets,
  useCreateDevTicket,
  useDeleteDevTicket,
  useUpdateDevTicketStatus,
  useUpdateDevTicket,
} from '../../hooks/useAdmin';
import type { AdminDevTicket, DevTicketStatus } from '../../services/adminApi';
import { uploadsApi } from '../../services/uploadsApi';
import { useToast } from '../../context/ToastContext';
import { compressImage } from '../../utils/imageCompression';
import { Button } from '../ui/Button';

type FilterStatus = DevTicketStatus | 'all';

const STATUS_META: Record<DevTicketStatus, { label: string; icon: React.ElementType; classes: string; dot: string }> = {
  nouveau:  { label: 'Nouveau',  icon: Sparkles,     classes: 'bg-blue-50 text-blue-700 border-blue-200',     dot: 'bg-blue-500' },
  en_cours: { label: 'En cours', icon: Clock,        classes: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  done:     { label: 'Terminé',  icon: CheckCircle2, classes: 'bg-green-50 text-green-700 border-green-200', dot: 'bg-green-500' },
  refuse:   { label: 'Refusé',   icon: XCircle,      classes: 'bg-red-50 text-red-700 border-red-200',       dot: 'bg-red-500' },
};

const STATUS_ORDER: DevTicketStatus[] = ['nouveau', 'en_cours', 'done', 'refuse'];

const FILTERS: { key: FilterStatus; label: string }[] = [
  { key: 'all',      label: 'Tous' },
  { key: 'nouveau',  label: 'Nouveaux' },
  { key: 'en_cours', label: 'En cours' },
  { key: 'done',     label: 'Terminés' },
  { key: 'refuse',   label: 'Refusés' },
];

const MAX_RAW_BYTES = 10 * 1024 * 1024;

export const DeveloperTab: React.FC = () => {
  const [filter, setFilter] = useState<FilterStatus>('all');
  const { data: tickets = [], isLoading } = useAdminDevTickets(filter);
  const createMut = useCreateDevTicket();
  const deleteMut = useDeleteDevTicket();
  const statusMut = useUpdateDevTicketStatus();
  const editMut = useUpdateDevTicket();
  const [editingId, setEditingId] = useState<string | null>(null);
  const { addToast } = useToast();

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const handleFile = async (raw: File | null | undefined) => {
    if (!raw) return;
    if (!raw.type.startsWith('image/')) {
      addToast('Seules les images sont acceptées.', 'error');
      return;
    }
    if (raw.size > MAX_RAW_BYTES) {
      addToast('Image trop volumineuse (max 10 Mo).', 'error');
      return;
    }
    setUploading(true);
    try {
      const compressed = await compressImage(raw);
      const res = await uploadsApi.single(compressed);
      setImageUrl(res.url);
      addToast('Image attachée.', 'success');
    } catch (e: any) {
      addToast(e?.message || "Échec de l'upload.", 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  // Listen for clipboard paste events while the form is open so the user can
  // simply Ctrl+V a screenshot anywhere in the form area.
  useEffect(() => {
    if (!showForm) return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            handleFile(file);
            break;
          }
        }
      }
    };
    const node = formRef.current;
    node?.addEventListener('paste', onPaste as any);
    return () => node?.removeEventListener('paste', onPaste as any);
  }, [showForm]);

  const resetForm = () => {
    setTitle(''); setDescription(''); setImageUrl(''); setShowForm(false); setEditingId(null);
  };

  const handleCreate = async () => {
    if (!title.trim() || !description.trim()) {
      addToast('Titre et description requis.', 'error');
      return;
    }
    try {
      const payload = {
        title: title.trim(),
        description: description.trim(),
        // Send `undefined` (omit field) instead of `null` so the backend
        // destructure `image_url` stays `undefined` and our `image_url || null`
        // fallback handles it cleanly across older payload validators.
        image_url: imageUrl || null,
      };
      if (editingId) await editMut.mutateAsync({ id: editingId, ...payload });
      else await createMut.mutateAsync(payload);
      setFilter('all');
      addToast(editingId ? 'Ticket modifié.' : 'Ticket créé.', 'success');
      resetForm();
    } catch (e: any) {
      // Show the real backend error (status + message + requestId) so a
      // missing migration / pgcrypto issue is visible instead of being
      // hidden behind a generic "Erreur lors de la création.".
      const status = e?.status ? `[${e.status}] ` : '';
      const reqId = e?.requestId ? ` · req ${String(e.requestId).slice(0, 8)}` : '';
      addToast(`${status}${e?.message || 'Erreur lors de la création.'}${reqId}`, 'error');
      // eslint-disable-next-line no-console
      console.error('[DevTicket create]', e);
    }
  };

  const handleStatus = async (id: string, status: DevTicketStatus) => {
    try {
      await statusMut.mutateAsync({ id, status });
    } catch (e: any) {
      addToast(e?.message || 'Erreur', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce ticket ?')) return;
    try {
      await deleteMut.mutateAsync(id);
      addToast('Ticket supprimé.', 'success');
    } catch (e: any) {
      addToast(e?.message || 'Erreur', 'error');
    }
  };

  const counts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = tickets.filter((t) => t.status === s).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
            <Code2 size={22} className="text-primary-600" />
            Développeur — Tickets
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Signalez bugs, demandes ou améliorations. Le développeur traite les tickets ici.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold shadow-md shadow-primary-200 transition-colors"
          >
            <Plus size={16} /> Nouveau ticket
          </button>
        )}
      </div>

      {/* Quick KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STATUS_ORDER.map((s) => {
          const meta = STATUS_META[s];
          const Icon = meta.icon;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`text-left p-3 rounded-xl border transition-all hover:shadow-sm ${
                filter === s ? 'ring-2 ring-primary-300 border-primary-200 bg-primary-50/40' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <Icon size={12} /> {meta.label}
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1">{counts[s] || 0}</div>
            </button>
          );
        })}
      </div>

      {/* Create form */}
      {showForm && (
        <div
          ref={formRef}
          className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-black text-slate-900">{editingId ? 'Modifier le ticket' : 'Nouveau ticket'}</h3>
            <button onClick={resetForm} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
              <X size={16} />
            </button>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Titre *</label>
            <input
              type="text"
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex. Le bouton « Acheter » ne fonctionne pas sur mobile"
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Description *</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez le problème, les étapes pour reproduire, le résultat attendu…"
              rows={5}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-100 outline-none resize-y"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">Capture d'écran (facultatif)</label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />

            {imageUrl ? (
              <div className="relative inline-block">
                <img
                  src={imageUrl}
                  alt="Capture"
                  className="max-h-64 rounded-lg border border-slate-200"
                />
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow"
                  aria-label="Retirer l'image"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
                className="border-2 border-dashed border-slate-300 rounded-xl p-6 text-center hover:border-primary-400 transition-colors"
              >
                {uploading ? (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <Loader2 size={24} className="animate-spin" />
                    <span className="text-xs font-bold">Téléversement…</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-500">
                    <UploadCloud size={28} className="text-slate-400" />
                    <div className="text-xs font-bold text-slate-700">
                      Glisser-déposer une image, coller (<kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px]">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 text-[10px]">V</kbd>)
                    </div>
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
                    >
                      <ImagePlus size={12} /> Ou choisir un fichier
                    </button>
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                      <ClipboardPaste size={10} /> Astuce : Ctrl+V pour coller un screenshot
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              onClick={resetForm}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              onClick={handleCreate}
              disabled={createMut.isPending || editMut.isPending || uploading || !title.trim() || !description.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold disabled:opacity-60"
            >
              {createMut.isPending && <Loader2 size={14} className="animate-spin" />}
              {editingId ? 'Enregistrer le ticket' : 'Créer le ticket'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
              filter === f.key
                ? 'bg-slate-900 text-white border-slate-900'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f.label}
            {f.key !== 'all' && (
              <span className="ml-1.5 opacity-70">{counts[f.key] || 0}</span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div className="py-16 flex items-center justify-center text-slate-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="py-16 text-center bg-white border border-dashed border-slate-200 rounded-2xl">
          <AlertCircle size={32} className="mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-bold text-slate-500">Aucun ticket pour ce filtre.</p>
          <p className="text-xs text-slate-400 mt-1">Créez-en un avec le bouton ci-dessus.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              onStatusChange={(s) => handleStatus(t.id, s)}
              onDelete={() => handleDelete(t.id)}
              onEdit={() => { setEditingId(t.id); setTitle(t.title); setDescription(t.description); setImageUrl(t.image_url || ''); setShowForm(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
              statusPending={statusMut.isPending}
              deletePending={deleteMut.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const TicketCard: React.FC<{
  ticket: AdminDevTicket;
  onStatusChange: (s: DevTicketStatus) => void;
  onDelete: () => void;
  onEdit: () => void;
  statusPending: boolean;
  deletePending: boolean;
}> = ({ ticket, onStatusChange, onDelete, onEdit, statusPending, deletePending }) => {
  const meta = STATUS_META[ticket.status];
  const Icon = meta.icon;
  const author = ticket.creator_full_name || ticket.creator_email || 'Inconnu';
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${meta.classes}`}>
              <Icon size={10} /> {meta.label}
            </span>
            <span className="text-[11px] text-slate-400 font-medium">
              par <span className="text-slate-600">{author}</span> · {new Date(ticket.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </div>
          <h3 className="text-base font-black text-slate-900 mt-1.5 break-words">{ticket.title}</h3>
          <p className="text-sm text-slate-600 mt-1 whitespace-pre-wrap break-words">{ticket.description}</p>

          {ticket.image_url && (
            <a href={ticket.image_url} target="_blank" rel="noopener noreferrer" className="block mt-3">
              <img
                src={ticket.image_url}
                alt="Capture"
                loading="lazy"
                className="max-h-72 rounded-lg border border-slate-200 hover:opacity-90 transition-opacity"
              />
            </a>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="ghost" size="sm" onClick={onEdit} aria-label="Modifier le ticket" title="Modifier le ticket"><Pencil size={14} /></Button>
          <StatusDropdown current={ticket.status} onChange={onStatusChange} disabled={statusPending} />
          <button
            onClick={onDelete}
            disabled={deletePending}
            className="p-2 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
            aria-label="Supprimer"
            title="Supprimer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};

const StatusDropdown: React.FC<{
  current: DevTicketStatus;
  onChange: (s: DevTicketStatus) => void;
  disabled?: boolean;
}> = ({ current, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  const meta = STATUS_META[current];
  const Icon = meta.icon;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold disabled:opacity-50 ${meta.classes}`}
      >
        <Icon size={12} />
        {meta.label}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-30 overflow-hidden">
          {STATUS_ORDER.map((s) => {
            const m = STATUS_META[s];
            const SI = m.icon;
            const isActive = s === current;
            return (
              <button
                key={s}
                onClick={() => { onChange(s); setOpen(false); }}
                disabled={isActive}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-left transition-colors ${
                  isActive ? 'bg-slate-50 text-slate-400 cursor-default' : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
                <SI size={12} />
                {m.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DeveloperTab;
