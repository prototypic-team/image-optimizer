declare module "Types" {
  export type TEncodableFormat = "avif" | "jpeg" | "png" | "svg" | "webp";

  export type TAvifFormat = {
    format: "avif";
    quality: number;
    maxDimension?: number;
  };
  export type TJpegFormat = {
    format: "jpeg";
    quality: number;
    maxDimension?: number;
  };
  export type TPngFormat = {
    format: "png";
    quality: number;
    maxDimension?: number;
  };
  export type TWebpFormat = {
    format: "webp";
    quality: number;
    maxDimension?: number;
  };
  export type TSvgFormat = {
    format: "svg";
    /** Number of decimal places for path coordinates (0–8). */
    precision: number;
  };
  export type TOriginalFormat = { format: "original" };

  export type TFormat =
    | TAvifFormat
    | TJpegFormat
    | TPngFormat
    | TWebpFormat
    | TSvgFormat
    | TOriginalFormat;

  export type TFormatResult = {
    blob: Blob;
    size: number;
  };

  export type TWorkerRequest =
    | {
        type: "optimize";
        taskId: string;
        imageId: string;
        format: TFormat;
      }
    | { type: "evict"; imageId: string }
    | { type: "file"; imageId: string; file: File }
    | { type: "bitmap"; imageId: string; bitmap: ImageBitmap };

  export type TWorkerResponse =
    | {
        type: "result";
        taskId: string;
        buffer: ArrayBuffer;
        size: number;
        mimeType: string;
      }
    | { type: "complete"; taskId: string }
    | { type: "needsSource"; taskId: string }
    | { type: "needsBitmap"; taskId: string }
    | {
        type: "error";
        taskId: string;
        error: string;
      };
}
