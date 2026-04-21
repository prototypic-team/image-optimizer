import { createStore, produce, unwrap } from "solid-js/store";

import {
  optimizeInWorker,
  prioritizeTask,
  rejectImageTasks,
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

import { toImage } from "../persistence/utils";
import { CancelledError } from "./errors";

import type {
  TFormat,
  TImage,
  TImagesState,
  TPersistedAppMeta,
  TViewport,
} from "Types";

export const DEFAULT_FORMATS: TFormat[] = [
  { format: "original" },
  { format: "jpeg", quality: 75 },
  { format: "webp", quality: 75 },
  { format: "avif", quality: 60 },
];

export const DEFAULT_FORMATS_SVG: TFormat[] = [
  { format: "original" },
  { format: "svg", precision: 2 },
  { format: "webp", quality: 75 },
  { format: "avif", quality: 60 },
];

const isSvgFile = (file: File): boolean =>
  file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");

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
  formats: (isSvgFile(file) ? DEFAULT_FORMATS_SVG : DEFAULT_FORMATS).map(
    (f) => ({ config: f, result: undefined, error: undefined })
  ),
  viewport: { scale: 1, tx: 0, ty: 0 },
});

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
      weight: {
        original: img.weight.original,
        optimized: img.weight.optimized,
      },
      viewport: img.viewport,
      formats: img.formats.map((f) => ({
        config: f.config,
        result: f.result
          ? { size: f.result.size, mimeType: f.result.blob.type }
          : undefined,
        error: f.error,
      })),
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

  const formats = unwrap(image.formats).filter(
    (f) => f.config.format !== "original"
  );
  if (formats.length === 0) return;

  for (const format of formats) {
    if (format.result) continue;

    const key = configKey(format.config);
    optimizeInWorker({
      imageId,
      format: format.config,
      file: image.file,
      onSuccess: (result) => {
        setStore(
          "images",
          imageId,
          "formats",
          produce((prev) => {
            const index = prev.findIndex((f) => configKey(f.config) === key);
            if (index !== -1) prev[index].result = result;
          })
        );
        saveMeta(buildAppMeta());
        saveFiles({ [`${imageId}:${key}`]: result.blob });
      },
      onError: (err) => {
        const error = err instanceof Error ? err.message : String(err);
        setStore(
          "images",
          imageId,
          "formats",
          produce((prev) => {
            const index = prev.findIndex((f) => configKey(f.config) === key);
            if (index !== -1) prev[index].error = error;
          })
        );
        saveMeta(buildAppMeta());
      },
    });
  }
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
      img.formats[index] = {
        config: format,
        result: undefined,
        error: undefined,
      };
    })
  );
  saveMeta(buildAppMeta());
  processImage(imageId);
};

export const updateViewport = (imageId: string, viewport: TViewport) => {
  setStore("images", imageId, "viewport", viewport);
};

export const setViewport = (imageId: string, viewport: TViewport) => {
  setStore("images", imageId, "viewport", viewport);
  saveMeta(buildAppMeta());
};

/**
 * Copies format settings from the selected image to every other image, then
 * encodes any formats that are missing. Skips encoding when an image already
 * has an optimized blob for that config key.
 */
export const copyFormats = () => {
  const selectedId = store.selectedImageId;
  if (!selectedId) return;

  const source = store.images[selectedId];
  if (!source) return;

  const targetFormats = structuredClone(unwrap(source.formats));

  const targetIds = store.imageOrder.filter((id) => id !== selectedId);
  if (targetIds.length === 0) return;

  setStore(
    produce((prev) => {
      for (const imageId of targetIds) {
        const img = prev.images[imageId];
        if (!img) continue;

        for (let i = 0; i < img.formats.length; i++) {
          const targetFormat = targetFormats[i];
          const format = img.formats[i];

          if (!targetFormat) continue;
          if (!format) continue;

          const formatMatch =
            format.config.format === targetFormat.config.format;
          const qualityMatch =
            "quality" in targetFormat.config &&
            "quality" in format.config &&
            targetFormat.config.quality === format.config.quality;
          const precisionMatch =
            "precision" in targetFormat.config &&
            "precision" in format.config &&
            targetFormat.config.precision === format.config.precision;

          if (format.config.format === "original" && formatMatch) continue;
          if (formatMatch && (qualityMatch || precisionMatch)) continue;
          if (
            targetFormat.config.format === "svg" &&
            img.extension.toLowerCase() !== "svg"
          )
            continue;

          prev.images[imageId].formats[i] = {
            config: targetFormat.config,
            result: undefined,
            error: undefined,
          };
        }
      }
    })
  );
  saveMeta(buildAppMeta());
  for (const imageId of targetIds) {
    processImage(imageId);
  }
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
  rejectImageTasks(imageId, new CancelledError());
};

export const clearAll = () => {
  const ids = [...store.imageOrder];
  setStore({ images: {}, imageOrder: [], selectedImageId: undefined });
  for (const id of ids) rejectImageTasks(id, new CancelledError());
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
    if (m.formats) {
      optimizedBufs = {};
      for (const format of m.formats) {
        const key = configKey(format.config);
        const oBuf = await loadBlob(`${id}:${key}`);
        if (oBuf) optimizedBufs[key] = oBuf;
      }
    }

    images[id] = toImage(m, buf, optimizedBufs);
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
    processImage(id);
  }

  if (needSave) {
    saveMeta(buildAppMeta());
  }
};
