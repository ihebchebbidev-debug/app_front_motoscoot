import React, { memo } from 'react';
import { FieldErrors } from 'react-hook-form';
import { MediaUploader } from './MediaUploader';
import { UploadedMedia, ListingFormData } from '../../types/listing';

interface StepMediaProps {
  mediaList: UploadedMedia[];
  onImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: (index: number) => void;
  onRetryUpload: (id: string) => void;
  errors: FieldErrors<ListingFormData>;
}

export const StepMedia = memo(({ mediaList, onImageChange, onRemoveImage, onRetryUpload, errors }: StepMediaProps) => {
  return (
    <div className="animate-fade-in-up">
      <MediaUploader 
        mediaList={mediaList} 
        onImageChange={onImageChange}
        onRemoveImage={onRemoveImage}
        onRetryUpload={onRetryUpload}
        onCropImage={() => {}}
      />
      {errors.images && <p className="text-red-500 text-xs font-bold mt-4">{errors.images.message}</p>}
    </div>
  );
});