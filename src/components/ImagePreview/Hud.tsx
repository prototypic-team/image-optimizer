import {
  type Component,
  createEffect,
  createMemo,
  createSignal,
  Show,
} from "solid-js";

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
  format: {
    config: TFormat;
    result?: { size: number; blob: Blob };
    error?: string;
  };
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  onDownload: () => void;
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

  const [format, setFormat] = createSignal(props.format.config);
  createEffect(() => setFormat(props.format.config));

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
    const f = format();

    switch (newFormatKey) {
      case "original":
        setFormat({ format: "original" });
        props.onChange({ format: "original" });
        return;

      case "svg": {
        const newFormat: TSvgFormat = {
          format: "svg",
          precision: "precision" in f ? f.precision : 2,
        };
        setFormat(newFormat);
        props.onChange(newFormat);
        return;
      }

      default: {
        const newFormat: Exclude<TFormat, TOriginalFormat | TSvgFormat> = {
          format: newFormatKey,
          quality: "quality" in f ? f.quality : 75,
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
    const f = format();
    if (f.format === "original") return;
    if (f.format === "svg") return;

    const newFormat: Exclude<TFormat, TOriginalFormat | TSvgFormat> = {
      format: f.format,
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
    const sizeStr = formatFileSize(props.format.result?.size ?? 0);

    if (props.format.config.format === "original") {
      const ext = selectedImage()?.extension;
      return ext
        ? `Download original, ${sizeStr}`
        : `Download original, ${sizeStr}`;
    }

    if (props.format.config.format === "svg") {
      return `Download SVG, precision ${props.format.config.precision}, ${sizeStr}`;
    }

    const qf = guardQualityFormat(props.format.config);
    if (qf) {
      return `Download ${props.format.config.format}, ${qf.quality}% quality, ${sizeStr}`;
    }

    return `Download ${props.format.config.format}, ${sizeStr}`;
  });

  return (
    <section
      class={cn(styles.root, styles[props.position])}
      classList={{ failed: !!props.format.error }}
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
        disabled={!props.format.result}
        onClick={props.onDownload}
        aria-label={downloadAriaLabel()}
      >
        <Show
          when={props.format.result}
          fallback={props.format.error ? "Error" : "Processing..."}
        >
          <Icon.Download width={14} height={14} />
          <span>{formatFileSize(props.format.result?.size ?? 0)}</span>
        </Show>
      </button>
      <Show when={props.format.error}>
        {(error) => (
          <div class={styles.error}>
            <span>{error()}</span>
          </div>
        )}
      </Show>
    </section>
  );
};
