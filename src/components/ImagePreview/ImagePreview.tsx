import { Component, createMemo, createResource, onCleanup, Show } from "solid-js";

import type { TEncodeFormat } from "~/modules/optimizer";
import { optimizeImage } from "~/modules/optimizer";
import { store } from "~/modules/state";
import { formatFileSize } from "~/utils/format";

import styles from "./ImagePreview.module.css";

type PreviewFormat = "original" | TEncodeFormat;

type PreviewResult = Record<PreviewFormat, { url: string; size: number }>;

const FORMATS: { format: PreviewFormat; label: string }[] = [
  { format: "original", label: "Original" },
  { format: "avif", label: "AVIF" },
  { format: "jpeg", label: "JPEG" },
  { format: "webp", label: "WebP" },
];

export const ImagePreview: Component = () => {
  const selectedImage = () => {
    const id = store.selectedImageId;
    return id ? store.images[id] : null;
  };

  const originalPreview = createMemo(() => {
    const img = selectedImage();
    if (!img) return null;
    const url = URL.createObjectURL(img.file);
    onCleanup(() => URL.revokeObjectURL(url));
    return { url, size: img.file.size };
  });

  const [encoded] = createResource(
    () => {
      const img = selectedImage();
      return img ? { file: img.file } : null;
    },
    async (input) => {
      const results: Partial<PreviewResult> = {};
      await Promise.all(
        FORMATS.map(async ({ format }) => {
          if (format === "original") {
            results[format] = {
              url: URL.createObjectURL(input.file),
              size: input.file.size,
            };
          } else {
            const { blob, size } = await optimizeImage(input.file, format);
            results[format] = {
              url: URL.createObjectURL(blob),
              size,
            };
          }
        })
      );
      return results as PreviewResult;
    }
  );

  return (
    <Show
      when={selectedImage()}
      fallback={<div class={styles.empty}>Select an image</div>}
    >
      <div class={styles.grid}>
        {FORMATS.map(({ format, label }) => (
          <div class={styles.cell}>
            <div class={styles.label}>{label}</div>
            <Show
              when={encoded()}
              keyed
              fallback={
                (() => {
                  const orig = originalPreview();
                  return orig ? (
                    <>
                      <img
                        src={orig.url}
                        alt={`${label} format`}
                        class={styles.preview}
                      />
                      <span class={styles.size}>
                        {formatFileSize(orig.size)}
                      </span>
                    </>
                  ) : null;
                })()
              }
            >
              {(data: PreviewResult) => (
                <>
                  <img
                    src={data[format].url}
                    alt={`${label} format`}
                    class={styles.preview}
                  />
                  <span class={styles.size}>
                    {formatFileSize(data[format].size)}
                  </span>
                </>
              )}
            </Show>
          </div>
        ))}
      </div>
    </Show>
  );
};
