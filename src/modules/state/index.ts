import { createStore, produce, unwrap } from "solid-js/store";

import {
  evictWorkerCache,
  optimizeInWorker,
  prioritizeTask,
} from "~/modules/formats";
import { configKey } from "~/modules/formats/utils";
import {
  clearAppData,
  loadBlob,
  loadMeta,
  PERSISTENCE_VERSION,
  removeFiles,
  saveFiles,
  saveMeta,
} from "~/modules/persistence";

import type {
  TFormat,
  TFormatResult,
  TImage,
  TImagesState,
  TPersistedAppMeta,
  TPersistedImageMeta,
  TViewport,
} from "Types";

export const DEFAULT_FORMATS: TFormat[] = [
  { format: "original" },
  { format: "jpeg", quality: 75 },
  { format: "webp", quality: 75 },
  { format: "avif", quality: 60 },
];

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
  formats: [...DEFAULT_FORMATS],
  optimized: {},
  viewport: { scale: 1, tx: 0, ty: 0 },
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
  const optimized: Record<string, TFormatResult> = {};
  if (m.optimized && optimizedBufs) {
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
    viewport: m.viewport,
    formats: m.formats ?? DEFAULT_FORMATS,
  };
};

export const [store, setStore] = createStore<TImagesState>({
  images: {},
  imageOrder: [],
  selectedImageId: undefined,
});

const buildAppMeta = (): TPersistedAppMeta => {
  const imagesMeta: TPersistedAppMeta["images"] = {};
  const { images, imageOrder, selectedImageId } = unwrap(store);
  for (const id of imageOrder) {
    const img = images[id];
    if (!img) continue;

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
      optimized:
        img.optimized &&
        Object.fromEntries(
          Object.entries(img.optimized).map(([k, v]) => [
            k,
            { size: v.size, mimeType: v.blob.type },
          ])
        ),
      error: img.error,
      viewport: img.viewport,
      formats: img.formats,
    };
  }

  return {
    version: PERSISTENCE_VERSION,
    imageOrder,
    selectedImageId,
    images: imagesMeta,
  };
};

export const addImages = (files: File[]) => {
  const existingNames = new Set(
    Object.values(store.images).map((img) => img.fileName)
  );
  const newImages: TImage[] = [];
  const newFiles: Record<string, File> = {};

  for (const file of files) {
    if (existingNames.has(file.name)) continue;
    const image = createImageFromFile(file);
    newImages.push(image);
    existingNames.add(file.name);
    newFiles[image.id] = file;
  }

  setStore(
    produce((prev) => {
      for (const img of newImages) {
        prev.images[img.id] = img;
        prev.imageOrder.push(img.id);
      }
      if (prev.selectedImageId == undefined && prev.imageOrder.length > 0) {
        prev.selectedImageId = prev.imageOrder[0];
      }
    })
  );

  const selectedId = store.selectedImageId;
  if (selectedId) processImage(selectedId);
  for (const img of newImages) {
    if (img.id === selectedId) continue;
    processImage(img.id);
  }

  saveMeta(buildAppMeta());
  saveFiles(newFiles);
};

const processImage = async (imageId: string) => {
  const image = store.images[imageId];
  if (!image || image.status !== "pending") return;

  setStore("images", imageId, "status", "processing");

  const formats = unwrap(image.formats);
  if (formats.length === 0) {
    setStore("images", imageId, "status", "done");
    saveMeta(buildAppMeta());
    return;
  }

  const files: Record<string, Blob> = {};
  try {
    for (const format of formats) {
      const result = await optimizeInWorker({
        imageId,
        format,
        file: image.file,
      });

      files[`${imageId}:${configKey(format)}`] = result.blob;
    }
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
  saveMeta(buildAppMeta());
  saveFiles(files);
};

export const setFormatSettings = async (
  imageId: string,
  index: number,
  format: TFormat
) => {
  setStore(
    produce((prev) => {
      const img = prev.images[imageId];
      if (!img) return;
      img.formats[index] = format;
    })
  );
  saveMeta(buildAppMeta());

  const img = store.images[imageId];
  if (!img || img.status === "pending" || img.status === "processing") return;
  if (format.format !== "original") {
    try {
      const result = await optimizeInWorker({
        imageId,
        format,
        file: img.file,
      });
      setStore("images", imageId, "optimized", {
        [configKey(format)]: result,
      });
      saveFiles({
        [`${imageId}:${configKey(format)}`]: result.blob,
      });
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      setStore("images", imageId, "error", error);
    }
  }
  saveMeta(buildAppMeta());
};

export const setViewport = (imageId: string, viewport: TViewport) => {
  setStore("images", imageId, "viewport", viewport);
  saveMeta(buildAppMeta());
};

export const removeImage = (imageId: string) => {
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
  saveMeta(buildAppMeta());
  removeFiles([imageId]);
  evictWorkerCache(imageId);
};

export const clearAll = () => {
  const ids = [...store.imageOrder];
  setStore({ images: {}, imageOrder: [], selectedImageId: undefined });
  for (const id of ids) evictWorkerCache(id);
  clearAppData();
};

export const setSelectedImage = (imageId: string | undefined) => {
  setStore("selectedImageId", imageId);
  if (imageId) prioritizeTask(imageId);
  saveMeta(buildAppMeta());
};

export const hydrateFromPersistence = async (
  onReady: () => void
): Promise<void> => {
  let needSave = false;
  const meta = await loadMeta();
  if (!meta) {
    onReady();
    return;
  }

  const images: Record<string, TImage> = {};
  const imageOrder: string[] = [];

  for (const id of meta.imageOrder) {
    const m = meta.images[id];
    if (!m) {
      needSave = true;
      continue;
    }
    const buf = await loadBlob(id);
    if (!buf) {
      continue;
      needSave = true;
    }

    let optimizedBufs: Record<string, ArrayBuffer> | undefined;
    if (m.optimized) {
      optimizedBufs = {};
      for (const cfgKey of Object.keys(m.optimized)) {
        const oBuf = await loadBlob(`${id}:${cfgKey}`);
        if (oBuf) optimizedBufs[cfgKey] = oBuf;
      }
    }

    images[id] = makeTImage(m, buf, optimizedBufs);
    imageOrder.push(id);
  }

  let selectedImageId =
    meta.selectedImageId && images[meta.selectedImageId]
      ? meta.selectedImageId
      : undefined;
  if (!selectedImageId) {
    selectedImageId = imageOrder[0] ?? null;
    needSave = true;
  }

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

  if (needSave) {
    saveMeta(buildAppMeta());
  }
};
