import { Component, createMemo, createSignal, onMount, Show } from "solid-js";

import { ImageDropZone } from "~/components/ImageDropZone/ImageDropZone";
import { ImageList } from "~/components/ImageList/ImageList";
import { ImagePreview } from "~/components/ImagePreview/ImagePreview";
import { hydrateFromPersistence, store } from "~/modules/state";

import styles from "./App.module.css";

export const App: Component = () => {
  const [hydrated, setHydrated] = createSignal(false);
  const isEmpty = createMemo(() => store.imageOrder.length === 0);

  onMount(() => hydrateFromPersistence(() => setHydrated(true)));

  return (
    <Show when={hydrated()}>
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
    </Show>
  );
};
