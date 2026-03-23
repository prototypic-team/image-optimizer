import { Component, createMemo, createSignal, JSX, Show } from "solid-js";

import { addImages, store } from "~/modules/state";
import { cn } from "~/pixel";
import { collectFilesFromDrop, useFilePicker } from "~/utils/useFilePicker";

import styles from "./ImageDropZone.module.css";

type Props = {
  children?: JSX.Element;
};

export const ImageDropZone: Component<Props> = (props) => {
  const [dragging, setDragging] = createSignal(false);
  let dragCounter = 0;

  const { openFilePicker, handleFileList } = useFilePicker({
    onFilesSelected: addImages,
  });

  const handleClick: JSX.EventHandler<HTMLDivElement, MouseEvent> = (e) => {
    if (Object.keys(store.images).length > 0) return;
    if ((e.target as HTMLElement).closest(`.${styles.select}`)) return;
    openFilePicker();
  };

  const handleKeyDown: JSX.EventHandler<HTMLDivElement, KeyboardEvent> = (
    e
  ) => {
    if (Object.keys(store.images).length > 0) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openFilePicker();
    }
  };

  const handleDragOver: JSX.EventHandler<HTMLDivElement, DragEvent> = (e) => {
    e.preventDefault();
  };

  const handleDragEnter: JSX.EventHandler<HTMLDivElement, DragEvent> = (e) => {
    e.preventDefault();
    dragCounter++;
    if (e.dataTransfer?.types.includes("Files")) setDragging(true);
  };

  const handleDragLeave: JSX.EventHandler<HTMLDivElement, DragEvent> = (e) => {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) setDragging(false);
  };

  const handleDrop: JSX.EventHandler<HTMLDivElement, DragEvent> = async (e) => {
    e.preventDefault();
    dragCounter = 0;
    setDragging(false);
    const files = await collectFilesFromDrop(e.dataTransfer ?? null);
    handleFileList(files.length > 0 ? files : null);
  };

  const isEmpty = createMemo(() => Object.keys(store.images).length === 0);

  return (
    <div
      class={cn(styles.zone, dragging() && styles.dragging)}
      tabIndex={isEmpty() ? 0 : undefined}
      role={isEmpty() ? "button" : undefined}
      aria-label={isEmpty() ? "Drop images here or click to select" : undefined}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <span class={styles.dropHint} aria-hidden>
        Drop here
      </span>
      <Show when={isEmpty()} fallback={props.children}>
        <div class={styles.empty}>
          <span>
            Drag and drop or{" "}
            <span class={styles.select} onClick={openFilePicker}>
              select images
            </span>
          </span>
          <span class={styles.formats}>.jpg, .png, .webp, .gif, .avif</span>
        </div>
      </Show>
    </div>
  );
};
