import type {
  TFormat,
  TFormatResult,
  TWorkerRequest,
  TWorkerResponse,
} from "Types";

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
  formats: TFormat[];
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

  w.onmessage = (e: MessageEvent<TWorkerResponse>) => {
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

  const msg: TWorkerRequest = {
    type: "optimize",
    taskId: next.taskId,
    file: next.file,
    formats: next.formats,
  };
  getWorker().postMessage(msg);
}

export function optimizeInWorker(
  taskId: string,
  file: File,
  formats: TFormat[],
  onResult: (configKey: string, result: TFormatResult) => void
): Promise<void> {
  ensureListener();

  return new Promise<void>((resolve, reject) => {
    queue.push({ taskId, file, formats, onResult, resolve, reject });
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
