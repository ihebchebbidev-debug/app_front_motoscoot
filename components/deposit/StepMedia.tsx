import React, { memo } from 'react';
import { FieldErrors } from 'react-hook-form';
import { MediaUploader } from './MediaUploader';
import { UploadedMedia, ListingFormData } from '../../types/listing';

interface StepMediaProps {
  mediaList: UploadedMedia[];
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  onRetryUpload: (id: string) => void;
  onReorder: (from: number, to: number) => void;
  onSetMain: (index: number) => void;
  onCropDone: (id: string, file: File) => void;
  errors: FieldErrors<ListingFormData>;
}

export const StepMedia = memo(({ mediaList, onImageChange, onRemoveImage, onRetryUpload, onReorder, onSetMain, onCropDone, errors }: StepMediaProps) => {
  return (
    <div>
      <MediaUploader 
        mediaList={mediaList} 
        onImageChange={onImageChange}
        onRemoveImage={onRemoveImage}
        onRetryUpload={onRetryUpload}
        onReorder={onReorder}
        onSetMain={onSetMain}
        onCropDone={onCropDone}
      />
      {errors.images && <p className="text-red-600 text-xs font-bold mt-4">{errors.images.message}</p>}
    </div>
  );
});
