import { configKey } from "./utils";

import type {
  TFormat,
  TFormatResult,
  TWorkerRequest,
  TWorkerResponse,
} from "Types";

// Decode an SVG to an ImageBitmap on the main thread.
// createImageBitmap(blob) is unreliable for SVGs across browsers; loading
// via an <img> element is the only consistently working path.
// We also inject width/height for viewBox-only SVGs (no intrinsic size).
async function decodeSvgToBitmap(file: File): Promise<ImageBitmap> {
  const text = await file.text();

  const hasSize =
    /\bwidth=["'][^"'%]+["']/.test(text) &&
    /\bheight=["'][^"'%]+["']/.test(text);

  let svgText = text;
  if (!hasSize) {
    let w = 300,
      h = 150;
    const vb = text.match(/\bviewBox=["']([^"']+)["']/);
    if (vb) {
      const p = vb[1]
        .trim()
        .split(/[\s,]+/)
        .map(Number);
      if (p.length === 4) {
        w = p[2]!;
        h = p[3]!;
      }
    }
    svgText = text.replace(
      /<svg(\s[^>]*)?>/i,
      (_, attrs: string = "") => `<svg${attrs} width="${w}" height="${h}">`
    );
  }

  const url = URL.createObjectURL(
    new Blob([svgText], { type: "image/svg+xml" })
  );
  try {
    const img = new Image();
    img.src = url;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("SVG failed to load"));
    });
    return await createImageBitmap(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

type Task = {
  taskId: string;
  resolve: (result: TFormatResult) => void;
  reject: (err: Error) => void;
  imageId: string;
  format: TFormat;
  file: File;
  fileSent: boolean;
  bitmapSent: boolean;
};

type Bridge = {
  optimize(params: {
    imageId: string;
    format: TFormat;
    file: File;
    onSuccess: (result: TFormatResult) => void;
    onError: (err: Error) => void;
  }): void;
  preload(): void;
  rejectByImageId(imageId: string, err: Error): void;
  prioritize(taskId: string): void;
  send(msg: TWorkerRequest, transfer?: Transferable[]): void;
  rejectActive(err: Error): void;
  getActive(): Task | undefined;
};

function createBridge(workerFactory: () => Worker): Bridge {
  let worker: Worker | undefined;
  const queue: Task[] = [];
  let active: Task | undefined;

  function getWorker() {
    if (!worker) worker = workerFactory();
    return worker;
  }

  function pump() {
    if (active) return;
    const next = queue.shift();
    if (!next) return;
    active = next;
    getWorker().postMessage({
      type: "optimize",
      taskId: next.taskId,
      imageId: next.imageId,
      format: next.format,
    } satisfies TWorkerRequest);
  }

  const bridge: Bridge = {
    preload() {
      getWorker();
    },

    send(msg, transfer) {
      if (transfer?.length) getWorker().postMessage(msg, transfer);
      else getWorker().postMessage(msg);
    },

    rejectActive(err) {
      if (!active) return;
      active.reject(err);
      active = undefined;
      pump();
    },

    getActive: () => active,

    optimize({ imageId, format, file, onSuccess, onError }) {
      ensureListener();
      const taskId = `${imageId}:${configKey(format)}`;

      if (queue.find((t) => t.taskId === taskId)) return;

      queue.push({
        taskId,
        imageId,
        format,
        file,
        resolve: onSuccess,
        reject: onError,
        fileSent: false,
        bitmapSent: false,
      });
      pump();
    },

    rejectByImageId(imageId, err) {
      getWorker().postMessage({
        type: "evict",
        imageId,
      } satisfies TWorkerRequest);
      for (let i = queue.length - 1; i >= 0; i--) {
        if (queue[i]?.imageId === imageId) queue.splice(i, 1)[0]?.reject(err);
      }
      if (active?.imageId === imageId) {
        active.reject(err);
        active = undefined;
        pump();
      }
    },

    prioritize(taskId) {
      if (active?.taskId === taskId) return;
      const idx = queue.findIndex((t) => t.taskId === taskId);
      if (idx <= 0) return;
      queue.unshift(queue.splice(idx, 1)[0]!);
    },
  };

  function ensureListener() {
    const w = getWorker();
    if ((w as any).__bridgeListening) return;
    (w as any).__bridgeListening = true;

    w.onmessage = async (e: MessageEvent<TWorkerResponse>) => {
      const msg = e.data;
      if (!active) return;

      switch (msg.type) {
        case "result": {
          if (active.taskId !== msg.taskId) return;
          const blob = new Blob([msg.buffer], { type: msg.mimeType });
          active.resolve({ blob, size: msg.size });
          active = undefined;
          pump();
          break;
        }

        case "needsSource": {
          if (active.fileSent) {
            bridge.rejectActive(new Error("Optimization failed"));
            break;
          }
          active.fileSent = true;
          bridge.send({
            type: "file",
            imageId: active.imageId,
            file: active.file,
          });
          bridge.send({
            type: "optimize",
            taskId: msg.taskId,
            imageId: active.imageId,
            format: active.format,
          });
          break;
        }

        case "needsBitmap": {
          if (active.bitmapSent) {
            bridge.rejectActive(new Error("SVG decode failed"));
            return;
          }

          try {
            const bitmap = await decodeSvgToBitmap(active.file);
            bridge.send(
              {
                type: "bitmap",
                imageId: active.imageId,
                bitmap,
              } satisfies TWorkerRequest,
              [bitmap]
            );
            active.bitmapSent = true;
            bridge.send({
              type: "optimize",
              taskId: active.taskId,
              imageId: active.imageId,
              format: active.format,
            } satisfies TWorkerRequest);
          } catch (err) {
            bridge.rejectActive(
              err instanceof Error ? err : new Error("SVG decode failed")
            );
          }
          break;
        }

        case "error": {
          active.reject(new Error(msg.error));
          active = undefined;
          pump();
          break;
        }
      }
    };
  }

  return bridge;
}

const svgBridge = createBridge(
  () =>
    new Worker(new URL("./svg-worker.ts", import.meta.url), { type: "module" })
);

const rasterBridge = createBridge(
  () =>
    new Worker(new URL("./raster-worker.ts", import.meta.url), {
      type: "module",
    })
);

export function preloadWorkers() {
  rasterBridge.preload();
}

export function rejectImageTasks(
  imageId: string,
  err: Error = new Error("Image removed")
) {
  svgBridge.rejectByImageId(imageId, err);
  rasterBridge.rejectByImageId(imageId, err);
}

export function optimizeInWorker({
  imageId,
  format,
  file,
  onSuccess,
  onError,
}: {
  imageId: string;
  format: TFormat;
  file: File;
  onSuccess: (result: TFormatResult) => void;
  onError: (err: Error) => void;
}): void {
  const bridge = format.format === "svg" ? svgBridge : rasterBridge;
  bridge.optimize({ imageId, format, file, onSuccess, onError });
}

export function prioritizeTask(taskId: string) {
  svgBridge.prioritize(taskId);
  rasterBridge.prioritize(taskId);
}
