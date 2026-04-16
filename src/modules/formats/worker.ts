import { encode as encodeAvif } from "@jsquash/avif";
import { encode as encodeJpeg } from "@jsquash/jpeg";
import { encode as encodePng } from "@jsquash/png";
import { encode as encodeWebp } from "@jsquash/webp";

import {
  TAvifFormat,
  TEncodableFormat,
  TJpegFormat,
  TPngFormat,
  TWebpFormat,
  TWorkerRequest,
  TWorkerResponse,
} from "Types";

const MIME_TYPES: Record<TEncodableFormat, string> = {
  avif: "image/avif",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const filesByImageId = new Map<string, File>();
const decodeByImageId = new Map<
  string,
  Map<number | undefined, Promise<ImageData>>
>();

const getDecoded = (imageId: string, maxDimension?: number) => {
  const file = filesByImageId.get(imageId);
  if (!file) throw new Error(`No file for image ${imageId}`);

  let byMaxDim = decodeByImageId.get(imageId);
  if (!byMaxDim) {
    byMaxDim = new Map();
    decodeByImageId.set(imageId, byMaxDim);
  }

  let decoded = byMaxDim.get(maxDimension);
  if (!decoded) {
    decoded = fileToImageData(file, maxDimension);
    byMaxDim.set(maxDimension, decoded);
  }

  return decoded;
};

function evictCache(imageId: string) {
  filesByImageId.delete(imageId);
  decodeByImageId.delete(imageId);
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

async function encodeFormat(
  imageData: ImageData,
  config: TAvifFormat | TJpegFormat | TPngFormat | TWebpFormat
): Promise<ArrayBuffer> {
  switch (config.format) {
    case "avif": {
      return encodeAvif(imageData, config);
    }
    case "jpeg":
      return encodeJpeg(imageData, config);
    case "webp":
      return encodeWebp(imageData, config);
    case "png":
      return encodePng(imageData);
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

    case "optimize": {
      try {
        const { taskId, imageId, format } = e.data;

        const file = filesByImageId.get(imageId);
        if (!file) {
          self.postMessage({ type: "needsSource", taskId });
          return;
        }

        if (format.format === "original") {
          throw new Error("Original format not supported");
        }

        const imageData = await getDecoded(imageId, format.maxDimension);
        const buffer = await encodeFormat(imageData, format);
        const mimeType = MIME_TYPES[format.format];

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
        });
        return;
      }
    }
  }
};
