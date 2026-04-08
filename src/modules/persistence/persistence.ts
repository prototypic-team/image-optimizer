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
}): Promise<void> => {
  const { meta, files } = params;

  for (const id of meta.imageOrder) {
    const file = files[id];
    if (!file) continue;
    if (await idbHasBlob(id)) continue;
    await idbPutBlob(id, await getFileBuf(file));
  }
  await idbPutMeta(meta);

  const activeIds = new Set(meta.imageOrder);
  const allKeys = await idbGetAllBlobKeys();
  for (const key of allKeys) {
    if (!activeIds.has(key)) await idbDeleteBlob(key);
  }
};

export const clearPersistedApp = (): Promise<void> => idbClearAppData();
