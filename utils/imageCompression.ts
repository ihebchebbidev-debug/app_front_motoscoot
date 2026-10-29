/**
 * Client-side image compression using Canvas API.
 * Reduces file size before uploading to avoid server body-size limits
 * (e.g. nginx client_max_body_size).
 */

const MAX_DIMENSION = 1200;
const QUALITY = 0.85;
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB target

/**
 * Compress an image File to a smaller JPEG/WebP blob.
 * If the file is already small enough, returns it unchanged.
 */
export async function compressImage(
  file: File,
  opts?: { maxDimension?: number; quality?: number; maxSize?: number },
): Promise<File> {
  const maxDim = opts?.maxDimension ?? MAX_DIMENSION;
  const quality = opts?.quality ?? QUALITY;
  const maxSize = opts?.maxSize ?? MAX_FILE_SIZE;

  // Skip non-image files
  if (!file.type.startsWith('image/')) return file;

  // Skip if already small
  if (file.size <= maxSize) return file;

  return new Promise<File>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file); // compression didn't help
            return;
          }
          const ext = blob.type === 'image/webp' ? '.webp' : '.jpg';
          const name = file.name.replace(/\.[^.]+$/, '') + ext;
          resolve(new File([blob], name, { type: blob.type }));
        },
        'image/webp',
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback to original
    };

    img.src = url;
  });
}
