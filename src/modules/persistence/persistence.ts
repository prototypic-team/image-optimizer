import {
  idbClearAppData,
  idbDeleteBlob,
  idbGetAllBlobKeys,
  idbGetBlob,
  idbGetMeta,
  idbHasBlob,
  idbPutBlob,
  idbPutMeta,
} from "~/modules/persistence/idb";

export const PERSISTENCE_VERSION = 1 as const;

export type TPersistedFormatMeta = {
  size: number;
  mimeType: string;
};

export type TPersistedImageMeta = {
  id: string;
  name: string;
  fileName: string;
  extension: string;
  status: "pending" | "processing" | "done" | "error";
  weight: {
    original: number;
    optimized: number | undefined;
  };
  /** Keyed by configKey (e.g. "avif_q32"). Sizes + mime stored in meta, blobs in IDB under "${id}:${configKey}". */
  optimized?: Record<string, TPersistedFormatMeta>;
  error?: string;
};

export type TPersistedAppMeta = {
  version: typeof PERSISTENCE_VERSION;
  imageOrder: string[];
  selectedImageId: string | null;
  images: Record<string, TPersistedImageMeta>;
};

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

export const loadPersistedMeta =
  async (): Promise<TPersistedAppMeta | null> => {
    try {
      const raw = await idbGetMeta();
      if (!raw || !isPersistedAppMeta(raw)) return null;
      return raw;
    } catch (e) {
      console.warn("Failed to load persisted meta:", e);
      return null;
    }
  };

export const loadPersistedBlob = async (
  id: string
): Promise<ArrayBuffer | null> => {
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

export const savePersistedMeta = async (
  meta: TPersistedAppMeta
): Promise<void> => {
  await idbPutMeta(meta);
};

export const savePersistedApp = async (params: {
  meta: TPersistedAppMeta;
  files: Record<string, File>;
  optimizedBlobs: Record<string, Blob>;
}): Promise<void> => {
  const { meta, files, optimizedBlobs } = params;

  // Save original file blobs
  for (const id of meta.imageOrder) {
    const file = files[id];
    if (!file) continue;
    if (await idbHasBlob(id)) continue;
    await idbPutBlob(id, await getFileBuf(file));
  }

  // Save optimized blobs (keyed as "imageId:configKey")
  for (const [blobKey, blob] of Object.entries(optimizedBlobs)) {
    if (await idbHasBlob(blobKey)) continue;
    await idbPutBlob(blobKey, await blob.arrayBuffer());
  }

  await idbPutMeta(meta);

  // Collect all active keys: original ids + optimized compound keys
  const activeKeys = new Set<string>(meta.imageOrder);
  for (const id of meta.imageOrder) {
    const img = meta.images[id];
    if (img?.optimized) {
      for (const cfgKey of Object.keys(img.optimized)) {
        activeKeys.add(`${id}:${cfgKey}`);
      }
    }
  }

  const allKeys = await idbGetAllBlobKeys();
  for (const key of allKeys) {
    if (!activeKeys.has(key)) await idbDeleteBlob(key);
  }
};

export const clearPersistedApp = (): Promise<void> => idbClearAppData();
