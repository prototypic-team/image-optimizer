import { createStore, produce } from "solid-js/store";

import {
  configKey,
  DEFAULT_CONFIGS,
  optimizeImage,
} from "~/modules/optimizer";
import {
  clearPersistedApp,
  loadPersistedBlob,
  loadPersistedMeta,
  PERSISTENCE_VERSION,
  savePersistedApp,
  type TPersistedAppMeta,
  type TPersistedImageMeta,
} from "~/modules/persistence/persistence";

import type { TFormatResult, TImage, TImagesState } from "./types.d";

const createImageFromFile = (file: File): TImage => ({
  id: crypto.randomUUID(),
  name: file.name.replace(/\.[^.]+$/, ""),
  fileName: file.name,
  extension: file.name.split(".").pop() ?? "",
  weight: {
    original: file.size,
    optimized: undefined,
  },
  file,
  status: "pending",
});

const mimeFromFileName = (fileName: string): string => {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".avif")) return "image/avif";
  return "application/octet-stream";
};

const makeTImage = (
  m: TPersistedImageMeta,
  buf: ArrayBuffer,
  optimizedBufs?: Record<string, ArrayBuffer>
): TImage => {
  let optimized: Record<string, TFormatResult> | undefined;
  if (m.optimized && optimizedBufs) {
    optimized = {};
    for (const [cfgKey, meta] of Object.entries(m.optimized)) {
      const oBuf = optimizedBufs[cfgKey];
      if (!oBuf) continue;
      const blob = new Blob([oBuf], { type: meta.mimeType });
      optimized[cfgKey] = { blob, size: meta.size };
    }
  }

  return {
    id: m.id,
    name: m.name,
    fileName: m.fileName,
    extension: m.extension,
    file: new File([buf], m.fileName, { type: mimeFromFileName(m.fileName) }),
    status: m.status,
    weight: {
      original: m.weight.original,
      optimized: m.weight.optimized,
    },
    optimized,
    error: m.error,
  };
};

const [store, setStore] = createStore<TImagesState>({
  images: {},
  imageOrder: [],
  selectedImageId: undefined,
});

const buildAppMeta = (): TPersistedAppMeta | null => {
  if (store.imageOrder.length === 0) return null;

  const imagesMeta: TPersistedAppMeta["images"] = {};
  for (const id of store.imageOrder) {
    const img = store.images[id];
    if (!img) continue;
    const persistedOptimized = img.optimized
      ? Object.fromEntries(
          Object.entries(img.optimized).map(([k, v]) => [
            k,
            { size: v.size, mimeType: v.blob.type },
          ])
        )
      : undefined;

    imagesMeta[id] = {
      id: img.id,
      name: img.name,
      fileName: img.fileName,
      extension: img.extension,
      status: img.status,
      weight: {
        original: img.weight.original,
        optimized: img.weight.optimized,
      },
      optimized: persistedOptimized,
      error: img.error,
    };
  }

  const selectedImageId =
    store.selectedImageId && imagesMeta[store.selectedImageId]
      ? store.selectedImageId
      : (store.imageOrder[0] ?? null);

  return {
    version: PERSISTENCE_VERSION,
    imageOrder: [...store.imageOrder],
    selectedImageId,
    images: imagesMeta,
  };
};

const writePersistedSnapshot = async (): Promise<void> => {
  if (store.imageOrder.length === 0) {
    await clearPersistedApp();
    return;
  }

  const meta = buildAppMeta();
  if (!meta) return;

  const files: Record<string, File> = {};
  const optimizedBlobs: Record<string, Blob> = {};
  for (const id of store.imageOrder) {
    const img = store.images[id];
    if (!img) continue;
    files[id] = img.file;
    if (img.optimized) {
      for (const [cfgKey, result] of Object.entries(img.optimized)) {
        optimizedBlobs[`${id}:${cfgKey}`] = result.blob;
      }
    }
  }

  await savePersistedApp({ meta, files, optimizedBlobs });
};

let persistTimer: ReturnType<typeof setTimeout> | undefined;
const schedulePersistSnapshot = (): void => {
  if (persistTimer !== undefined) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = undefined;
    writePersistedSnapshot().catch((e) => {
      console.error("Failed to persist app state:", e);
    });
  }, 400);
};

const addImages = (files: File[]) => {
  const existingNames = new Set(
    Object.values(store.images).map((img) => img.fileName)
  );
  const newImages: TImage[] = [];

  for (const file of files) {
    if (existingNames.has(file.name)) continue;
    const image = createImageFromFile(file);
    newImages.push(image);
    existingNames.add(file.name);
  }

  setStore(
    produce((prev) => {
      for (const img of newImages) {
        prev.images[img.id] = img;
        prev.imageOrder.push(img.id);
      }
      if (prev.selectedImageId === null && prev.imageOrder.length > 0) {
        prev.selectedImageId = prev.imageOrder[0];
      }
    })
  );

  for (const img of newImages) {
    processImage(img.id);
  }

  schedulePersistSnapshot();
};

const processImage = async (imageId: string) => {
  const image = store.images[imageId];
  if (!image || image.status !== "pending") return;

  setStore("images", imageId, "status", "processing");

  try {
    const results = await Promise.all(
      DEFAULT_CONFIGS.map(async (cfg) => ({
        key: configKey(cfg),
        result: await optimizeImage(image.file, cfg),
      }))
    );

    const optimized: Record<string, TFormatResult> = {};
    let smallest = Infinity;
    for (const { key, result } of results) {
      optimized[key] = result;
      if (result.size < smallest) smallest = result.size;
    }

    setStore(
      produce((prev) => {
        const img = prev.images[imageId];
        if (img) {
          img.status = "done";
          img.weight.optimized = smallest;
          img.optimized = optimized;
        }
      })
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    setStore(
      produce((prev) => {
        const img = prev.images[imageId];
        if (img) {
          img.status = "error";
          img.error = error;
        }
      })
    );
  }

  schedulePersistSnapshot();
};

const removeImage = (imageId: string) => {
  setStore(
    produce((prev) => {
      delete prev.images[imageId];
      prev.imageOrder = prev.imageOrder.filter((id) => id !== imageId);
      if (prev.selectedImageId === imageId) {
        prev.selectedImageId =
          prev.imageOrder.length > 0 ? prev.imageOrder[0] : undefined;
      }
    })
  );
  schedulePersistSnapshot();
};

const clearAll = () => {
  setStore({ images: {}, imageOrder: [], selectedImageId: undefined });
  schedulePersistSnapshot();
};

const setSelectedImage = (imageId: string | undefined) => {
  setStore("selectedImageId", imageId);
  schedulePersistSnapshot();
};

export const hydrateFromPersistence = async (
  onReady: () => void
): Promise<void> => {
  const meta = await loadPersistedMeta();
  if (!meta) {
    onReady();
    return;
  }

  const images: Record<string, TImage> = {};
  const imageOrder: string[] = [];

  for (const id of meta.imageOrder) {
    const m = meta.images[id];
    if (!m) continue;
    const buf = await loadPersistedBlob(id);
    if (!buf) continue;

    let optimizedBufs: Record<string, ArrayBuffer> | undefined;
    if (m.optimized) {
      optimizedBufs = {};
      for (const cfgKey of Object.keys(m.optimized)) {
        const oBuf = await loadPersistedBlob(`${id}:${cfgKey}`);
        if (oBuf) optimizedBufs[cfgKey] = oBuf;
      }
    }

    images[id] = makeTImage(m, buf, optimizedBufs);
    imageOrder.push(id);
  }

  const selectedImageId =
    meta.selectedImageId && images[meta.selectedImageId]
      ? meta.selectedImageId
      : (imageOrder[0] ?? null);

  setStore({
    images,
    imageOrder,
    selectedImageId,
  });

  onReady();

  for (const id of imageOrder) {
    const img = images[id];
    if (img?.status === "pending") {
      processImage(id);
    }
  }

  schedulePersistSnapshot();
};

export {
  addImages,
  clearAll,
  processImage,
  removeImage,
  setSelectedImage,
  store,
};
