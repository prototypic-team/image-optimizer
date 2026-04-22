import { expect, test } from "bun:test";

import { configKey } from "~/modules/formats/utils";

import { toImage } from "./utils";

import type { TPersistedImageMeta } from "Types";

const baseMeta = (): TPersistedImageMeta => ({
  id: "id-1",
  name: "shot",
  fileName: "shot.webp",
  extension: "webp",
  viewport: { scale: 1, tx: 0, ty: 0 },
  formats: [
    { config: { format: "original" }, result: undefined },
    {
      config: { format: "webp", quality: 80 },
      result: { size: 4, mimeType: "image/webp" },
    },
  ],
});

test("toImage restores original blob from buffer and optimized variant by key", () => {
  const buf = new Uint8Array([10, 11, 12]).buffer;
  const webpKey = configKey({ format: "webp", quality: 80 });
  const optimized = new Uint8Array([1, 2, 3, 4]).buffer;
  const img = toImage(baseMeta(), buf, { [webpKey]: optimized });

  expect(img.id).toBe("id-1");
  expect(img.file.name).toBe("shot.webp");
  expect(img.file.type).toBe("image/webp");

  const original = img.formats.find((f) => f.config.format === "original");
  expect(original?.result?.size).toBe(buf.byteLength);

  const webp = img.formats.find((f) => f.config.format === "webp");
  expect(webp?.result?.size).toBe(optimized.byteLength);
});

test("toImage leaves non-original result undefined when buffer key is missing", () => {
  const buf = new ArrayBuffer(0);
  const img = toImage(baseMeta(), buf, {});

  const webp = img.formats.find((f) => f.config.format === "webp");
  expect(webp?.result).toBeUndefined();
});

test("toImage yields empty formats when optimizedBufs is omitted", () => {
  const img = toImage(baseMeta(), new ArrayBuffer(0));

  expect(img.formats).toEqual([]);
});
