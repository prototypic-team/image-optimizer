import { Component, createMemo, Show } from "solid-js";

import { store } from "~/modules/state";
import { Button } from "~/pixel";
import { downloadBlob } from "~/utils/files";

import styles from "./Footer.module.css";

import type { TFormatResult } from "Types";

const extFromConfigKey = (key: string): string => {
  const base = key.includes("_q") ? key.slice(0, key.indexOf("_q")) : key;
  return base === "jpeg" ? "jpg" : base;
};

const getSmallest = (
  file: File,
  extension: string,
  optimized: Record<string, TFormatResult>
): { ext: string; blob: Blob; size: number } => {
  let best: { ext: string; blob: Blob; size: number } = {
    ext: extension,
    blob: file,
    size: file.size,
  };

  for (const [key, r] of Object.entries(optimized)) {
    if (r.size < best.size) {
      best = { ext: extFromConfigKey(key), blob: r.blob, size: r.size };
    }
  }

  return best;
};

export const Footer: Component = () => {
  const selectedImage = createMemo(() =>
    store.selectedImageId ? store.images[store.selectedImageId] : undefined
  );

  const allDone = createMemo(
    () =>
      store.imageOrder.length > 0 &&
      store.imageOrder.every((id) => store.images[id]?.status === "done")
  );

  const handleExport = () => {
    const img = selectedImage();
    if (!img?.optimized) return;
    const best = getSmallest(img.file, img.extension, img.optimized);
    downloadBlob(best.blob, `${img.name}.${best.ext}`);
  };

  const handleExportAll = () => {
    for (const id of store.imageOrder) {
      const img = store.images[id];
      if (!img?.optimized) continue;
      const best = getSmallest(img.file, img.extension, img.optimized);
      downloadBlob(best.blob, `${img.name}.${best.ext}`);
    }
  };

  return (
    <Show when={store.imageOrder.length > 0}>
      <footer class={styles.footer}>
        <div class={styles.footerActions}>
          <Show when={selectedImage()?.optimized}>
            <Button
              data-label={`Export ${selectedImage()?.name ?? ""}`}
              class={styles.exportImage}
              kind="secondary"
              onClick={handleExport}
            />
          </Show>
          <Button
            kind="primary"
            disabled={!allDone()}
            onClick={handleExportAll}
          >
            Export All
          </Button>
        </div>
      </footer>
    </Show>
  );
};
