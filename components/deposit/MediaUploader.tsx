import React, { Suspense, lazy, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Crop as CropIcon, Trash2, RefreshCw, AlertCircle, Loader2, Star } from 'lucide-react';
import {
  DndContext, closestCenter, pointerWithin, MouseSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay, type CollisionDetection,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getOptimizedImageUrl } from '../../utils/urlUtils';
import { gallerySummary } from '../../utils/depositPhotos';
import { UploadedMedia } from '../../types/listing';

// react-easy-crop is only downloaded when a seller opens the crop window.
const PhotoCropDialog = lazy(() => import('./PhotoCropDialog'));

interface MediaUploaderProps {
  mediaList: UploadedMedia[];
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  onRetryUpload: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onSetMain: (index: number) => void;
  onCropDone: (id: string, file: File) => void;
  maxImages?: number;
}

// The main photo is twice as large, so "closest centre" alone misses it:
// the photo under the pointer wins, closest centre for the keyboard.
const collisionDetection: CollisionDetection = (args) => {
  const under = pointerWithin(args);
  return under.length ? under : closestCenter(args);
};

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900';
const iconBtn = `w-11 h-11 flex items-center justify-center rounded-full transition-colors ${focusRing}`;

interface PhotoTileProps {
  media: UploadedMedia;
  index: number;
  total: number;
  onRemove: (index: number) => void;
  onRetry: (id: string) => void;
  onSetMain: (index: number) => void;
  onCrop: (index: number) => void;
}

/**
 * One gallery photo: the photo itself is the drag handle (mouse drag, long
 * press on a phone, Space + arrows on the keyboard); its actions sit in a bar
 * under it so they never cover the picture. The first photo is the main one,
 * shown twice as large.
 */
const PhotoTile: React.FC<PhotoTileProps> = ({ media, index, total, onRemove, onRetry, onSetMain, onCrop }) => {
  const ready = media.status === 'success';
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: media.id, disabled: !ready });
  const isMain = index === 0;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className={`flex flex-col rounded-2xl overflow-hidden bg-card animate-fade-in ${
        isMain ? 'col-span-2 sm:row-span-2 border-2 border-primary-600' : 'border border-neutral-200'
      }`}
    >
      <div
        ref={setActivatorNodeRef}
        {...(ready ? attributes : {})}
        {...(ready ? listeners : {})}
        aria-label={ready ? `Photo ${index + 1} sur ${total}${isMain ? ', photo principale' : ''}. Faites-la glisser pour changer l'ordre.` : undefined}
        className={`relative aspect-[4/3] ${isMain ? 'sm:aspect-auto sm:flex-1 sm:min-h-0' : ''} bg-neutral-100 select-none [-webkit-touch-callout:none] [touch-action:manipulation] ${
          ready ? `cursor-grab active:cursor-grabbing ${focusRing} focus-visible:outline-offset-[-2px]` : ''
        }`}
      >
        <img
          src={getOptimizedImageUrl(media.url, isMain ? 800 : 400, isMain ? 600 : 300, 75)}
          alt=""
          loading="lazy"
          draggable={false}
          className={`absolute inset-0 w-full h-full object-cover pointer-events-none ${ready ? '' : 'opacity-40'}`}
        />

        {isMain && ready && (
          <span className="absolute top-2 left-2 px-2.5 py-1 rounded-full bg-gray-900 text-white text-xs font-bold">
            Principale
          </span>
        )}

        {media.status === 'uploading' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-gray-900 animate-spin" aria-hidden="true" />
          </div>
        )}

        {media.status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-red-50 px-3 text-center">
            <AlertCircle className="w-6 h-6 text-red-700 shrink-0" aria-hidden="true" />
            <p role="alert" className="text-xs font-semibold leading-snug text-red-800 line-clamp-4">{media.error || "L'envoi a échoué."}</p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-1 px-1 h-12 shrink-0">
        {media.status === 'uploading' && (
          <p className="mr-auto pl-2 text-xs font-semibold text-gray-700" role="status">Envoi en cours…</p>
        )}
        {media.status === 'error' && (
          <button
            type="button"
            onClick={() => onRetry(media.id)}
            className={`mr-auto h-11 px-3 flex items-center gap-1.5 rounded-full text-xs font-bold text-gray-900 hover:bg-neutral-100 transition-colors ${focusRing}`}
          >
            <RefreshCw size={15} aria-hidden="true" /> Réessayer
          </button>
        )}
        {ready && !isMain && (
          <button
            type="button"
            onClick={() => onSetMain(index)}
            className={`${iconBtn} text-gray-800 hover:bg-neutral-100`}
            title="Mettre en photo principale"
            aria-label={`Mettre la photo ${index + 1} en photo principale`}
          >
            <Star size={18} />
          </button>
        )}
        {ready && (
          <button
            type="button"
            onClick={() => onCrop(index)}
            className={`${iconBtn} text-gray-800 hover:bg-neutral-100`}
            title="Recadrer"
            aria-label={`Recadrer la photo ${index + 1}`}
          >
            <CropIcon size={18} />
          </button>
        )}
        {media.status !== 'uploading' && (
          <button
            type="button"
            onClick={() => onRemove(index)}
            className={`${iconBtn} text-red-700 hover:bg-red-50`}
            title="Supprimer"
            aria-label={`Supprimer la photo ${index + 1}`}
          >
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </div>
  );
};

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  mediaList,
  onImageChange,
  onRemoveImage,
  onRetryUpload,
  onReorder,
  onSetMain,
  onCropDone,
  maxImages = 10
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cropping, setCropping] = useState<UploadedMedia | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Mouse and touch are separate sensors so a finger can still scroll the
  // page over the photos: a drag only starts after a long press.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleDragStart = (e: DragStartEvent) => setActiveId(String(e.active.id));
  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const from = mediaList.findIndex((m) => m.id === active.id);
    const to = mediaList.findIndex((m) => m.id === over.id);
    if (from >= 0 && to >= 0) onReorder(from, to);
  };
  const activeMedia = activeId ? mediaList.find((m) => m.id === activeId) : undefined;
  const position = (id: unknown) => mediaList.findIndex((m) => m.id === id) + 1;

  const summary = gallerySummary(mediaList);
  const canAdd = mediaList.length < maxImages;

  return (
    <div className="space-y-6">
      <div className="text-center md:text-left">
        <div className="flex items-baseline justify-center md:justify-between gap-3">
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Galerie Photos</h2>
          <span className="text-sm font-semibold text-gray-600 tabular-nums">{mediaList.length} sur {maxImages}</span>
        </div>
        <p className="text-sm text-gray-600 font-medium mt-1">
          {mediaList.length > 1
            ? "La première photo est la photo principale. Faites glisser une photo pour changer l'ordre (appui long sur téléphone)."
            : 'Optimisez vos chances de vente avec de belles photos.'}
        </p>
      </div>

      <input
        type="file"
        ref={fileInputRef}
        onChange={onImageChange}
        className="hidden"
        accept="image/*"
        multiple
      />

      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{
          screenReaderInstructions: { draggable: "Appuyez sur Espace pour saisir la photo, utilisez les flèches pour la déplacer, puis Espace pour la déposer ou Échap pour annuler." },
          announcements: {
            onDragStart: ({ active }) => `Photo ${position(active.id)} saisie.`,
            onDragOver: ({ over }) => (over ? `Position ${position(over.id)}.` : ''),
            onDragEnd: ({ over }) => (over ? `Photo déposée en position ${position(over.id)}.` : 'Déplacement annulé.'),
            onDragCancel: () => 'Déplacement annulé.',
          },
        }}
      >
      <SortableContext items={mediaList.map((m) => m.id)} strategy={rectSortingStrategy}>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 [grid-auto-flow:dense]">
        {mediaList.map((media, idx) => (
          <PhotoTile
            key={media.id}
            media={media}
            index={idx}
            total={mediaList.length}
            onRemove={onRemoveImage}
            onRetry={onRetryUpload}
            onSetMain={onSetMain}
            onCrop={(i) => setCropping(mediaList[i] ?? null)}
          />
        ))}

        {canAdd && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`flex flex-col self-start rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 text-gray-900 hover:border-primary-600 hover:bg-primary-50 transition-colors ${focusRing} ${
              mediaList.length === 0 ? 'col-span-full' : ''
            }`}
          >
            {/* Same shape as a photo tile: a 4:3 area and a 48px bar. */}
            <span className={`flex flex-col items-center justify-center gap-2 w-full ${mediaList.length === 0 ? 'py-10' : 'aspect-[4/3]'}`}>
              <Camera className="w-7 h-7 text-primary-600" aria-hidden="true" />
              <span className="text-sm font-bold">{mediaList.length === 0 ? 'Ajouter des photos' : 'Ajouter'}</span>
            </span>
            <span className="h-12 w-full flex items-center justify-center px-2 text-xs font-medium text-gray-600 text-center">
              {mediaList.length === 0 ? `Jusqu'à ${maxImages} photos · format 4:3 conseillé` : `Encore ${maxImages - mediaList.length}`}
            </span>
          </button>
        )}
      </div>
      </SortableContext>
      <DragOverlay>
        {activeMedia ? (
          <div className="w-40 aspect-[4/3] rounded-2xl overflow-hidden border-2 border-primary-600 shadow-2xl">
            <img src={getOptimizedImageUrl(activeMedia.url, 400, 300, 75)} alt="" className="w-full h-full object-cover" />
          </div>
        ) : null}
      </DragOverlay>
      </DndContext>

      {summary && (
        <p className={`rounded-2xl px-4 py-3 text-sm font-semibold ${summary.failed ? 'bg-red-50 text-red-800' : 'bg-neutral-50 text-gray-800'}`} role="status">
          {summary.text}
        </p>
      )}
      {cropping && (
        <Suspense fallback={createPortal(<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>, document.body)}>
          <PhotoCropDialog
            source={cropping.file ?? cropping.url}
            onCancel={() => setCropping(null)}
            onConfirm={(file) => {
              const id = cropping.id;
              setCropping(null);
              onCropDone(id, file);
            }}
          />
        </Suspense>
      )}
    </div>
  );
};
