import { type Component, createMemo, createSignal, Show } from "solid-js";

import {
  guardFormatKey,
  guardQualityFormat,
  supportsQualitySetting,
} from "~/modules/formats/utils";
import { store } from "~/modules/state";
import { cn, Icon, Range, Select } from "~/pixel";
import { debounce } from "~/utils/debounce";
import { formatFileSize } from "~/utils/format";

import styles from "./Hud.module.css";

import { TFormat, TOriginalFormat } from "Types";

const FORMAT_OPTIONS: { value: TFormat["format"]; label: string }[] = [
  { value: "avif", label: "AVIF" },
  { value: "jpeg", label: "JPEG" },
  { value: "png", label: "PNG" },
  { value: "webp", label: "WEBP" },
];

export type HudProps = {
  settings: TFormat;
  size: number;
  class?: string;
  isProcessing: boolean;
  downloadDisabled?: boolean;
  onDownload?: () => void;
  onChange: (newSettings: TFormat) => void;
};

export const Hud: Component<HudProps> = (props) => {
  const selectedImage = createMemo(() => {
    const id = store.selectedImageId;
    return id ? store.images[id] : null;
  });

  const [format, setFormat] = createSignal(props.settings);

  const formatOptions = createMemo(() => [
    {
      value: "original",
      label: selectedImage()?.extension
        ? `ORIGINAL (${selectedImage()?.extension.replace("jpg", "jpeg").toUpperCase()})`
        : "ORIGINAL",
    },
    ...FORMAT_OPTIONS,
  ]);

  const onFormatKeyChange = (value: string) => {
    const newFormatKey = guardFormatKey(value);

    if (!supportsQualitySetting(newFormatKey)) {
      setFormat({ format: "original" } as TOriginalFormat);
      props.onChange({ format: "original" } as TOriginalFormat);
      return;
    }

    const newFormat = {
      format: newFormatKey as TFormat["format"],
      quality: "quality" in props.settings ? props.settings.quality : 75,
    };

    setFormat(newFormat);
    props.onChange(newFormat);
  };

  const debouncedOnChange = debounce(props.onChange, {
    threshold: 400,
    throttle: true,
  });
  const onQualityChange = (value: number) => {
    if (props.settings.format === "original") return;

    const newFormat = {
      format: props.settings.format,
      quality: Math.min(100, Math.max(1, Math.round(value))),
    };

    setFormat(newFormat);
    debouncedOnChange(newFormat);
  };

  const downloadAriaLabel = createMemo(() => {
    const f = format();
    const sizeStr = formatFileSize(props.size);

    if (f.format === "original") {
      const ext = selectedImage()?.extension;
      return ext
        ? `Download original, ${sizeStr}`
        : `Download original, ${sizeStr}`;
    }

    const qf = guardQualityFormat(f);
    if (qf) {
      return `Download ${f.format}, ${qf.quality}% quality, ${sizeStr}`;
    }

    return `Download ${f.format}, ${sizeStr}`;
  });

  return (
    <section
      class={cn(styles.root, props.class)}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <Select
        class={styles.select}
        options={formatOptions()}
        value={format().format}
        onChange={onFormatKeyChange}
        aria-label="Output format"
      />
      <div class={styles.settings}>
        <Show when={guardQualityFormat(format())}>
          {(f) => (
            <div class={styles.setting}>
              <Range
                aria-label="Quality"
                min={5}
                max={100}
                step={5}
                value={f().quality}
                onInput={onQualityChange}
              />
              <span>{f().quality}%</span>
            </div>
          )}
        </Show>
      </div>
      <button
        type="button"
        class={styles.download}
        disabled={props.downloadDisabled}
        onClick={() => props.onDownload?.()}
        aria-label={downloadAriaLabel()}
      >
        <Show when={!props.isProcessing} fallback={"Processing..."}>
          <Icon.Download />
          <span>{formatFileSize(props.size)}</span>
        </Show>
      </button>
    </section>
  );
};
