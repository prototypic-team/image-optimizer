import { expect, test } from "bun:test";

import { fromFile } from "./utils";

test("fromFile strips extension from name and keeps extension field", () => {
  const file = new File([new Uint8Array([1, 2, 3])], "vacation.JPEG", {
    type: "image/jpeg",
  });
  const img = fromFile(file);

  expect(img.name).toBe("vacation");
  expect(img.fileName).toBe("vacation.JPEG");
  expect(img.extension).toBe("JPEG");
});

test("fromFile uses raster default formats for non-SVG images", () => {
  const file = new File([], "pic.png", { type: "image/png" });
  const img = fromFile(file);

  expect(img.formats.map((f) => f.config.format)).toEqual([
    "original",
    "jpeg",
    "webp",
    "avif",
  ]);
  expect(img.formats[0].result?.blob).toBe(file);
  expect(img.formats[0].result?.size).toBe(file.size);
  expect(img.formats[1].result).toBeUndefined();
});

test("fromFile detects SVG by extension and uses SVG pipeline formats", () => {
  const file = new File([], "logo.svg", { type: "" });
  const img = fromFile(file);

  expect(img.formats.map((f) => f.config.format)).toEqual([
    "original",
    "svg",
    "webp",
    "avif",
  ]);
});

test("fromFile detects SVG by MIME type", () => {
  const file = new File([], "asset.bin", { type: "image/svg+xml" });
  const formats = fromFile(file).formats.map((f) => f.config.format);

  expect(formats).toContain("svg");
});
