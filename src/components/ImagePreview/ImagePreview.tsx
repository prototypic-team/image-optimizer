import { Component, createMemo, onCleanup, Show } from "solid-js";

import { configKey, configLabel, DEFAULT_CONFIGS } from "~/modules/optimizer";
import { store } from "~/modules/state";
import type { TFormatResult } from "~/modules/state/types.d";
import { Button } from "~/pixel";
import { formatFileSize } from "~/utils/format";

import styles from "./ImagePreview.module.css";

type CellConfig = { key: string; label: string; ext: string };

const CELLS: CellConfig[] = DEFAULT_CONFIGS.map((cfg) => ({
  key: configKey(cfg),
  label: configLabel(cfg),
  ext: cfg.format,
}));

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
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

  for (const cell of CELLS) {
    const r = optimized[cell.key];
    if (r && r.size < best.size) {
      best = { ext: cell.ext, blob: r.blob, size: r.size };
    }
  }

  return best;
};

export const ImagePreview: Component = () => {
  const hasImages = createMemo(() => store.imageOrder.length > 0);

  const selectedImage = () => {
    const id = store.selectedImageId;
    return id ? store.images[id] : null;
  };

  const previewUrls = createMemo(() => {
    const img = selectedImage();
    if (!img) return null;

    const urls: { key: string; url: string; size: number }[] = [];

    const origUrl = URL.createObjectURL(img.file);
    urls.push({ key: "original", url: origUrl, size: img.file.size });

    if (img.optimized) {
      for (const cell of CELLS) {
        const r = img.optimized[cell.key];
        if (r) {
          urls.push({
            key: cell.key,
            url: URL.createObjectURL(r.blob),
            size: r.size,
          });
        }
      }
    }

    onCleanup(() => {
      for (const u of urls) URL.revokeObjectURL(u.url);
    });

    return new Map(urls.map((u) => [u.key, u]));
  });

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
    <div class={styles.container}>
      <Show when={selectedImage()}>
        <div class={styles.grid}>
          {[{ key: "original", label: "Original" }, ...CELLS].map(
            ({ key, label }) => {
              const entry = () => previewUrls()?.get(key);
              return (
                <div class={styles.cell}>
                  <div class={styles.label}>{label}</div>
                  <img
                    src={entry()?.url ?? previewUrls()?.get("original")?.url}
                    alt=""
                    class={styles.preview}
                    classList={{
                      [styles.placeholder]: key !== "original" && !entry()?.url,
                    }}
                  />
                  <span class={styles.size}>
                    {formatFileSize(entry()?.size ?? 0)}
                  </span>
                </div>
              );
            }
          )}
        </div>
      </Show>
      <Show when={hasImages()}>
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
    </div>
  );
};
