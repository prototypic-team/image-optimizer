import { expect, test } from "bun:test";

import { isImageFile, mimeFromFileName } from "./files";

test("mimeFromFileName maps common image extensions", () => {
  expect(mimeFromFileName("a.PNG")).toBe("image/png");
  expect(mimeFromFileName("b.JPG")).toBe("image/jpeg");
  expect(mimeFromFileName("c.jpeg")).toBe("image/jpeg");
  expect(mimeFromFileName("d.webp")).toBe("image/webp");
  expect(mimeFromFileName("e.avif")).toBe("image/avif");
  expect(mimeFromFileName("f.svg")).toBe("image/svg+xml");
});

test("mimeFromFileName falls back for unknown extensions", () => {
  expect(mimeFromFileName("data.bin")).toBe("application/octet-stream");
});

test.each([
  { name: "photo.png", type: "", expectImage: true },
  { name: "PHOTO.PNG", type: "", expectImage: true },
  { name: "x.jpeg", type: "", expectImage: true },
  { name: "x.jpg", type: "", expectImage: true },
  { name: "anim.gif", type: "", expectImage: true },
  { name: "tile.webp", type: "", expectImage: true },
  { name: "hero.avif", type: "", expectImage: true },
  { name: "icon.svg", type: "", expectImage: true },
  { name: "no-ext", type: "image/webp", expectImage: true },
  { name: "doc.pdf", type: "application/pdf", expectImage: false },
  { name: "readme.txt", type: "text/plain", expectImage: false },
])(
  "isImageFile($name, $type)",
  ({ name, type, expectImage: wantImage }) => {
    expect(isImageFile(new File([], name, { type }))).toBe(wantImage);
  }
);
