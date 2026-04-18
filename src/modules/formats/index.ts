import { configKey } from "./utils";

import type {
  TFormat,
  TFormatResult,
  TWorkerRequest,
  TWorkerResponse,
} from "Types";

let worker: Worker | undefined;

function getWorker(): MergeWithPriority<
  { postMessage: (message: TWorkerRequest) => void },
  Worker
> {
  if (!worker) {
    worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
  }
  return worker;
}

type Task = {
  taskId: string;
  resolve: (result: TFormatResult) => void;
  reject: (err: Error) => void;
  imageId: string;
  format: TFormat;
  file: File;
  fileSent: boolean;
};

const queue: Task[] = [];
let activeTask: Task | undefined = undefined;

export function rejectImageTasks(
  imageId: string,
  err: Error = new Error("Image removed")
) {
  getWorker().postMessage({ type: "evict", imageId } satisfies TWorkerRequest);

  for (let i = queue.length - 1; i >= 0; i--) {
    if (queue[i]!.imageId === imageId) {
      const [t] = queue.splice(i, 1);
      t!.reject(err);
    }
  }

  if (activeTask?.imageId === imageId) {
    activeTask.reject(err);
    activeTask = undefined;
    pumpQueue();
  }
}

function ensureListener() {
  const w = getWorker();
  if ((w as any).__bridgeListening) return;
  (w as any).__bridgeListening = true;

  w.onmessage = (e: MessageEvent<TWorkerResponse>) => {
    const msg = e.data;
    if (!activeTask) return;

    switch (msg.type) {
      case "result": {
        if (activeTask.taskId !== msg.taskId) return;
        const blob = new Blob([msg.buffer], { type: msg.mimeType });
        activeTask.resolve({ blob, size: msg.size });
        activeTask = undefined;
        pumpQueue();
        break;
      }

      case "needsSource":
        if (activeTask.fileSent) {
          activeTask.reject(new Error("Optimization failed"));
          activeTask = undefined;
          pumpQueue();
          break;
        }

        getWorker().postMessage({
          type: "file",
          imageId: activeTask.imageId,
          file: activeTask.file,
        });
        activeTask.fileSent = true;
        getWorker().postMessage({
          type: "optimize",
          taskId: msg.taskId,
          imageId: activeTask.imageId,
          format: activeTask.format,
        });
        break;

      case "error":
        activeTask.reject(new Error(msg.error));
        activeTask = undefined;
        pumpQueue();
        break;
    }
  };
}

function pumpQueue() {
  if (activeTask) return;
  const next = queue.shift();
  if (!next) return;

  activeTask = next;
  getWorker().postMessage({
    type: "optimize",
    taskId: next.taskId,
    imageId: next.imageId,
    format: next.format,
  });
}

export function optimizeInWorker({
  imageId,
  format,
  file,
}: {
  imageId: string;
  format: TFormat;
  file: File;
}): Promise<TFormatResult> {
  ensureListener();

  const taskId = `${imageId}:${configKey(format)}`;

  return new Promise<TFormatResult>((resolve, reject) => {
    queue.push({
      taskId,
      imageId,
      format,
      file,
      resolve,
      reject,
      fileSent: false,
    });
    pumpQueue();
  });
}

export function prioritizeTask(taskId: string) {
  if (activeTask?.taskId === taskId) return;
  const idx = queue.findIndex((t) => t.taskId === taskId);
  if (idx <= 0) return;
  const [t] = queue.splice(idx, 1);
  queue.unshift(t);
}
