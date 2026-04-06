import { createStore, produce } from "solid-js/store";

import { optimizeImage } from "~/modules/optimizer";

import type { TImage, TImagesState } from "./types.d";

const createImageFromFile = (file: File): TImage => ({
  id: crypto.randomUUID(),
  name: file.name.replace(/\.[^.]+$/, ""),
  fileName: file.name,
  size: file.size,
  file,
  status: "pending",
});

const [store, setStore] = createStore<TImagesState>({
  images: {},
  imageOrder: [],
  selectedImageId: null,
});

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
      // Select first image when adding (or first of all if none selected)
      if (prev.selectedImageId === null && prev.imageOrder.length > 0) {
        prev.selectedImageId = prev.imageOrder[0];
      }
    })
  );

  for (const img of newImages) {
    processImage(img.id);
  }
};

const processImage = async (imageId: string) => {
  const image = store.images[imageId];
  if (!image || image.status === "processing") return;

  setStore("images", imageId, "status", "processing");

  try {
    const result = await optimizeImage(image.file);

    setStore(
      produce((prev) => {
        const img = prev.images[imageId];
        if (img) {
          img.status = "done";
          img.optimizedSize = result.size;
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
};

const removeImage = (imageId: string) => {
  setStore(
    produce((prev) => {
      delete prev.images[imageId];
      prev.imageOrder = prev.imageOrder.filter((id) => id !== imageId);
      if (prev.selectedImageId === imageId) {
        prev.selectedImageId =
          prev.imageOrder.length > 0 ? prev.imageOrder[0] : null;
      }
    })
  );
};

const clearAll = () => {
  setStore({ images: {}, imageOrder: [], selectedImageId: null });
};

const setSelectedImage = (imageId: string | null) => {
  setStore("selectedImageId", imageId);
};

export {
  addImages,
  clearAll,
  processImage,
  removeImage,
  setSelectedImage,
  store,
};
