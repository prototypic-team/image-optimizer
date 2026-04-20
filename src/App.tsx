import {
  Component,
  createMemo,
  createSignal,
  JSX,
  onCleanup,
  onMount,
  Show,
} from "solid-js";

import { ImageDropZone } from "~/components/ImageDropZone/ImageDropZone";
import { ImageList } from "~/components/ImageList/ImageList";
import { ImagePreview } from "~/components/ImagePreview/ImagePreview";
import {
  addImages,
  clearAll,
  hydrateFromPersistence,
  store,
} from "~/modules/state";
import { FILE_INPUT_ACCEPT, isImageFile } from "~/utils/files";

import styles from "./App.module.css";
import { isMac } from "./utils/platform";

export const App: Component = () => {
  const [hydrated, setHydrated] = createSignal(false);
  const isEmpty = createMemo(() => store.imageOrder.length === 0);

  const processFiles = (files: FileList | File[] | null) => {
    if (!files) return;

    const imageFiles = Array.from(files).filter(isImageFile);
    if (imageFiles.length > 0) addImages(imageFiles);
  };

  let fileInputRef!: HTMLInputElement;
  const onChange: JSX.EventHandler<HTMLInputElement, Event> = (e) => {
    processFiles(e.currentTarget.files);
  };

  const openFilePicker = () => {
    fileInputRef.value = "";
    fileInputRef.click();
  };

  onMount(() => {
    hydrateFromPersistence(() => setHydrated(true));

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyU" && (isMac ? e.metaKey : e.ctrlKey) && !e.shiftKey) {
        e.preventDefault();
        openFilePicker();
      }
      const isClearShortcut = isMac
        ? e.metaKey && (e.code === "Delete" || e.code === "Backspace")
        : e.ctrlKey && e.code === "Delete";
      if (isClearShortcut && Object.keys(store.images).length > 0) {
        e.preventDefault();
        clearAll();
      }
    };
    window.addEventListener("keydown", handleGlobalKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleGlobalKeyDown));
  });

  return (
    <Show when={hydrated()}>
      <>
        <input
          type="file"
          class={styles.fileInput}
          multiple
          accept={FILE_INPUT_ACCEPT}
          aria-hidden="true"
          tabIndex={-1}
          ref={fileInputRef}
          onChange={onChange}
        />
        <ImageDropZone
          openFilePicker={openFilePicker}
          onFilesDropped={processFiles}
        >
          <div class={styles.main}>
            <ImageList openFilePicker={openFilePicker} />
            <ImagePreview />
          </div>
        </ImageDropZone>
        {isEmpty() && (
          <footer class={styles.footer}>
            <div>© 2026 Prototypic</div>
            <a href="/about.html" style="margin-left: auto">
              About
            </a>
            <a href="/terms.html">Terms</a>
            <a href="/privacy.html">Privacy</a>
          </footer>
        )}
      </>
    </Show>
  );
};
