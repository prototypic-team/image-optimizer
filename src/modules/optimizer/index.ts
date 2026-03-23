import { encode as encodeAvif } from "@jsquash/avif";
import { encode as encodeJpeg } from "@jsquash/jpeg";
import { encode as encodePng } from "@jsquash/png";
import { encode as encodeWebp } from "@jsquash/webp";

export type TEncodeFormat = "avif" | "jpeg" | "png" | "webp";

export type TOptimizeResult = {
  blob: Blob;
  size: number;
};

const MAX_DIMENSION = 1920;
const AVIF_QUALITY = 32;
const JPEG_QUALITY = 80;
const WEBP_QUALITY = 80;

async function fileToImageData(
  file: File,
  maxDimension: number
): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (width > maxDimension || height > maxDimension) {
    const scale = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return ctx.getImageData(0, 0, width, height);
}

export const optimizeImage = async (
  file: File,
  format?: TEncodeFormat
): Promise<TOptimizeResult> => {
  const imageData = await fileToImageData(file, MAX_DIMENSION);

  const ext = file.name.toLowerCase().split(".").pop();
  const outputFormat = format ?? (ext === "png" ? "png" : "avif");

  let buffer: ArrayBuffer;
  let mimeType: string;

  switch (outputFormat) {
    case "avif":
      buffer = await encodeAvif(imageData, { cqLevel: AVIF_QUALITY });
      mimeType = "image/avif";
      break;
    case "jpeg":
      buffer = await encodeJpeg(imageData, { quality: JPEG_QUALITY });
      mimeType = "image/jpeg";
      break;
    case "webp":
      buffer = await encodeWebp(imageData, { quality: WEBP_QUALITY });
      mimeType = "image/webp";
      break;
    case "png":
      buffer = await encodePng(imageData);
      mimeType = "image/png";
      break;
    default:
      buffer = await encodeAvif(imageData, { cqLevel: AVIF_QUALITY });
      mimeType = "image/avif";
  }

  const blob = new Blob([buffer], { type: mimeType });

  return {
    blob,
    size: blob.size,
  };
};
