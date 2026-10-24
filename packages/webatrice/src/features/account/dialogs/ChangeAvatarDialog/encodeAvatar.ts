export const MAX_AVATAR_DIMENSION = 1024;
export const MAX_AVATAR_BYTES = 0x1fffff;
const JPEG_QUALITY = 0.75;

export interface Size {
  width: number;
  height: number;
}

export function fitWithin({ width, height }: Size, max: number): Size {
  if (width <= max && height <= max) {
    return { width, height };
  }
  const scale = Math.min(max / width, max / height);
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image could not be decoded'));
    image.src = url;
  });
}

async function renderJpeg(image: CanvasImageSource, { width, height }: Size): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D context unavailable');
  }
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
  if (!blob) {
    throw new Error('JPEG encoding failed');
  }
  return new Uint8Array(await blob.arrayBuffer());
}

export async function encodeAvatar(image: HTMLImageElement): Promise<Uint8Array> {
  let size = fitWithin({ width: image.naturalWidth, height: image.naturalHeight }, MAX_AVATAR_DIMENSION);
  for (;;) {
    const bytes = await renderJpeg(image, size);
    if (bytes.length <= MAX_AVATAR_BYTES || (size.width === 1 && size.height === 1)) {
      return bytes;
    }
    size = { width: Math.max(1, Math.round(size.width / 2)), height: Math.max(1, Math.round(size.height / 2)) };
  }
}
