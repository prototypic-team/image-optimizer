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
          result: undefined,
          error: undefined,
        });
      } else {
        const key = configKey(format.config);
        const oBuf = optimizedBufs[key];
        if (!oBuf) continue;
        const blob = new Blob([oBuf], { type: format.result?.mimeType ?? "" });
        formats.push({
          config: format.config,
          result: { blob, size: oBuf.byteLength },
          error: format.error,
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
    weight: {
      original: m.weight.original,
      optimized: m.weight.optimized,
    },
    viewport: m.viewport,
    formats,
  };
};
