import { Component, createMemo, createSignal, For, Show } from "solid-js";

import { configKey } from "~/modules/formats/utils";
import { copyFormats, store } from "~/modules/state";
import { Button } from "~/pixel";
import { downloadBlob } from "~/utils/files";

import styles from "./Footer.module.css";

import type { TFormat } from "Types";

const formatsSignature = (formats: TFormat[]) =>
  formats.map((f) => configKey(f)).join("\0");

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

  const formatButtons = createMemo(() => {
    const selectedId = store.selectedImageId;
    const sourceId =
      selectedId && store.images[selectedId] ? selectedId : store.imageOrder[0];
    const sourceImg = sourceId ? store.images[sourceId] : null;

    if (!sourceImg) return [];

    const seenKeys = new Set<string>();
    const buttons: Array<{
      format: TFormat;
      key: string;
      label: string;
      allConfigured: boolean;
      allEnabled: boolean;
      ext: string;
    }> = [];

    for (const fmt of sourceImg.formats) {
      if (fmt.format === "original") continue;
      const key = configKey(fmt);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        buttons.push({
          format: fmt,
          key,
          label: [
            fmt.format.toUpperCase(),
            "quality" in fmt ? `${fmt.quality}%` : undefined,
          ]
            .filter(Boolean)
            .join(" "),
          ext: fmt.format,
          allConfigured: store.imageOrder.every((id) =>
            store.images[id]?.formats.some((f) => configKey(f) === key)
          ),
          allEnabled: store.imageOrder.every(
            (id) => store.images[id]?.optimized?.[key] != null
          ),
        });
      }
    }

    return buttons;
  });

  const handleExportAll = () => {
    for (const id of store.imageOrder) {
      const img = store.images[id];
      if (!img?.optimized) continue;
      for (const fmt of img.formats) {
        if (fmt.format === "original") continue;
        const key = configKey(fmt);
        const result = img.optimized[key];
        if (!result) continue;
        downloadBlob(
          result.blob,
          `${img.name}${"quality" in fmt ? `_q${fmt.quality}` : ""}.${fmt.format}`
        );
      }
    }
  };

  const handleExportFormat = (key: string, fmt: TFormat) => {
    for (const id of store.imageOrder) {
      const img = store.images[id];
      const result = img?.optimized?.[key];
      if (!result) continue;
      downloadBlob(
        result.blob,
        `${img.name}${"quality" in fmt ? `_q${fmt.quality}` : ""}.${fmt.format}`
      );
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
            disabled={allImagesShareFormats()}
            loading={copyingFormats()}
            onClick={handleCopyFormatsToOthers}
          />
        </Show>
        <div class={styles.exportGroup}>
          <Button
            kind="primary"
            class={styles.exportAll}
            disabled={!allDone()}
            onClick={handleExportAll}
          >
            Export All
          </Button>
          <For each={formatButtons()}>
            {(btn) => (
              <Button
                kind="primary"
                class={styles.formatButton}
                disabled={!btn.allConfigured}
                loading={btn.allConfigured && !btn.allEnabled}
                onClick={() => handleExportFormat(btn.key, btn.format)}
              >
                {btn.label}
              </Button>
            )}
          </For>
        </div>
      </footer>
    </Show>
  );
};
