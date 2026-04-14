import { encode as encodeAvif } from "@jsquash/avif";
import { encode as encodeJpeg } from "@jsquash/jpeg";
import { encode as encodePng } from "@jsquash/png";
import { encode as encodeWebp } from "@jsquash/webp";

import { configKey } from "./utils";

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
  const { taskId, file, formats } = e.data;

  try {
    const decodedByMaxDim = new Map<number | undefined, Promise<ImageData>>();

    const getDecoded = (maxDimension?: number) => {
      if (!decodedByMaxDim.has(maxDimension)) {
        decodedByMaxDim.set(maxDimension, fileToImageData(file, maxDimension));
      }
      return decodedByMaxDim.get(maxDimension)!;
    };

    for (const cfg of formats) {
      if (cfg.format === "original") continue;
      const imageData = await getDecoded(cfg.maxDimension);
      const buffer = await encodeFormat(imageData, cfg);
      const key = configKey(cfg);
      const mimeType = MIME_TYPES[cfg.format];

      const msg: TWorkerResponse = {
        type: "result",
        taskId,
        configKey: key,
        buffer,
        size: buffer.byteLength,
        mimeType,
      };
      self.postMessage(msg, [buffer]);
    }

    const done: TWorkerResponse = { type: "complete", taskId };
    self.postMessage(done);
  } catch (err) {
    const error: TWorkerResponse = {
      type: "error",
      taskId,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(error);
  }
};
