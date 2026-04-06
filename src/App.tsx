import { Component, createMemo } from "solid-js";

import { ImageDropZone } from "~/components/ImageDropZone/ImageDropZone";
import { ImageList } from "~/components/ImageList/ImageList";
import { ImagePreview } from "~/components/ImagePreview/ImagePreview";
import { store } from "~/modules/state";

import styles from "./App.module.css";

export const App: Component = () => {
  const isEmpty = createMemo(() => store.imageOrder.length === 0);

  return (
    <>
      <ImageDropZone>
        <div class={styles.main}>
          <ImageList />
          <ImagePreview />
        </div>
      </ImageDropZone>
      {isEmpty() && (
        <footer>
          <div>© 2026 Prototypic</div>
          <a href="/about.html" style="margin-left: auto">
            About
          </a>
          <a href="/terms.html">Terms</a>
          <a href="/privacy.html">Privacy</a>
        </footer>
      )}
    </>
  );
};
