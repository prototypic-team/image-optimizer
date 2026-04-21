import { type Component, createMemo, createSignal, Show } from "solid-js";

import {
  guardFormatKey,
  guardPrecisionFormat,
  guardQualityFormat,
} from "~/modules/formats/utils";
import { store } from "~/modules/state";
import { cn, Icon, Range, Select } from "~/pixel";
import { debounce } from "~/utils/debounce";
import { formatFileSize } from "~/utils/format";

import styles from "./Hud.module.css";

import { TFormat, TOriginalFormat, TSvgFormat } from "Types";

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

  const isSvgSource = createMemo(
    () => selectedImage()?.extension?.toLowerCase() === "svg"
  );

  const [format, setFormat] = createSignal(props.settings);

  const formatOptions = createMemo(() => [
    {
      value: "original",
      label: selectedImage()?.extension
        ? `ORIGINAL (${selectedImage()?.extension.replace("jpg", "jpeg").toUpperCase()})`
        : "ORIGINAL",
    },
    ...(isSvgSource() ? [{ value: "svg", label: "SVG" }] : []),
    ...FORMAT_OPTIONS,
  ]);

  const onFormatKeyChange = (value: string) => {
    const newFormatKey = guardFormatKey(value);

    switch (newFormatKey) {
      case "original":
        setFormat({ format: "original" });
        props.onChange({ format: "original" });
        return;

      case "svg": {
        const f: TSvgFormat = {
          format: "svg",
          precision:
            "precision" in props.settings ? props.settings.precision : 2,
        };
        setFormat(f);
        props.onChange(f);
        return;
      }

      default: {
        const newFormat: Exclude<TFormat, TOriginalFormat | TSvgFormat> = {
          format: newFormatKey,
          quality: "quality" in props.settings ? props.settings.quality : 75,
        };
        setFormat(newFormat);
        props.onChange(newFormat);
        return;
      }
    }
  };

  const debouncedOnChange = debounce(props.onChange, {
    threshold: 400,
    throttle: true,
  });

  const onQualityChange = (value: number) => {
    if (props.settings.format === "original") return;
    if (props.settings.format === "svg") return;

    const newFormat: Exclude<TFormat, TOriginalFormat | TSvgFormat> = {
      format: props.settings.format,
      quality: Math.min(100, Math.max(1, Math.round(value))),
    };

    setFormat(newFormat);
    debouncedOnChange(newFormat);
  };

  const onPrecisionChange = (value: number) => {
    const precision = Math.min(8, Math.max(0, Math.round(value)));
    const newFormat: TSvgFormat = { format: "svg", precision };
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

    if (f.format === "svg") {
      return `Download SVG, precision ${(f as TSvgFormat).precision}, ${sizeStr}`;
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
        <Show when={guardPrecisionFormat(format())}>
          {(f) => (
            <div class={styles.setting}>
              <Range
                aria-label="SVG precision"
                min={0}
                max={8}
                step={1}
                value={f().precision}
                onInput={onPrecisionChange}
              />
              <span>{f().precision} dp</span>
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
          <Icon.Download width={14} height={14} />
          <span>{formatFileSize(props.size)}</span>
        </Show>
      </button>
    </section>
  );
};
