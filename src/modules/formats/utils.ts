import { TEncodableFormat, TFormat, TSvgFormat } from "Types";

export const configKey = ({ format, ...config }: TFormat): string => {
  const configString = Object.entries(config)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("_");

  return `${format}${configString ? `_${configString}` : ""}`;
};

const formatKeys: Set<TEncodableFormat | "original"> = new Set([
  "original",
  "avif",
  "jpeg",
  "svg",
  "webp",
  "png",
]);
export const guardFormatKey = (
  maybeFormat: string
): TEncodableFormat | "original" => {
  if (!formatKeys.has(maybeFormat as TEncodableFormat | "original")) {
    throw new Error(`Invalid format key: ${maybeFormat}`);
  }
  return maybeFormat as TEncodableFormat | "original";
};

const qualityFormats: Set<TEncodableFormat | "original"> = new Set([
  "avif",
  "jpeg",
  "png",
  "webp",
]);

export const guardQualityFormat = (
  format: TFormat
): Extract<TFormat, { quality: number }> | undefined => {
  return qualityFormats.has(format.format as TEncodableFormat | "original") &&
    "quality" in format
    ? (format as Extract<TFormat, { quality: number }>)
    : undefined;
};

export const guardPrecisionFormat = (
  format: TFormat
): TSvgFormat | undefined => {
  return format.format === "svg" ? (format as TSvgFormat) : undefined;
};
