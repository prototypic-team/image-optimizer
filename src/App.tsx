import { Component } from "solid-js";

import { ImageDropZone } from "~/components/ImageDropZone/ImageDropZone";
import { ImageList } from "~/components/ImageList/ImageList";

import styles from "./App.module.css";

export const App: Component = () => {
  return (
    <ImageDropZone>
      <div class={styles.main}>
        <ImageList />
      </div>
    </ImageDropZone>
  );
};
