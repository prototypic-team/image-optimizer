import { expect, test } from "bun:test";

import {
  configKey,
  guardFormatKey,
  guardPrecisionFormat,
  guardQualityFormat,
} from "./utils";

test("configKey is stable for key order and omits empty suffix", () => {
  expect(configKey({ format: "jpeg", quality: 80 })).toBe("jpeg_quality=80");
  expect(configKey({ quality: 80, format: "jpeg" })).toBe("jpeg_quality=80");
  expect(configKey({ format: "original" })).toBe("original");
});

test.each([
  {
    config: { format: "jpeg" as const, quality: 1, maxDimension: 999 },
    key: "jpeg_maxDimension=999_quality=1",
  },
  {
    config: { format: "webp" as const, quality: 75, maxDimension: 2048 },
    key: "webp_maxDimension=2048_quality=75",
  },
  {
    config: { format: "avif" as const, quality: 60, maxDimension: 800 },
    key: "avif_maxDimension=800_quality=60",
  },
])("configKey sorts optional fields for persistence ($key)", ({ config, key }) => {
  expect(configKey(config)).toBe(key);
});

test("guardFormatKey accepts known formats", () => {
  expect(guardFormatKey("webp")).toBe("webp");
});

test("guardFormatKey rejects unknown formats", () => {
  expect(() => guardFormatKey("gif")).toThrow("Invalid format key: gif");
});

test("guardQualityFormat returns format when quality applies", () => {
  const f = { format: "webp" as const, quality: 90 };
  expect(guardQualityFormat(f)).toEqual(f);
});

test("guardQualityFormat returns undefined for original", () => {
  expect(guardQualityFormat({ format: "original" })).toBeUndefined();
});

test("guardPrecisionFormat only matches svg", () => {
  expect(guardPrecisionFormat({ format: "svg", precision: 2 })).toEqual({
    format: "svg",
    precision: 2,
  });
  expect(guardPrecisionFormat({ format: "webp", quality: 1 })).toBeUndefined();
});
