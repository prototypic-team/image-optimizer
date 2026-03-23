import { Component, createMemo, For, Show } from "solid-js";

import { addImages, clearAll, removeImage, store } from "~/modules/state";
import { Button } from "~/pixel";
import { Loader } from "~/pixel/Loader/Loader";
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
    <div class={styles.wrapper}>
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
            <li class={styles.item}>
              <div class={styles.preview}>
                <img
                  src={URL.createObjectURL(image.file)}
                  alt=""
                  class={styles.thumb}
                />
              </div>
              <div class={styles.info}>
                <span class={styles.name}>{image.fileName}</span>
                <span class={styles.size}>
                  {formatFileSize(image.size)}
                  {image.optimizedSize !== undefined && (
                    <>
                      {" → "}
                      {formatFileSize(image.optimizedSize)}
                    </>
                  )}
                </span>
                <Show when={image.status === "processing"}>
                  <Loader size="small" class={styles.loader} />
                </Show>
                <Show when={image.status === "error"}>
                  <span class={styles.error}>{image.error}</span>
                </Show>
              </div>
              <Button
                kind="default"
                class={styles.remove}
                onClick={() => removeImage(image.id)}
              >
                Remove
              </Button>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
};
