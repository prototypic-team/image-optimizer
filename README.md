# i0 — Image Optimizer

A browser-based image optimization tool. Drop or select images (or a folder with images) to compress them.

## Features

- Drag & drop images or folders
- Select images or folder via file picker
- Image list with before/after size
- Processing runs in web workers (via `browser-image-compression`)

## Tech Stack

- [Vite](https://vitejs.dev/) + [Solid.js](https://www.solidjs.com/)
- [jSquash](https://github.com/jamsinclair/jSquash) — Squoosh-derived WASM codecs for the browser:
  - `@jsquash/avif` (libavif)
  - `@jsquash/jpeg` (MozJPEG)
  - `@jsquash/png` (Rust PNG crate)
  - `@jsquash/webp` (libwebp)

## Scripts

- `npm run dev` — start dev server (port 3000)
- `npm run build` — production build
- `npm run serve` — preview production build
- `npm run lint` — ESLint
- `npm run style` — Stylelint
- `npm run types` — TypeScript check
