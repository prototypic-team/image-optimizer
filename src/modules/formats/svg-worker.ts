import { optimize as svgoOptimize } from "svgo";

import type { TWorkerRequest, TWorkerResponse } from "Types";

const filesByImageId = new Map<string, File>();

self.onmessage = async (e: MessageEvent<TWorkerRequest>) => {
  switch (e.data.type) {
    case "evict":
      filesByImageId.delete(e.data.imageId);
      return;

    case "file":
      filesByImageId.set(e.data.imageId, e.data.file);
      return;

    case "bitmap":
      return;

    case "optimize": {
      const { taskId, imageId, format } = e.data;

      if (format.format !== "svg") {
        self.postMessage({
          type: "error",
          taskId,
          error: `SVG worker received unexpected format: ${format.format}`,
        } satisfies TWorkerResponse);
        return;
      }

      if (!("precision" in format)) {
        self.postMessage({
          type: "error",
          taskId,
          error: `SVG worker received unexpected format: ${JSON.stringify(format)}`,
        } satisfies TWorkerResponse);
        return;
      }

      const file = filesByImageId.get(imageId);
      if (!file) {
        self.postMessage({
          type: "needsSource",
          taskId,
        } satisfies TWorkerResponse);
        return;
      }

      try {
        const svgText = await file.text();
        const result = svgoOptimize(svgText, {
          plugins: [
            {
              name: "preset-default",
              params: {
                overrides: {
                  convertPathData: { floatPrecision: format.precision },
                  cleanupNumericValues: { floatPrecision: format.precision },
                  roundTransforms: { floatPrecision: format.precision },
                },
              },
            },
          ],
        });

        const buffer = new TextEncoder().encode(result.data)
          .buffer as ArrayBuffer;
        const msg: TWorkerResponse = {
          type: "result",
          taskId,
          buffer,
          size: buffer.byteLength,
          mimeType: "image/svg+xml",
        };
        self.postMessage(msg);
      } catch (err) {
        self.postMessage({
          type: "error",
          taskId,
          error: err instanceof Error ? err.message : String(err),
        } satisfies TWorkerResponse);
      }
      return;
    }
  }
};
