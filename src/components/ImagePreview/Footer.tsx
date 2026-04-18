import { Component, createMemo, createSignal, Show } from "solid-js";

import { configKey } from "~/modules/formats/utils";
import { copyFormats, store } from "~/modules/state";
import { Button } from "~/pixel";
import { downloadBlob } from "~/utils/files";

import styles from "./Footer.module.css";

import type { TFormat, TFormatResult } from "Types";

const formatsSignature = (formats: TFormat[]) =>
  formats.map((f) => configKey(f)).join("\0");

const extFromConfigKey = (key: string): string => {
  const base = key.includes("_q") ? key.slice(0, key.indexOf("_q")) : key;
  return base === "jpeg" ? "jpg" : base;
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

  for (const [key, r] of Object.entries(optimized)) {
    if (r.size < best.size) {
      best = { ext: extFromConfigKey(key), blob: r.blob, size: r.size };
    }
  }

  return best;
};

export const Footer: Component = () => {
  const [copyingFormats, setCopyingFormats] = createSignal(false);

  const allDone = createMemo(
    () =>
      store.imageOrder.length > 0 &&
      store.imageOrder.every((id) => store.images[id]?.status === "done")
  );

  const allImagesShareFormats = createMemo(() => {
    const order = store.imageOrder;
    if (order.length === 0) return true;
    const first = store.images[order[0]];
    if (!first) return true;
    const sig = formatsSignature(first.formats);
    return order.every((id) => {
      const img = store.images[id];
      return img && formatsSignature(img.formats) === sig;
    });
  });

  const canCopyFormatsToOthers = createMemo(
    () => store.imageOrder.length > 1 && allDone() && !allImagesShareFormats()
  );

  const handleExportAll = () => {
    for (const id of store.imageOrder) {
      const img = store.images[id];
      if (!img?.optimized) continue;
      const best = getSmallest(img.file, img.extension, img.optimized);
      downloadBlob(best.blob, `${img.name}.${best.ext}`);
    }
  };

  const handleCopyFormatsToOthers = async () => {
    setCopyingFormats(true);
    try {
      await copyFormats();
    } finally {
      setCopyingFormats(false);
    }
  };

  return (
    <Show when={store.imageOrder.length > 0}>
      <footer class={styles.footer}>
        <Show when={store.imageOrder.length > 1}>
          <Button
            kind="secondary"
            class={styles.copySettings}
            disabled={!canCopyFormatsToOthers()}
            loading={copyingFormats()}
            onClick={handleCopyFormatsToOthers}
          />
        </Show>
        <Button
          kind="primary"
          class={styles.exportAll}
          disabled={!allDone()}
          onClick={handleExportAll}
        />
      </footer>
    </Show>
  );
};
