# i0 — Image Optimizer

A browser-based image optimization tool. Drop or select images to compress them. It converts image using formats supported by the majority of the modern browsers.

## Features

- Drag & drop images or folders
- Image list with before/after size
- Processing runs in web workers (via `browser-image-compression`)

## Tech Stack

- [Vite](https://vitejs.dev/) + [Solid.js](https://www.solidjs.com/)
- [jSquash](https://github.com/jamsinclair/jSquash) — Squoosh-derived WASM codecs for the browser:
  - `@jsquash/avif` (libavif)
  - `@jsquash/jpeg` (MozJPEG)
  - `@jsquash/webp` (libwebp)

## Scripts

- `npm run dev` — start dev server (port 3000)
- `npm run build` — production build
- `npm run serve` — preview production build
- `npm run lint` — ESLint
- `npm run style` — Stylelint
- `npm run types` — TypeScript check
