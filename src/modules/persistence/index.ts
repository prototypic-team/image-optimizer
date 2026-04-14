import {
  idbClearAppData,
  idbDeleteBlob,
  idbGetBlob,
  idbGetMeta,
  idbHasBlob,
  idbPutBlob,
  idbPutMeta,
} from "~/modules/persistence/idb";

import { TPersistedAppMeta } from "Types";

export const PERSISTENCE_VERSION = 1 as const;

const fileArrayBufferCache = new WeakMap<File, Promise<ArrayBuffer>>();
const getFileBuf = (file: File): Promise<ArrayBuffer> => {
  const cached = fileArrayBufferCache.get(file);
  if (cached) return cached;
  const p = file.arrayBuffer();
  fileArrayBufferCache.set(file, p);
  return p;
};

const isPersistedAppMeta = (value: unknown): value is TPersistedAppMeta => {
  if (!value || typeof value !== "object") return false;
  const o = value as TPersistedAppMeta;
  return (
    o.version === PERSISTENCE_VERSION &&
    Array.isArray(o.imageOrder) &&
    typeof o.images === "object" &&
    o.images !== null
  );
};

export const loadMeta = async (): Promise<TPersistedAppMeta | null> => {
  try {
    const raw = await idbGetMeta();
    if (!raw || !isPersistedAppMeta(raw)) return null;
    return raw;
  } catch (e) {
    console.warn("Failed to load persisted meta:", e);
    return null;
  }
};

export const loadBlob = async (id: string): Promise<ArrayBuffer | null> => {
  try {
    const buf = await idbGetBlob(id);
    if (!buf) {
      console.warn("Persisted image blob missing for id:", id);
      return null;
    }
    return buf;
  } catch (e) {
    console.warn("Failed to load persisted blob:", id, e);
    return null;
  }
};

export const clearAppData = (): Promise<void> => idbClearAppData();

// -------------------------
// High-level, app-facing API
// -------------------------

let persistMetaChain: Promise<void> = Promise.resolve();

/**
 * Lightweight metadata persistence (serialized, no throttling).
 * Fire-and-forget: schedules work internally and logs failures.
 */
export const saveMeta = (meta: TPersistedAppMeta): void => {
  persistMetaChain = persistMetaChain
    .catch(() => {
      // keep chain alive
    })
    .then(() => idbPutMeta(meta))
    .catch((e) => {
      console.error("Failed to persist meta:", e);
    });
};

let persistFilesChain: Promise<void> = Promise.resolve();

export const removeFiles = (ids: string[]): void => {
  persistFilesChain = persistFilesChain
    .catch(() => {
      // keep chain alive
    })
    .then(async () => {
      for (const id of ids) await idbDeleteBlob(id);
    });
};

/**
 * Heavier file/blob persistence (serialized).
 * Fire-and-forget: enqueues work internally and logs failures.
 */
export const saveFiles = (files: Record<string, File | Blob>): void => {
  persistFilesChain = persistFilesChain
    .catch(() => {
      // keep chain alive
    })
    .then(async () => {
      for (const [id, file] of Object.entries(files)) {
        if (await idbHasBlob(id)) continue;
        await idbPutBlob(
          id,
          file instanceof File
            ? await getFileBuf(file)
            : await file.arrayBuffer()
        );
      }
    })
    .catch((e) => {
      console.error("Failed to persist files:", e);
    });
};
