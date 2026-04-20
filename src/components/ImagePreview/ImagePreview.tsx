import {
  Component,
  createEffect,
  createMemo,
  createSignal,
  For,
  Index,
  onCleanup,
  Show,
} from "solid-js";

import { Hud } from "~/components/ImagePreview/Hud";
import { configKey } from "~/modules/formats/utils";
import { setFormatSettings, setViewport, store } from "~/modules/state";
import { cn } from "~/pixel";
import { debounce } from "~/utils/debounce";
import { downloadBlob } from "~/utils/files";

import { Footer } from "./Footer";
import styles from "./ImagePreview.module.css";

import type { TFormat } from "Types";

type THudPreviewRow = {
  imageId: string;
  url: string;
  size: number;
  placeholder: boolean;
  format: TFormat;
};

const sectorClasses = ["top-left", "top-right", "bottom-left", "bottom-right"];

export const ImagePreview: Component = () => {
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
  let pinchState: {
    dist: number;
    scale: number;
    cx: number;
    cy: number;
    tx: number;
    ty: number;
  } | null = null;

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
      const newScale = Math.min(
        Math.max(pinchState.scale * (dist / pinchState.dist), 0.1),
        30
      );
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
      viewportRef.addEventListener("touchstart", handleTouchStart, {
        passive: false,
      });
      viewportRef.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
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

  const previews = createMemo(() => {
    const img = selectedImage();
    if (!img) return undefined;

    const origUrl = URL.createObjectURL(img.file);
    const result: THudPreviewRow[] = [];
    const urlsToRevoke = new Set<string>();

    for (const format of img.formats) {
      if (format.format === "original") {
        result.push({
          imageId: img.id,
          url: origUrl,
          size: img.file.size,
          placeholder: false,
          format,
        });
        urlsToRevoke.add(origUrl);
      } else {
        const r = img.optimized?.[configKey(format)];
        if (r) {
          const u = URL.createObjectURL(r.blob);
          urlsToRevoke.add(u);
          result.push({
            imageId: img.id,
            url: u,
            size: r.size,
            placeholder: false,
            format,
          });
        } else {
          result.push({
            imageId: img.id,
            url: origUrl,
            size: 0,
            placeholder: true,
            format,
          });
        }
      }
    }

    onCleanup(() => {
      for (const u of urlsToRevoke) URL.revokeObjectURL(u);
    });

    return result;
  });

  const onFormatChange = debounce(setFormatSettings, {
    threshold: 300,
    throttle: true,
  });

  const downloadHudFormat = (preview: THudPreviewRow) => {
    const img = store.images[preview.imageId];
    if (!img) return;

    if (preview.format.format === "original") {
      downloadBlob(img.file, `${img.name}.${img.extension}`);
      return;
    }

    if (preview.placeholder) return;

    const key = configKey(preview.format);
    const r = img.optimized[key];
    if (!r) return;

    const ext =
      preview.format.format === "jpeg" ? "jpg" : preview.format.format;
    downloadBlob(r.blob, `${img.name}.${ext}`);
  };

  return (
    <div class={styles.container}>
      <Show when={selectedImage()}>
        <div class={styles.viewportContainer}>
          <div
            ref={viewportRef}
            class={styles.viewport}
            classList={{ [styles.panning]: dragging() }}
          >
            <Index each={Object.values(previews() ?? {})}>
              {(preview) => (
                <div class={styles.preview}>
                  <img
                    src={preview().url}
                    alt=""
                    decoding="sync"
                    classList={{
                      [styles.placeholder]: !!preview().placeholder,
                    }}
                    style={{ transform: imageTransform() }}
                    draggable={false}
                  />
                </div>
              )}
            </Index>
            <div class={styles.dividerH} />
            <div class={styles.dividerV} />
          </div>
          <For each={Object.values(previews() ?? {})}>
            {(preview, index) => (
              <Hud
                class={cn(
                  styles.hud,
                  styles[sectorClasses[index() % sectorClasses.length]]
                )}
                settings={preview.format}
                size={preview.size}
                isProcessing={preview.placeholder}
                downloadDisabled={preview.placeholder}
                onDownload={() => downloadHudFormat(preview)}
                onChange={(format) =>
                  onFormatChange(preview.imageId, index(), format)
                }
              />
            )}
          </For>
        </div>
      </Show>
      <Footer />
    </div>
  );
};
