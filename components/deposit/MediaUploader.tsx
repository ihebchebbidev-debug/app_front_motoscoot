import React, { useRef } from 'react';
import { Camera, Crop as CropIcon, Trash2, Image as ImageIcon, CheckCircle2, RefreshCw, AlertCircle, Loader2 } from 'lucide-react';
import { getOptimizedImageUrl } from '../../utils/urlUtils';
import { UploadedMedia } from '../../types/listing';

interface MediaUploaderProps {
  mediaList: UploadedMedia[];
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  onRetryUpload: (id: string) => void;
  onCropImage: (index: number) => void;
  maxImages?: number;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({
  mediaList,
  onImageChange,
  onRemoveImage,
  onRetryUpload,
  onCropImage,
  maxImages = 10
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const successfulCount = mediaList.filter(m => m.status === 'success').length;
  const isUploading = mediaList.some(m => m.status === 'uploading');

  return (
    <div className="space-y-6">
      <div className="text-center md:text-left flex items-center justify-between">
        <div>
          <h2 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight">Galerie Photos</h2>
          <p className="text-sm text-gray-500 font-medium mt-1">Optimisez vos chances de vente avec de belles photos.</p>
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
          <div key={media.id} className="group relative aspect-square rounded-[1.5rem] md:rounded-[2rem] overflow-hidden border border-neutral-100 bg-card shadow-sm animate-fade-in-up">
            <img 
                src={getOptimizedImageUrl(media.url, 300, 300, 70)} 
                alt="" 
                loading="lazy"
                className={`w-full h-full object-cover transition-all duration-500 ${media.status === 'uploading' ? 'blur-sm grayscale opacity-50' : 'group-hover:scale-110'}`} 
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
                 <span className="text-[8px] font-black text-red-600 uppercase tracking-widest mb-3">{media.error || "Échec"}</span>
                 <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => onRetryUpload(media.id)} 
                      className="p-2 bg-card text-primary-600 rounded-full shadow-md hover:bg-primary-50 transition-all active:scale-90"
                      title="Réessayer"
                    >
                      <RefreshCw size={14} />
                    </button>
                    <button 
                      type="button"
                      onClick={() => onRemoveImage(idx)} 
                      className="p-2 bg-card text-red-600 rounded-full shadow-md hover:bg-red-50 transition-all active:scale-90"
                      title="Supprimer"
                    >
                      <Trash2 size={14} />
                    </button>
                 </div>
              </div>
            )}
            
            {/* Actions Standard (Success) */}
            {media.status === 'success' && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 backdrop-blur-[2px]">
                <button 
                  type="button"
                  onClick={() => onCropImage(idx)} 
                  className="p-2 bg-card text-gray-700 rounded-full hover:bg-primary-600 hover:text-white transition-all active:scale-90"
                  title="Recadrer"
                >
                  <CropIcon size={16} />
                </button>
                <button 
                  type="button"
                  onClick={() => onRemoveImage(idx)} 
                  className="p-2 bg-card text-red-600 rounded-full hover:bg-red-600 hover:text-white transition-all active:scale-90"
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}

            {idx === 0 && media.status === 'success' && (
              <div className="absolute top-2 left-2 bg-primary-600 text-white text-[7px] font-black px-2 py-0.5 rounded-full uppercase shadow-lg border border-white/20">
                Principale
              </div>
            )}

            {media.status === 'success' && (
              <div className="absolute top-2 right-2 p-1 bg-emerald-500 text-white rounded-full shadow-lg">
                <CheckCircle2 size={10} />
              </div>
            )}
          </div>
        ))}

        {mediaList.length === 0 && (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={`placeholder-${i}`} className="hidden sm:flex aspect-square rounded-[2rem] border border-neutral-100 bg-neutral-50/50 items-center justify-center opacity-40">
              <ImageIcon size={24} className="text-gray-300" />
            </div>
          ))
        )}
      </div>

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
    </div>
  );
};