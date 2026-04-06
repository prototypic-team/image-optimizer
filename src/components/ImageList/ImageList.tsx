import { Component, createMemo, For, Show } from "solid-js";

import { addImages, clearAll, removeImage, setSelectedImage, store } from "~/modules/state";
import { Button, cn, Loader } from "~/pixel";
import { formatFileSize } from "~/utils/format";
import { useFilePicker } from "~/utils/useFilePicker";

import styles from "./ImageList.module.css";

export const ImageList: Component = () => {
  const { openFilePicker, openFolderPicker } = useFilePicker({
    onFilesSelected: addImages,
  });

  const images = createMemo(() =>
    store.imageOrder
      .map((id) => store.images[id])
      .filter((img): img is NonNullable<typeof img> => !!img)
  );

  return (
    <aside class={styles.sidebar}>
      <header class={styles.header}>
        <h1 class={styles.title}>i0</h1>
        <div class={styles.actions}>
          <Button kind="default" onClick={openFilePicker}>
            Add images
          </Button>
          <Button kind="default" onClick={openFolderPicker}>
            Add folder
          </Button>
          <Show when={images().length > 0}>
            <Button kind="default" onClick={clearAll}>
              Clear
            </Button>
          </Show>
        </div>
      </header>

      <ul class={styles.list}>
        <For each={images()}>
          {(image) => (
            <li>
              <button
                type="button"
                class={cn(
                  styles.item,
                  store.selectedImageId === image.id && styles.selected
                )}
                onClick={() => setSelectedImage(image.id)}
              >
                <div class={styles.preview}>
                  <img
                    src={URL.createObjectURL(image.file)}
                    alt=""
                    class={styles.thumb}
                  />
                </div>
                <span class={styles.size}>{formatFileSize(image.size)}</span>
                <Show when={image.status === "processing"}>
                  <Loader size="small" class={styles.loader} />
                </Show>
                <Show when={image.status === "error"}>
                  <span class={styles.error}>{image.error}</span>
                </Show>
              </button>
              <Button
                kind="default"
                class={styles.remove}
                onClick={(e) => {
                  e.stopPropagation();
                  removeImage(image.id);
                }}
              >
                Remove
              </Button>
            </li>
          )}
        </For>
      </ul>
    </aside>
  );
};
