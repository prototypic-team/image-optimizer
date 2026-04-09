import type { TFormatResult } from "~/modules/state/types.d";

import type { WorkerRequest, WorkerResponse } from "./worker";

export type TEncodeFormat = "avif" | "jpeg" | "png" | "webp";

export type TOptimizeConfig = {
  format: TEncodeFormat;
  quality?: number;
  maxDimension?: number;
};

const FORMAT_LABELS: Record<TEncodeFormat, string> = {
  avif: "AVIF",
  jpeg: "JPEG",
  png: "PNG",
  webp: "WebP",
};

export const configKey = (cfg: TOptimizeConfig): string =>
  cfg.quality != null ? `${cfg.format}_q${cfg.quality}` : cfg.format;

export const configLabel = (cfg: TOptimizeConfig): string => {
  const base = FORMAT_LABELS[cfg.format];
  return cfg.quality != null ? `${base} q${cfg.quality}` : base;
};

export const DEFAULT_CONFIGS: TOptimizeConfig[] = [
  { format: "avif", quality: 20 },
  { format: "jpeg", quality: 80 },
  { format: "webp", quality: 80 },
];

let worker: Worker | undefined;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
  }
  return worker;
}

type PendingTask = {
  onResult: (configKey: string, result: TFormatResult) => void;
  resolve: () => void;
  reject: (err: Error) => void;
};

const pending = new Map<string, PendingTask>();

type QueuedTask = {
  taskId: string;
  file: File;
  configs: TOptimizeConfig[];
  onResult: (configKey: string, result: TFormatResult) => void;
  resolve: () => void;
  reject: (err: Error) => void;
};

const queue: QueuedTask[] = [];
let activeTaskId: string | null = null;

function ensureListener() {
  const w = getWorker();
  if ((w as any).__bridgeListening) return;
  (w as any).__bridgeListening = true;

  w.onmessage = (e: MessageEvent<WorkerResponse>) => {
    const msg = e.data;
    const task = pending.get(msg.taskId);
    if (!task) return;

    switch (msg.type) {
      case "result": {
        const blob = new Blob([msg.buffer], { type: msg.mimeType });
        task.onResult(msg.configKey, { blob, size: msg.size });
        break;
      }
      case "complete":
        pending.delete(msg.taskId);
        if (activeTaskId === msg.taskId) activeTaskId = null;
        task.resolve();
        pumpQueue();
        break;
      case "error":
        pending.delete(msg.taskId);
        if (activeTaskId === msg.taskId) activeTaskId = null;
        task.reject(new Error(msg.error));
        pumpQueue();
        break;
    }
  };
}

function pumpQueue() {
  if (activeTaskId != null) return;
  const next = queue.shift();
  if (!next) return;

  activeTaskId = next.taskId;
  pending.set(next.taskId, {
    onResult: next.onResult,
    resolve: next.resolve,
    reject: next.reject,
  });

  const msg: WorkerRequest = {
    type: "optimize",
    taskId: next.taskId,
    file: next.file,
    configs: next.configs,
  };
  getWorker().postMessage(msg);
}

export function optimizeInWorker(
  taskId: string,
  file: File,
  configs: TOptimizeConfig[],
  onResult: (configKey: string, result: TFormatResult) => void
): Promise<void> {
  ensureListener();

  return new Promise<void>((resolve, reject) => {
    queue.push({ taskId, file, configs, onResult, resolve, reject });
    pumpQueue();
  });
}

export function prioritizeTask(taskId: string) {
  if (activeTaskId === taskId) return;
  const idx = queue.findIndex((t) => t.taskId === taskId);
  if (idx <= 0) return;
  const [t] = queue.splice(idx, 1);
  queue.unshift(t);
}
