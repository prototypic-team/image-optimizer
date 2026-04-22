import { expect, test } from "bun:test";

import { formatFileSize } from "./format";

test.each([
  [0, "0 B"],
  [1, "1 B"],
  [1023, "1023 B"],
  [1024, "1.0 KB"],
  [1536, "1.5 KB"],
  [10240, "10 KB"],
  [10239, "10.0 KB"],
  [1024 * 1024 - 1, "1024 KB"],
  [1024 * 1024, "1.0 MB"],
  [5 * 1024 * 1024, "5.0 MB"],
  [10 * 1024 * 1024, "10 MB"],
  [10 * 1024 * 1024 - 1, "10.0 MB"],
])("formatFileSize(%i bytes) → %s", (bytes, expected) => {
  expect(formatFileSize(bytes)).toBe(expected);
});
