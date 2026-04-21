import { Component, createMemo, For, Show } from "solid-js";

import { configKey } from "~/modules/formats/utils";
import { copyFormats, store } from "~/modules/state";
import { Button } from "~/pixel";
import { downloadBlob } from "~/utils/files";

import styles from "./Footer.module.css";

import type { TFormat } from "Types";

const formatsSignature = (formats: TFormat[]) =>
  formats.map((f) => configKey(f)).join("\0");

export const Footer: Component = () => {
  const allEnabled = createMemo(
    () =>
      store.imageOrder.length > 0 &&
      store.imageOrder.every((id) =>
        store.images[id]?.formats.every(
          (f) => f.config.format === "original" || f.result != null
        )
      )
  );

  const allImagesShareFormats = createMemo(() => {
    if (store.imageOrder.length === 0) return true;

    const svgImageId = store.imageOrder.find(
      (id) => store.images[id]?.extension.toLowerCase() === "svg"
    );
    const svgFormats = svgImageId
      ? store.images[svgImageId]?.formats
      : undefined;

    const nonSvgImageId = store.imageOrder.find(
      (id) => store.images[id]?.extension.toLowerCase() !== "svg"
    );
    const nonSvgFormats = nonSvgImageId
      ? store.images[nonSvgImageId]?.formats
      : undefined;

    if (svgFormats && nonSvgFormats) {
      for (let i = 0; i < svgFormats.length; i++) {
        const svgFormat = svgFormats[i];
        const nonSvgFormat = nonSvgFormats[i];

        if (!svgFormat || !nonSvgFormat) return false;

        if (svgFormat.config.format === "svg") continue;
        if (svgFormat.config.format !== nonSvgFormat.config.format)
          return false;
        if (
          "quality" in svgFormat.config &&
          "quality" in nonSvgFormat.config &&
          svgFormat.config.quality !== nonSvgFormat.config.quality
        )
          return false;
      }
    }

    const svgFormatsSignature = svgFormats
      ? formatsSignature(svgFormats.map((f) => f.config))
      : undefined;
    const nonSvgFormatsSignature = nonSvgFormats
      ? formatsSignature(nonSvgFormats.map((f) => f.config))
      : undefined;

    return store.imageOrder.every((id) => {
      const img = store.images[id];
      if (img?.extension.toLowerCase() === "svg") {
        return (
          formatsSignature(img.formats.map((f) => f.config)) ===
          svgFormatsSignature
        );
      } else {
        return (
          formatsSignature(img.formats.map((f) => f.config)) ===
          nonSvgFormatsSignature
        );
      }
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

    for (let i = 0; i < sourceImg.formats.length; i++) {
      const fmt = sourceImg.formats[i];
      if (fmt.config.format === "original") continue;
      const key = configKey(fmt.config);
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        buttons.push({
          format: fmt.config,
          key,
          label: [
            fmt.config.format.toUpperCase(),
            "quality" in fmt.config ? `${fmt.config.quality}%` : undefined,
            "precision" in fmt.config ? `${fmt.config.precision}dp` : undefined,
          ]
            .filter(Boolean)
            .join(" "),
          ext: fmt.config.format,
          allConfigured: store.imageOrder.every((id) => {
            const matchFormat =
              configKey(store.images[id]?.formats[i].config) === key;
            const svgException =
              store.images[id]?.extension.toLowerCase() === "svg" &&
              fmt.config.format !== "svg";
            const nonSvgException =
              store.images[id]?.extension.toLowerCase() !== "svg" &&
              fmt.config.format === "svg";

            return matchFormat || svgException || nonSvgException;
          }),
          allEnabled: store.imageOrder.every(
            (id) => store.images[id]?.formats[i].result != null
          ),
        });
      }
    }

    return buttons;
  });

  const handleExportAll = () => {
    for (const id of store.imageOrder) {
      const img = store.images[id];
      if (!img?.formats.some((f) => f.result != null)) continue;
      for (const fmt of img.formats) {
        if (fmt.config.format === "original") continue;
        if (!fmt.result) continue;
        downloadBlob(
          fmt.result.blob,
          `${img.name}${[
            "quality" in fmt.config ? `_q${fmt.config.quality}` : "",
            "precision" in fmt.config ? `_p${fmt.config.precision}dp` : "",
          ]
            .filter(Boolean)
            .join("")}.${fmt.config.format}`
        );
      }
    }
  };

  const handleExportFormat = (key: string, fmt: TFormat) => {
    for (const id of store.imageOrder) {
      const img = store.images[id];
      const result = img?.formats.find(
        (f) => configKey(f.config) === key
      )?.result;
      if (!result) continue;
      downloadBlob(
        result.blob,
        `${img.name}${"quality" in fmt ? `_q${fmt.quality}` : ""}.${fmt.format}`
      );
    }
  };

  return (
    <Show when={store.imageOrder.length > 1}>
      <footer class={styles.footer}>
        <Show when={store.imageOrder.length > 1}>
          <Button
            kind="secondary"
            class={styles.copySettings}
            disabled={allImagesShareFormats()}
            onClick={copyFormats}
          />
        </Show>
        <div class={styles.exportGroup}>
          <Button
            kind="primary"
            class={styles.exportAll}
            disabled={!allImagesShareFormats()}
            loading={!allEnabled()}
            onClick={handleExportAll}
          >
            Download All
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
