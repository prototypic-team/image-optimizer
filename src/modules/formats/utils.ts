import { TEncodableFormat, TFormat } from "Types";

export const configKey = ({ format, ...config }: TFormat): string => {
  const configString = Object.entries(config)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join("_");

  return `${format}_${configString}`;
};

const formatKeys: Set<TEncodableFormat | "original"> = new Set([
  "original",
  "avif",
  "jpeg",
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

export const supportsQualitySetting = (
  format: TEncodableFormat | "original"
) => {
  return format === "avif" || format === "jpeg" || format === "webp";
};

export const guardQualityFormat = (
  format: TFormat
): Extract<TFormat, { quality: number }> | undefined => {
  return supportsQualitySetting(format.format) && "quality" in format
    ? format
    : undefined;
};
