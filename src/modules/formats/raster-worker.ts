import LibImageQuant from "@fe-daily/libimagequant-wasm";
import * as libimagequantWasm from "@fe-daily/libimagequant-wasm/wasm/libimagequant_wasm.js";
import { encode as encodeAvif } from "@jsquash/avif";
import { encode as encodeJpeg } from "@jsquash/jpeg";
import { optimise as optimisePng } from "@jsquash/oxipng";
import { encode as encodeWebp } from "@jsquash/webp";

import type {
  TAvifFormat,
  TEncodableFormat,
  TJpegFormat,
  TPngFormat,
  TWebpFormat,
  TWorkerRequest,
  TWorkerResponse,
} from "Types";

const quantizer = new LibImageQuant({ wasmModule: libimagequantWasm });

const MIME_TYPES: Partial<Record<TEncodableFormat, string>> = {
  avif: "image/avif",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const filesByImageId = new Map<string, File>();
const bitmapsByImageId = new Map<string, ImageBitmap>();
const decodeByImageId = new Map<
  string,
  Map<number | undefined, Promise<ImageData>>
>();

function evictCache(imageId: string) {
  filesByImageId.delete(imageId);
  decodeByImageId.delete(imageId);
  const bm = bitmapsByImageId.get(imageId);
  if (bm) {
    bm.close();
    bitmapsByImageId.delete(imageId);
  }
}

async function bitmapToImageData(
  bitmap: ImageBitmap,
  maxDimension?: number
): Promise<ImageData> {
  let { width, height } = bitmap;

  if (maxDimension && (width > maxDimension || height > maxDimension)) {
    const scale = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");
  ctx.drawImage(bitmap, 0, 0, width, height);
  return ctx.getImageData(0, 0, width, height);
}

async function fileToImageData(
  file: File,
  maxDimension?: number
): Promise<ImageData> {
  const bitmap = await createImageBitmap(file);
  let { width, height } = bitmap;

  if (maxDimension && (width > maxDimension || height > maxDimension)) {
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

const getDecoded = (
  imageId: string,
  maxDimension?: number
): Promise<ImageData> => {
  let byMaxDim = decodeByImageId.get(imageId);
  if (!byMaxDim) {
    byMaxDim = new Map();
    decodeByImageId.set(imageId, byMaxDim);
  }

  let decoded = byMaxDim.get(maxDimension);
  if (!decoded) {
    const bitmap = bitmapsByImageId.get(imageId);
    decoded = bitmap
      ? bitmapToImageData(bitmap, maxDimension)
      : fileToImageData(filesByImageId.get(imageId)!, maxDimension);
    byMaxDim.set(maxDimension, decoded);
  }

  return decoded;
};

async function encodeFormat(
  imageData: ImageData,
  config: TAvifFormat | TJpegFormat | TPngFormat | TWebpFormat
): Promise<ArrayBuffer> {
  switch (config.format) {
    case "avif":
      return encodeAvif(imageData, config);
    case "jpeg":
      return encodeJpeg(imageData, config);
    case "webp":
      return encodeWebp(imageData, config);
    case "png": {
      const { pngBytes } = await quantizer.quantizeImageData(imageData, {
        quality: { min: 0, target: config.quality },
        speed: 3,
        dithering: 1.0,
      });
      return optimisePng(pngBytes.buffer as ArrayBuffer, {
        level: 3,
        optimiseAlpha: true,
      });
    }
    default:
      // @ts-expect-error
      throw new Error(`Unknown format: ${config.format}`);
  }
}

self.onmessage = async (e: MessageEvent<TWorkerRequest>) => {
  switch (e.data.type) {
    case "evict":
      evictCache(e.data.imageId);
      return;

    case "file":
      filesByImageId.set(e.data.imageId, e.data.file);
      return;

    case "bitmap":
      bitmapsByImageId.set(e.data.imageId, e.data.bitmap);
      return;

    case "optimize": {
      try {
        const { taskId, imageId, format } = e.data;

        if (format.format === "original" || format.format === "svg") {
          throw new Error(
            `Raster worker received unexpected format: ${format.format}`
          );
        }

        const file = filesByImageId.get(imageId);
        const hasBitmap = bitmapsByImageId.has(imageId);

        if (!file && !hasBitmap) {
          self.postMessage({
            type: "needsSource",
            taskId,
          } satisfies TWorkerResponse);
          return;
        }

        // SVG source files cannot be decoded via createImageBitmap in a worker.
        // Request a pre-decoded ImageBitmap from the main thread instead.
        const isSvgSource =
          file &&
          (file.type === "image/svg+xml" ||
            file.name.toLowerCase().endsWith(".svg"));

        if (isSvgSource && !hasBitmap) {
          self.postMessage({
            type: "needsBitmap",
            taskId,
          } satisfies TWorkerResponse);
          return;
        }

        const imageData = await getDecoded(imageId, format.maxDimension);
        const buffer = await encodeFormat(imageData, format);
        const mimeType = MIME_TYPES[format.format]!;

        const msg: TWorkerResponse = {
          type: "result",
          taskId,
          buffer,
          size: buffer.byteLength,
          mimeType,
        };
        self.postMessage(msg, [buffer]);
        return;
      } catch (err) {
        self.postMessage({
          type: "error",
          taskId: e.data.taskId,
          error: err instanceof Error ? err.message : String(err),
        } satisfies TWorkerResponse);
        return;
      }
    }
  }
};
