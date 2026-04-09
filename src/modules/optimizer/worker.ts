import { encode as encodeAvif } from "@jsquash/avif";
import { encode as encodeJpeg } from "@jsquash/jpeg";
import { encode as encodePng } from "@jsquash/png";
import { encode as encodeWebp } from "@jsquash/webp";

type TEncodeFormat = "avif" | "jpeg" | "png" | "webp";

type TOptimizeConfig = {
  format: TEncodeFormat;
  quality?: number;
  maxDimension?: number;
};

const MIME_TYPES: Record<TEncodeFormat, string> = {
  avif: "image/avif",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

async function fileToImageData(
  file: File,
  maxDimension?: number,
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
  config: TOptimizeConfig,
): Promise<ArrayBuffer> {
  const { format, quality } = config;

  switch (format) {
    case "avif":
      return encodeAvif(imageData, { cqLevel: quality });
    case "jpeg":
      return encodeJpeg(imageData, { quality });
    case "webp":
      return encodeWebp(imageData, { quality });
    case "png":
      return encodePng(imageData);
    default:
      throw new Error(`Unknown format: ${format}`);
  }
}

export type WorkerRequest = {
  type: "optimize";
  taskId: string;
  file: File;
  configs: TOptimizeConfig[];
};

export type WorkerResponse =
  | {
      type: "result";
      taskId: string;
      configKey: string;
      buffer: ArrayBuffer;
      size: number;
      mimeType: string;
    }
  | { type: "complete"; taskId: string }
  | { type: "error"; taskId: string; error: string };

const configKey = (cfg: TOptimizeConfig): string =>
  cfg.quality != null ? `${cfg.format}_q${cfg.quality}` : cfg.format;

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const { taskId, file, configs } = e.data;

  try {
    const decodedByMaxDim = new Map<number | undefined, Promise<ImageData>>();

    const getDecoded = (maxDimension?: number) => {
      if (!decodedByMaxDim.has(maxDimension)) {
        decodedByMaxDim.set(maxDimension, fileToImageData(file, maxDimension));
      }
      return decodedByMaxDim.get(maxDimension)!;
    };

    for (const cfg of configs) {
      const imageData = await getDecoded(cfg.maxDimension);
      const buffer = await encodeFormat(imageData, cfg);
      const key = configKey(cfg);
      const mimeType = MIME_TYPES[cfg.format];

      const msg: WorkerResponse = {
        type: "result",
        taskId,
        configKey: key,
        buffer,
        size: buffer.byteLength,
        mimeType,
      };
      self.postMessage(msg, [buffer]);
    }

    const done: WorkerResponse = { type: "complete", taskId };
    self.postMessage(done);
  } catch (err) {
    const error: WorkerResponse = {
      type: "error",
      taskId,
      error: err instanceof Error ? err.message : String(err),
    };
    self.postMessage(error);
  }
};
