import { configKey } from "~/modules/formats/utils";
import { mimeFromFileName } from "~/utils/files";

import { TFormat, TFormatResult, TImage, TPersistedImageMeta } from "Types";

export const toImage = (
  m: TPersistedImageMeta,
  buf: ArrayBuffer,
  optimizedBufs?: Record<string, ArrayBuffer>
): TImage => {
  const formats: {
    config: TFormat;
    result: TFormatResult | undefined;
    error: string | undefined;
  }[] = [];
  if (optimizedBufs) {
    for (const format of m.formats) {
      if (format.config.format === "original") {
        formats.push({
          config: format.config,
          result: { blob: new Blob([buf]), size: buf.byteLength },
          error: undefined,
        });
      } else {
        const key = configKey(format.config);
        const oBuf = optimizedBufs[key];
        const blob = oBuf
          ? new Blob([oBuf], { type: format.result?.mimeType ?? "" })
          : undefined;
        formats.push({
          config: format.config,
          result: blob ? { blob, size: oBuf.byteLength } : undefined,
          error: undefined,
        });
      }
    }
  }

  return {
    id: m.id,
    name: m.name,
    fileName: m.fileName,
    extension: m.extension,
    file: new File([buf], m.fileName, { type: mimeFromFileName(m.fileName) }),
    viewport: m.viewport,
    formats,
  };
};
