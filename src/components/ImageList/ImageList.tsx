import { Component, createMemo, For, Show } from "solid-js";

import {
  addImages,
  clearAll,
  removeImage,
  setSelectedImage,
  store,
} from "~/modules/state";
import { cn } from "~/pixel";
import { formatFileSize } from "~/utils/format";
import { isMac } from "~/utils/platform";
import { useFilePicker } from "~/utils/useFilePicker";

import styles from "./ImageList.module.css";

const modKey = isMac ? "⌘" : "Ctrl";

export const ImageList: Component = () => {
  const { openFilePicker } = useFilePicker({
    onFilesSelected: addImages,
  });

  const images = createMemo(() =>
    store.imageOrder
      .map((id) => store.images[id])
      .filter((img): img is NonNullable<typeof img> => !!img)
  );

  return (
    <nav class={styles.container}>
      <Show when={images().length > 0}>
        <div class={styles.list}>
          <For each={images()}>
            {(image) => (
              <div class={styles.itemWrapper}>
                <button
                  type="button"
                  class={cn(
                    styles.item,
                    store.selectedImageId === image.id && styles.selected
                  )}
                  aria-label={`Select ${image.name}`}
                  onClick={() => setSelectedImage(image.id)}
                >
                  <div class={styles.preview}>
                    <img
                      src={URL.createObjectURL(image.file)}
                      alt=""
                      class={styles.thumb}
                    />
                  </div>
                  <span>{formatFileSize(image.weight.original)}</span>
                </button>
                <button
                  type="button"
                  class={styles.remove}
                  aria-label={`Remove ${image.name}`}
                  onClick={() => removeImage(image.id)}
                >
                  ×
                </button>
              </div>
            )}
          </For>
        </div>
      </Show>

      <div class={styles.actions}>
        <button
          type="button"
          class={cn(styles.action, styles.addImages)}
          onClick={openFilePicker}
        >
          <span class={styles.title}>Add images</span>
          <span>{modKey} + U</span>
        </button>
        <Show when={images().length > 0}>
          <button
            type="button"
            id="clear-all"
            class={cn(styles.action, styles.clearAll)}
            onClick={(e) => {
              e.stopPropagation();
              clearAll();
            }}
          >
            <span class={styles.name}>Clear All</span>
            <span>{modKey} + Del</span>
          </button>
        </Show>
      </div>
    </nav>
  );
};
