import { TFormat, TImage } from "Types";

const DEFAULT_FORMATS: TFormat[] = [
  { format: "original" },
  { format: "jpeg", quality: 75 },
  { format: "webp", quality: 75 },
  { format: "avif", quality: 60 },
];

const DEFAULT_FORMATS_SVG: TFormat[] = [
  { format: "original" },
  { format: "svg", precision: 2 },
  { format: "webp", quality: 75 },
  { format: "avif", quality: 60 },
];

const isSvgFile = (file: File): boolean =>
  file.type === "image/svg+xml" || file.name.toLowerCase().endsWith(".svg");

export const fromFile = (file: File): TImage => ({
  id: crypto.randomUUID(),
  name: file.name.replace(/\.[^.]+$/, ""),
  fileName: file.name,
  extension: file.name.split(".").pop() ?? "",
  file,
  formats: (isSvgFile(file) ? DEFAULT_FORMATS_SVG : DEFAULT_FORMATS).map(
    (f) => ({
      config: f,
      result:
        f.format === "original" ? { blob: file, size: file.size } : undefined,
      error: undefined,
    })
  ),
  viewport: { scale: 1, tx: 0, ty: 0 },
});
