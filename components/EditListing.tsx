import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  ArrowLeft, DollarSign, Save, Image as ImageIcon, Trash2, Plus,
  ExternalLink, Star, GripVertical, Loader2,
} from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext, arrayMove, rectSortingStrategy, useSortable,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { slugify } from '../utils/urlUtils';
import { Input } from './ui/Input';
import { Select } from './ui/Select';
import { Button } from './ui/Button';
import { Skeleton } from './ui/Skeleton';
import { useToast } from '../context/ToastContext';
import { useMyListings, useUpdateListing } from '../hooks/useMyListings';
import {
  useGovernorates, useCities, useBrands, useModelsByBrand, useEquipment,
} from '../hooks/useReferenceData';
import { uploadsApi } from '../services/uploadsApi';
import { useConfirm } from './admin/ConfirmDialog';
import { BasePageProps } from '../types';
import SEO from './common/SEO';

/**
 * Full-page edit screen for a listing the current user owns. Replaces the
 * old in-dashboard modal so editing has its own URL
 * (/mon-compte/annonce/:id/modifier), is bookmarkable, and benefits from
 * native browser back navigation.
 *
 * Sources the raw backend row from useMyListings (the dashboard tab's
 * cache), avoiding an extra round trip in the common case.
 */

const CONDITIONS = ['Neuf', 'Occasion'];
const TYPES = ['Moto', 'Scooter', 'Quad', 'Accessoires', 'Pièces'];

/* ---------- Sortable photo tile ---------- */
interface SortablePhotoProps {
  url: string;
  index: number;
  total: number;
  onRemove: (url: string) => void;
  onSetCover: (idx: number) => void;
}
const SortablePhoto: React.FC<SortablePhotoProps> = ({ url, index, total, onRemove, onSetCover }) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: url });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : undefined,
  };
  const isCover = index === 0;
  return (
    <div ref={setNodeRef} style={style}
      className={`relative group aspect-square rounded-xl overflow-hidden border bg-gray-50 touch-none ${
        isCover ? 'border-orange-500 ring-2 ring-orange-500/30' : 'border-gray-200'
      }`}>
      <img src={url} alt="" className="w-full h-full object-cover pointer-events-none" />
      <div {...attributes} {...listeners}
        className="absolute inset-0 cursor-grab active:cursor-grabbing"
        aria-label={`Photo ${index + 1} sur ${total} — glisser pour réorganiser`} />
      {isCover && (
        <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-orange-500 text-white text-[9px] font-extrabold uppercase tracking-wider shadow pointer-events-none">
          Couverture
        </div>
      )}
      <div className="absolute top-2 left-1/2 -translate-x-1/2 p-1 rounded-full bg-white/80 text-gray-700 shadow opacity-0 group-hover:opacity-100 transition pointer-events-none">
        <GripVertical size={12} />
      </div>
      <button type="button"
        onClick={(e) => { e.stopPropagation(); onRemove(url); }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 focus:opacity-100 transition shadow-lg z-10"
        aria-label="Supprimer la photo" title="Supprimer">
        <Trash2 size={14} />
      </button>
      {!isCover && (
        <button type="button"
          onClick={(e) => { e.stopPropagation(); onSetCover(index); }}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded-full bg-orange-500 text-white text-[9px] font-extrabold uppercase tracking-wider shadow hover:bg-orange-600 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition z-10"
          title="Définir comme couverture">
          <Star size={10} /> Couverture
        </button>
      )}
    </div>
  );
};

/* ---------- Page ---------- */

const EditListing: React.FC<BasePageProps> = ({ onNavigate, listingId }) => {
  const { addToast } = useToast();
  const updateMut = useUpdateListing();
  const { confirm, dialog: confirmDialog } = useConfirm();
  const { data: listings = [], isLoading: listsLoading } = useMyListings();

  // Locate the raw backend row this page is editing.
  const raw = useMemo(() => {
    if (!listingId) return null;
    const found = listings.find((l: any) => String(l.id) === String(listingId));
    return (found as any)?._raw || null;
  }, [listings, listingId]);

  const goBack = useCallback(() => {
    onNavigate?.('dashboard', { tab: 'my-ads' });
  }, [onNavigate]);

  /* ---------- Form state (mounted ALWAYS so hooks stay stable) ---------- */
  const [title, setTitle]               = useState('');
  const [description, setDescription]   = useState('');
  const [type, setType]                 = useState('Moto');
  const [brand, setBrand]               = useState('');
  const [model, setModel]               = useState('');
  const [price, setPrice]               = useState('');
  const [condition, setCondition]       = useState('Occasion');
  const [year, setYear]                 = useState('');
  const [mileage, setMileage]           = useState('');
  const [cc, setCc]                     = useState('');
  const [governorate, setGovernorate]   = useState('');
  const [city, setCity]                 = useState('');
  const [equipment, setEquipment]       = useState<string[]>([]);
  const [images, setImages]             = useState<string[]>([]);
  const [hydrated, setHydrated]         = useState(false);

  // Hydrate form once the raw row arrives.
  useEffect(() => {
    if (!raw || hydrated) return;
    setTitle(raw.title || '');
    setDescription(raw.description || '');
    setType(raw.type || 'Moto');
    setBrand(raw.brand || '');
    setModel(raw.model || '');
    setPrice(String(raw.price ?? ''));
    setCondition(raw.condition || 'Occasion');
    setYear(raw.year != null ? String(raw.year) : '');
    setMileage(raw.mileage != null ? String(raw.mileage) : '');
    setCc(raw.cc != null ? String(raw.cc) : '');
    setGovernorate(raw.governorate || '');
    setCity(raw.city || '');
    setEquipment(Array.isArray(raw.equipment) ? raw.equipment : []);
    setImages(Array.isArray(raw.images) ? raw.images : []);
    setHydrated(true);
  }, [raw, hydrated]);

  // Reference data
  const { data: governorates = [] } = useGovernorates();
  const { data: citiesData = [] }   = useCities(governorate || undefined);
  const { data: brands = [] }       = useBrands(type);
  const { data: models = [] }       = useModelsByBrand(brand);
  const { data: equipmentList = [] } = useEquipment();
  const cityNames = useMemo(() => citiesData.map((c: any) => c.name), [citiesData]);

  /* ---------- Dirty check ---------- */
  const isDirty = useCallback(() => {
    if (!raw) return false;
    return (
      title !== (raw.title || '') ||
      description !== (raw.description || '') ||
      type !== (raw.type || 'Moto') ||
      brand !== (raw.brand || '') ||
      model !== (raw.model || '') ||
      String(price) !== String(raw.price ?? '') ||
      condition !== (raw.condition || 'Occasion') ||
      String(year) !== String(raw.year ?? '') ||
      String(mileage) !== String(raw.mileage ?? '') ||
      String(cc) !== String(raw.cc ?? '') ||
      governorate !== (raw.governorate || '') ||
      city !== (raw.city || '') ||
      JSON.stringify(equipment) !== JSON.stringify(raw.equipment || []) ||
      JSON.stringify(images) !== JSON.stringify(raw.images || [])
    );
  }, [raw, title, description, type, brand, model, price, condition, year, mileage, cc, governorate, city, equipment, images]);

  const guardLeave = async () => {
    if (isDirty()) {
      const ok = await confirm({
        title: 'Quitter sans enregistrer ?',
        message: 'Vos modifications ne sont pas enregistrées et seront perdues.',
        confirmLabel: 'Quitter sans enregistrer',
        cancelLabel: 'Continuer l’édition',
        variant: 'warning',
      });
      if (!ok) return;
    }
    goBack();
  };

  // Warn on browser-level navigation (refresh, close tab) when dirty.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty()) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  /* ---------- Image upload ---------- */
  const [isUploading, setIsUploading] = useState(false);
  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setIsUploading(true);
    try {
      const results = await Promise.allSettled(files.map((f) => uploadsApi.single(f)));
      const newUrls: string[] = [];
      let failed = 0;
      results.forEach((r) => {
        if (r.status === 'fulfilled' && r.value?.url) newUrls.push(r.value.url);
        else failed++;
      });
      if (newUrls.length) {
        setImages((prev) => [...prev, ...newUrls.filter((u) => !prev.includes(u))]);
        addToast(`${newUrls.length} photo(s) ajoutée(s)`, 'success');
      }
      if (failed) addToast(`${failed} photo(s) n'ont pas pu être envoyées.`, 'error');
    } finally {
      setIsUploading(false);
    }
  };
  const handleRemoveImage = useCallback((url: string) => {
    setImages((prev) => prev.filter((u) => u !== url));
  }, []);
  const setAsCover = useCallback((idx: number) => {
    setImages((prev) => {
      if (idx <= 0 || idx >= prev.length) return prev;
      const next = [...prev];
      const [picked] = next.splice(idx, 1);
      next.unshift(picked);
      return next;
    });
  }, []);

  /* ---------- DnD ---------- */
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = e;
    if (over && active.id !== over.id) {
      setImages((items) => {
        const oldIndex = items.indexOf(String(active.id));
        const newIndex = items.indexOf(String(over.id));
        if (oldIndex < 0 || newIndex < 0) return items;
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  /* ---------- Equipment ---------- */
  const toggleEquipment = (name: string) => {
    setEquipment((prev) => prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name]);
  };

  /* ---------- Preview ---------- */
  const previewUrl = useMemo(() => {
    if (!raw) return '#';
    const slug = title || `${brand} ${model}`.trim() || 'annonce';
    return `/annonce/${slugify(slug)}-${raw.id}`;
  }, [title, brand, model, raw]);
  const handlePreview = async () => {
    if (!raw) return;
    if (isDirty()) {
      const ok = await confirm({
        title: 'Aperçu non synchronisé',
        message: "L'aperçu affichera la version actuellement en ligne, pas vos modifications en cours. Continuer ?",
        confirmLabel: 'Ouvrir l’aperçu',
        variant: 'info',
      });
      if (!ok) return;
    }
    window.open(previewUrl, '_blank', 'noopener,noreferrer');
  };

  /* ---------- Save ---------- */
  const toNumberOrNull = (v: string): number | null => {
    if (!v) return null;
    const n = parseFloat(v.replace(/[^0-9.-]/g, ''));
    return isFinite(n) ? n : null;
  };
  const handleSave = async () => {
    if (!raw) return;
    if (!title.trim())  { addToast('Le titre est requis.', 'error'); return; }
    if (!brand.trim())  { addToast('La marque est requise.', 'error'); return; }
    if (!model.trim())  { addToast('Le modèle est requis.', 'error'); return; }
    const desc = description.trim();
    if (desc.length < 20) { addToast('La description doit contenir au moins 20 caractères.', 'error'); return; }
    if (desc.length > 5000) { addToast('La description est trop longue (5000 caractères max).', 'error'); return; }
    const priceNum = toNumberOrNull(price);
    if (priceNum == null || priceNum <= 0) { addToast('Prix invalide.', 'error'); return; }
    if (!governorate.trim()) { addToast('Le gouvernorat est requis.', 'error'); return; }
    if (!city.trim()) { addToast('La ville est requise.', 'error'); return; }
    if (type !== 'Accessoires') {
      if (!/^\d{4}$/.test(String(year))) { addToast('Année requise (4 chiffres).', 'error'); return; }
      if (toNumberOrNull(mileage) == null) { addToast('Kilométrage requis.', 'error'); return; }
      if (toNumberOrNull(cc) == null) { addToast('Cylindrée requise.', 'error'); return; }
    }
    if (images.length === 0) { addToast('Au moins une photo est requise.', 'error'); return; }

    try {
      const updated: any = await updateMut.mutateAsync({
        id: raw.id,
        payload: {
          title: title.trim(),
          description: description.trim(),
          brand: brand.trim(),
          model: model.trim(),
          type,
          price: priceNum,
          condition,
          year: toNumberOrNull(year),
          mileage: toNumberOrNull(mileage),
          cc: toNumberOrNull(cc),
          city: city || null,
          governorate: governorate || null,
          images,
          equipment,
        },
      });
      const wasRequeued = !!(updated as any)?._requeued_for_review;
      addToast(
        wasRequeued
          ? 'Modifications enregistrées. Votre annonce repasse en vérification — elle sera de nouveau visible après validation.'
          : 'Annonce mise à jour avec succès',
        wasRequeued ? 'info' : 'success',
      );
      // Reset dirty so the navigation away doesn't re-prompt.
      setHydrated(false);
      onNavigate?.('dashboard', { tab: 'my-ads' });
    } catch (e: any) {
      addToast(e?.message || 'Mise à jour impossible.', 'error');
    }
  };

  /* ---------- Render ---------- */
  const showLoading = listsLoading && !raw;
  const notFound = !listsLoading && !raw;

  return (
    <div className="min-h-screen bg-muted font-sans pb-24 md:pb-12">
      <SEO title="Modifier mon annonce" />
      <div className="max-w-4xl mx-auto px-4 md:px-8 pt-4 md:pt-8">
        {/* Top bar */}
        <div className="flex items-center gap-3 mb-4 md:mb-6">
          <button
            type="button"
            onClick={guardLeave}
            className="p-2 md:p-2.5 rounded-xl bg-card border border-gray-100 text-gray-700 hover:text-primary-600 shadow-sm transition active:scale-95"
            aria-label="Retour au tableau de bord"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg md:text-2xl font-extrabold text-foreground uppercase truncate">
              Modifier l'annonce
            </h1>
            <p className="text-[11px] md:text-xs text-gray-500 font-medium mt-0.5 hidden sm:block">
              Tous les champs sont modifiables. Les modifications majeures repassent en vérification.
            </p>
          </div>
        </div>

        {showLoading ? (
          <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-6 md:p-8 space-y-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-24 w-full" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" />
            </div>
            <Skeleton className="h-40 w-full" />
          </div>
        ) : notFound ? (
          <div className="bg-card rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <p className="text-gray-600 font-bold mb-4">
              Annonce introuvable ou vous n'y avez pas accès.
            </p>
            <Button variant="primary" onClick={() => onNavigate?.('dashboard', { tab: 'my-ads' })}>
              Retour à mes annonces
            </Button>
          </div>
        ) : (
          <div className="bg-card rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-4 md:px-8 py-5 md:py-7 space-y-5 md:space-y-6">
              {/* Title + Description */}
              <Input label="TITRE" value={title} onChange={(e) => setTitle(e.target.value)} />
              <div>
                <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-3 bg-card border border-gray-200 rounded-xl text-sm font-medium text-foreground outline-none focus:border-orange-500 transition resize-none"
                  placeholder="Décrivez votre annonce…"
                />
              </div>

              {/* Type / Brand / Model */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Select label="CATÉGORIE" value={type} onChange={(e) => setType(e.target.value)}>
                  {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
                <Select label="MARQUE" value={brand} onChange={(e) => { setBrand(e.target.value); setModel(''); }}>
                  <option value="">— Sélectionner —</option>
                  {brands.map((b: any) => <option key={b.id ?? b.name} value={b.name}>{b.name}</option>)}
                  {brand && !brands.some((b: any) => b.name === brand) && (
                    <option value={brand}>{brand}</option>
                  )}
                </Select>
                <Select label="MODÈLE" value={model} onChange={(e) => setModel(e.target.value)} disabled={!brand}>
                  <option value="">— Sélectionner —</option>
                  {models.map((m: any) => <option key={m.id ?? m.name} value={m.name}>{m.name}</option>)}
                  {model && !models.some((m: any) => m.name === model) && (
                    <option value={model}>{model}</option>
                  )}
                </Select>
              </div>

              {/* Year / Mileage / CC */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Input label="ANNÉE" type="number" value={year} onChange={(e) => setYear(e.target.value)} placeholder="2022" />
                <Input label="KILOMÉTRAGE" type="number" value={mileage} onChange={(e) => setMileage(e.target.value)} placeholder="15000" />
                <Input label="CYLINDRÉE (CC)" type="number" value={cc} onChange={(e) => setCc(e.target.value)} placeholder="125" />
              </div>

              {/* Condition + Price */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="ÉTAT" value={condition} onChange={(e) => setCondition(e.target.value)}>
                  {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
                <Input label="PRIX (DT)" type="number" value={price} onChange={(e) => setPrice(e.target.value)} leftIcon={<DollarSign size={18} />} />
              </div>

              {/* Governorate + City */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Select label="GOUVERNORAT" value={governorate} onChange={(e) => { setGovernorate(e.target.value); setCity(''); }}>
                  <option value="">— Sélectionner —</option>
                  {governorates.map((g: any) => <option key={g.id ?? g.name} value={g.name}>{g.name}</option>)}
                  {governorate && !governorates.some((g: any) => g.name === governorate) && (
                    <option value={governorate}>{governorate}</option>
                  )}
                </Select>
                <Select label="VILLE" value={city} onChange={(e) => setCity(e.target.value)} disabled={!governorate}>
                  <option value="">{governorate ? '— Sélectionner —' : '— Choisir un gouvernorat —'}</option>
                  {cityNames.map((c: string) => <option key={c} value={c}>{c}</option>)}
                  {city && !cityNames.includes(city) && <option value={city}>{city}</option>}
                </Select>
              </div>

              {/* Equipment */}
              {equipmentList.length > 0 && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">Équipements</label>
                  <div className="flex flex-wrap gap-2">
                    {equipmentList.map((eq: any) => {
                      const name = typeof eq === 'string' ? eq : eq.name;
                      const active = equipment.includes(name);
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => toggleEquipment(name)}
                          className={`px-3 py-2 rounded-xl text-xs font-bold transition ${
                            active
                              ? 'bg-orange-500 text-white border border-orange-500'
                              : 'bg-gray-50 text-gray-600 border border-gray-200 hover:border-orange-300'
                          }`}
                        >
                          {name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Images — drag & drop */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                    Photos ({images.length})
                  </label>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Glissez pour réorganiser · 1ʳᵉ = couverture
                  </span>
                </div>

                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={handleDragStart}
                  onDragEnd={handleDragEnd}
                  onDragCancel={() => setActiveId(null)}
                >
                  <SortableContext items={images} strategy={rectSortingStrategy}>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                      {images.map((url, idx) => (
                        <SortablePhoto
                          key={url}
                          url={url}
                          index={idx}
                          total={images.length}
                          onRemove={handleRemoveImage}
                          onSetCover={setAsCover}
                        />
                      ))}
                      <label className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center text-gray-400 hover:border-orange-400 hover:text-orange-500 cursor-pointer transition">
                        <Plus size={24} />
                        <span className="text-[11px] font-bold mt-1">AJOUTER</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          multiple
                          className="hidden"
                          onChange={handleFilePick}
                          disabled={isUploading}
                        />
                      </label>
                    </div>
                  </SortableContext>

                  <DragOverlay>
                    {activeId ? (
                      <div className="aspect-square w-32 rounded-xl overflow-hidden border-2 border-orange-500 shadow-2xl ring-4 ring-orange-500/30">
                        <img src={activeId} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : null}
                  </DragOverlay>
                </DndContext>

                {isUploading && (
                  <p className="text-xs text-gray-500 font-medium mt-2 flex items-center gap-2">
                    <ImageIcon size={14} className="animate-pulse" /> Téléversement en cours…
                  </p>
                )}
              </div>
            </div>

            {/* Footer actions */}
            <div className="px-4 md:px-8 py-4 md:py-5 border-t border-gray-100 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between bg-gray-50/40">
              <Button
                variant="ghost"
                onClick={handlePreview}
                leftIcon={<ExternalLink size={16} />}
                title="Ouvre la version actuellement en ligne dans un nouvel onglet"
              >
                Aperçu
              </Button>
              <div className="flex flex-col sm:flex-row gap-3 sm:justify-end">
                <Button variant="ghost" onClick={guardLeave}>Annuler</Button>
                <Button
                  variant="primary"
                  onClick={handleSave}
                  isLoading={updateMut.isPending}
                  disabled={isUploading}
                  leftIcon={!updateMut.isPending ? <Save size={16} /> : <Loader2 size={16} className="animate-spin" />}
                >
                  Enregistrer les modifications
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
      {confirmDialog}
    </div>
  );
};

export default EditListing;
