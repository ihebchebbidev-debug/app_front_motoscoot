import React, { Suspense, lazy, useRef, useState } from 'react';
import { Camera, Crop as CropIcon, Trash2, Image as ImageIcon, CheckCircle2, RefreshCw, AlertCircle, Loader2, GripVertical, Star } from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor,
  useSensor, useSensors, DragEndEvent, DragStartEvent, DragOverlay,
} from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, useSortable, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getOptimizedImageUrl } from '../../utils/urlUtils';
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

const tileShape = 'aspect-square rounded-[1.5rem] md:rounded-[2rem] overflow-hidden';
const actionBtn = 'w-9 h-9 flex items-center justify-center rounded-full bg-card/95 shadow-md transition-all active:scale-90';

interface PhotoTileProps {
  media: UploadedMedia;
  index: number;
  total: number;
  onRemove: (index: number) => void;
  onRetry: (id: string) => void;
  onSetMain: (index: number) => void;
  onCrop: (index: number) => void;
}

/** One gallery photo: drag it by its handle, buttons stay visible (touch screens have no hover). */
const PhotoTile: React.FC<PhotoTileProps> = ({ media, index, total, onRemove, onRetry, onSetMain, onCrop }) => {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: media.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };
  const isMain = index === 0;
  const ready = media.status === 'success';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative ${tileShape} border bg-card shadow-sm animate-fade-in-up ${
        isMain && ready ? 'border-primary-500 ring-2 ring-primary-500/30' : 'border-neutral-100'
      }`}
    >
      <img
        src={getOptimizedImageUrl(media.url, 300, 300, 70)}
        alt=""
        loading="lazy"
        draggable={false}
        className={`w-full h-full object-cover transition-all duration-500 ${media.status === 'uploading' ? 'blur-sm grayscale opacity-50' : ''}`}
      />

      {/* Overlay d'uploading */}
      {media.status === 'uploading' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/10 backdrop-blur-[1px]">
           <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
           <span className="mt-2 text-[8px] font-black text-primary-800 uppercase tracking-widest bg-card/80 px-2 py-0.5 rounded-full">Envoi...</span>
        </div>
      )}

      {/* Overlay d'erreur */}
      {media.status === 'error' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50/90 backdrop-blur-[2px]">
           <AlertCircle className="w-8 h-8 text-red-600 mb-1" />
           <span className="text-[8px] font-black text-red-600 uppercase tracking-widest mb-3 px-2 text-center">{media.error || "Échec"}</span>
           <div className="flex gap-2">
              <button 
                type="button"
                onClick={() => onRetry(media.id)} 
                className="p-2 bg-card text-primary-600 rounded-full shadow-md hover:bg-primary-50 transition-all active:scale-90"
                title="Réessayer"
                aria-label="Réessayer l'envoi"
              >
                <RefreshCw size={14} />
              </button>
              <button 
                type="button"
                onClick={() => onRemove(index)} 
                className="p-2 bg-card text-red-600 rounded-full shadow-md hover:bg-red-50 transition-all active:scale-90"
                title="Supprimer"
                aria-label="Supprimer la photo"
              >
                <Trash2 size={14} />
              </button>
           </div>
        </div>
      )}

      {ready && (
        <>
          {isMain ? (
            <div className="absolute top-2 left-2 bg-primary-600 text-white text-[8px] font-black px-2 py-0.5 rounded-full uppercase shadow-lg border border-white/20">
              Principale
            </div>
          ) : (
            <div className="absolute top-2 left-2 p-1 bg-emerald-500 text-white rounded-full shadow-lg">
              <CheckCircle2 size={10} />
            </div>
          )}

          {/* Poignée : glisser pour changer l'ordre (souris, doigt ou clavier : Espace puis flèches) */}
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Photo ${index + 1} sur ${total} : glisser pour changer l'ordre`}
            title="Glisser pour changer l'ordre"
            className="absolute top-1.5 right-1.5 w-9 h-9 flex items-center justify-center rounded-full bg-card/95 text-gray-700 shadow-md cursor-grab active:cursor-grabbing touch-none"
          >
            <GripVertical size={16} />
          </button>

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 p-2 bg-gradient-to-t from-black/50 to-transparent">
            {!isMain && (
              <button
                type="button"
                onClick={() => onSetMain(index)}
                className={`${actionBtn} text-primary-600 hover:bg-primary-600 hover:text-white`}
                title="Mettre en photo principale"
                aria-label="Mettre en photo principale"
              >
                <Star size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={() => onCrop(index)}
              className={`${actionBtn} text-gray-700 hover:bg-primary-600 hover:text-white`}
              title="Recadrer"
              aria-label="Recadrer la photo"
            >
              <CropIcon size={15} />
            </button>
            <button
              type="button"
              onClick={() => onRemove(index)}
              className={`${actionBtn} text-red-600 hover:bg-red-600 hover:text-white`}
              title="Supprimer"
              aria-label="Supprimer la photo"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </>
      )}
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
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

  const successfulCount = mediaList.filter(m => m.status === 'success').length;
  const isUploading = mediaList.some(m => m.status === 'uploading');

  return (
    <div className="space-y-6">
      <div className="text-center md:text-left flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Galerie Photos</h2>
          <p className="text-sm text-gray-500 font-medium mt-1">Optimisez vos chances de vente avec de belles photos.</p>
          {mediaList.length > 1 && (
            <p className="text-xs text-gray-500 font-medium mt-1">
              La 1<sup>re</sup> photo est la photo principale. Glissez <GripVertical size={12} className="inline -mt-0.5" aria-hidden="true" /> pour changer l'ordre, ou touchez <Star size={12} className="inline -mt-0.5" aria-hidden="true" />.
            </p>
          )}
        </div>
        <div className="bg-primary-50 px-4 py-2 rounded-2xl border border-primary-100 hidden sm:block">
          <span className="text-xs font-black text-primary-600 uppercase tracking-widest">{mediaList.length} / {maxImages}</span>
        </div>
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
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveId(null)}
        accessibility={{
          screenReaderInstructions: { draggable: "Appuyez sur Espace pour saisir la photo, utilisez les flèches pour la déplacer, puis Espace pour la déposer ou Échap pour annuler." },
          announcements: {
            onDragStart: ({ active }) => `Photo ${mediaList.findIndex((m) => m.id === active.id) + 1} saisie.`,
            onDragOver: ({ over }) => (over ? `Position ${mediaList.findIndex((m) => m.id === over.id) + 1}.` : ''),
            onDragEnd: ({ over }) => (over ? `Photo déposée en position ${mediaList.findIndex((m) => m.id === over.id) + 1}.` : 'Déplacement annulé.'),
            onDragCancel: () => 'Déplacement annulé.',
          },
        }}
      >
      <SortableContext items={mediaList.map((m) => m.id)} strategy={rectSortingStrategy}>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-6">
        {mediaList.length < maxImages && (
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()} 
            className="flex flex-col items-center justify-center gap-2 aspect-square rounded-[1.5rem] md:rounded-[2rem] border-2 border-dashed border-neutral-200 bg-neutral-50 group hover:border-primary-400 hover:bg-primary-50/30 transition-all shadow-none"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 bg-card rounded-2xl flex items-center justify-center text-primary-600 border border-neutral-100 group-hover:scale-110 transition-transform shadow-sm">
              <Camera className="w-5 h-5 md:w-6 md:h-6" />
            </div>
            <div className="text-center px-2">
              <span className="block text-[12px] font-black text-gray-900 leading-tight">Ajouter</span>
              <span className="hidden xs:block text-[8px] text-gray-400 font-bold uppercase tracking-tighter mt-0.5">4:3 Recommandé</span>
            </div>
          </button>
        )}

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

        {mediaList.length === 0 && (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={`placeholder-${i}`} className="hidden sm:flex aspect-square rounded-[2rem] border border-neutral-100 bg-neutral-50/50 items-center justify-center opacity-40">
              <ImageIcon size={24} className="text-gray-300" />
            </div>
          ))
        )}
      </div>
      </SortableContext>
      <DragOverlay>
        {activeMedia ? (
          <div className={`${tileShape} w-32 border-2 border-primary-500 shadow-2xl ring-4 ring-primary-500/30`}>
            <img src={getOptimizedImageUrl(activeMedia.url, 300, 300, 70)} alt="" className="w-full h-full object-cover" />
          </div>
        ) : null}
      </DragOverlay>
      </DndContext>

      {successfulCount > 0 && (
        <div className="bg-gray-50 p-4 rounded-3xl border border-gray-100 flex items-center gap-4 animate-fade-in-up">
          <div className="w-10 h-10 bg-card rounded-2xl flex items-center justify-center text-primary-600 shadow-sm shrink-0 border border-gray-100">
            <CheckCircle2 size={20} />
          </div>
          <p className="text-xs font-bold text-gray-600">
            <strong>Excellent !</strong> Vous avez {successfulCount} photo{successfulCount > 1 ? 's' : ''} prête{successfulCount > 1 ? 's' : ''}. 
            {isUploading && " Les autres sont en cours de téléchargement..."}
          </p>
        </div>
      )}
      {cropping && (
        <Suspense fallback={<div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80"><Loader2 className="w-8 h-8 text-white animate-spin" /></div>}>
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
