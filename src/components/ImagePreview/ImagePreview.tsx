import {
  Component,
  createEffect,
  createMemo,
  createSignal,
  onCleanup,
  Show,
} from "solid-js";

import { configKey, configLabel, DEFAULT_CONFIGS } from "~/modules/optimizer";
import { setViewport, store } from "~/modules/state";
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

const QUADRANT_CLIPS = [
  "polygon(0 0, 50% 0, 50% 50%, 0 50%)",
  "polygon(50% 0, 100% 0, 100% 50%, 50% 50%)",
  "polygon(0 50%, 50% 50%, 50% 100%, 0 100%)",
  "polygon(50% 50%, 100% 50%, 100% 100%, 50% 100%)",
];

const QUADRANTS = [
  { key: "original", label: "Original" },
  ...CELLS.map((c) => ({ key: c.key, label: c.label })),
];

const LABEL_CLASSES = ["labelTl", "labelTr", "labelBl", "labelBr"] as const;

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

  const [scale, setScale] = createSignal(1);
  const [tx, setTx] = createSignal(0);
  const [ty, setTy] = createSignal(0);
  const [dragging, setDragging] = createSignal(false);

  let dragStart = { x: 0, y: 0, tx: 0, ty: 0 };
  let prevImageId: string | undefined;
  let viewportSize = { w: 0, h: 0 };

  const saveViewport = () => {
    if (prevImageId) {
      setViewport(prevImageId, { scale: scale(), tx: tx(), ty: ty() });
    }
  };

  createEffect(() => {
    const id = store.selectedImageId;

    saveViewport();

    const v = id ? store.images[id]?.viewport : null;
    setScale(v?.scale ?? 1);
    setTx(v?.tx ?? 0);
    setTy(v?.ty ?? 0);

    prevImageId = id;
  });

  const imageTransform = () =>
    `translate(${tx()}px, ${ty()}px) scale(${scale()})`;

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();

    const cx = viewportSize.w / 2;
    const cy = viewportSize.h / 2;

    let dy = e.deltaY;
    if (e.deltaMode === 1) dy *= 16;
    if (e.deltaMode === 2) dy *= 100;

    const factor = Math.exp(-dy * 0.002);

    const oldScale = scale();
    const newScale = Math.min(Math.max(oldScale * factor, 0.1), 30);
    if (newScale === oldScale) return;

    const ratio = newScale / oldScale;
    setTx(cx - (cx - tx()) * ratio);
    setTy(cy - (cy - ty()) * ratio);
    setScale(newScale);
    saveViewport();
  };

  const handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    setDragging(true);
    dragStart = { x: e.clientX, y: e.clientY, tx: tx(), ty: ty() };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!dragging()) return;
    setTx(dragStart.tx + e.clientX - dragStart.x);
    setTy(dragStart.ty + e.clientY - dragStart.y);
  };

  const handlePointerUp = () => {
    if (dragging()) saveViewport();
    setDragging(false);
  };

  // --- Touch pinch-to-zoom ---
  let pinchState: { dist: number; scale: number; cx: number; cy: number; tx: number; ty: number } | null = null;

  const touchDist = (a: Touch, b: Touch) =>
    Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  const handleTouchStart = (e: TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      pinchState = {
        dist: touchDist(a, b),
        scale: scale(),
        cx: (a.clientX + b.clientX) / 2 - rect.left,
        cy: (a.clientY + b.clientY) / 2 - rect.top,
        tx: tx(),
        ty: ty(),
      };
    }
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (e.touches.length === 2 && pinchState) {
      e.preventDefault();
      const dist = touchDist(e.touches[0], e.touches[1]);
      const newScale = Math.min(Math.max(pinchState.scale * (dist / pinchState.dist), 0.1), 30);
      const ratio = newScale / pinchState.scale;
      setTx(pinchState.cx - (pinchState.cx - pinchState.tx) * ratio);
      setTy(pinchState.cy - (pinchState.cy - pinchState.ty) * ratio);
      setScale(newScale);
    }
  };

  const handleTouchEnd = (e: TouchEvent) => {
    if (e.touches.length < 2 && pinchState) {
      pinchState = null;
      saveViewport();
    }
  };

  const handleDblClick = () => {
    setScale(1);
    setTx(0);
    setTy(0);
    saveViewport();
  };

  let viewportRef!: HTMLDivElement;
  const ro = new ResizeObserver(([entry]) => {
    viewportSize = { w: entry.contentRect.width, h: entry.contentRect.height };
  });

  createEffect((prevElement): HTMLDivElement | undefined => {
    if (viewportRef.isConnected) {
      viewportRef.addEventListener("wheel", handleWheel, { passive: false });
      viewportRef.addEventListener("pointerdown", handlePointerDown);
      viewportRef.addEventListener("pointermove", handlePointerMove);
      viewportRef.addEventListener("pointerup", handlePointerUp);
      viewportRef.addEventListener("lostpointercapture", handlePointerUp);
      viewportRef.addEventListener("touchstart", handleTouchStart, { passive: false });
      viewportRef.addEventListener("touchmove", handleTouchMove, { passive: false });
      viewportRef.addEventListener("touchend", handleTouchEnd);
      viewportRef.addEventListener("dblclick", handleDblClick);
      ro.observe(viewportRef);
    }
    onCleanup(() => {
      if (prevElement) {
        prevElement.removeEventListener("wheel", handleWheel);
        prevElement.removeEventListener("pointerdown", handlePointerDown);
        prevElement.removeEventListener("pointermove", handlePointerMove);
        prevElement.removeEventListener("pointerup", handlePointerUp);
        prevElement.removeEventListener("lostpointercapture", handlePointerUp);
        prevElement.removeEventListener("touchstart", handleTouchStart);
        prevElement.removeEventListener("touchmove", handleTouchMove);
        prevElement.removeEventListener("touchend", handleTouchEnd);
        prevElement.removeEventListener("dblclick", handleDblClick);
        ro.unobserve(prevElement);
      }
    });

    return viewportRef;
  });

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
        <div
          ref={viewportRef}
          class={styles.viewport}
          classList={{
            [styles.panning]: dragging(),
          }}
        >
          {QUADRANTS.map((q, i) => {
            const entry = () => previewUrls()?.get(q.key);
            return (
              <div
                class={styles.quadrant}
                style={{ "clip-path": QUADRANT_CLIPS[i] }}
              >
                <img
                  src={entry()?.url ?? previewUrls()?.get("original")?.url}
                  alt=""
                  class={styles.preview}
                  classList={{
                    [styles.placeholder]: q.key !== "original" && !entry()?.url,
                  }}
                  style={{ transform: imageTransform() }}
                  draggable={false}
                />
              </div>
            );
          })}
          <div class={styles.dividerH} />
          <div class={styles.dividerV} />
          {QUADRANTS.map((q, i) => {
            const entry = () => previewUrls()?.get(q.key);
            return (
              <div class={`${styles.label} ${styles[LABEL_CLASSES[i]]}`}>
                <span>{q.label}</span>
                <span class={styles.size}>
                  {formatFileSize(entry()?.size ?? 0)}
                </span>
              </div>
            );
          })}
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
