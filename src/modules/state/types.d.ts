export type TFormatResult = {
  blob: Blob;
  size: number;
};

export type TImage = {
  id: string;
  name: string;
  fileName: string;
  extension: string;
  file: File;
  status: "pending" | "processing" | "done" | "error";
  weight: {
    original: number;
    optimized: number | undefined;
  };
  /** Keyed by configKey (e.g. "avif_q32", "png") */
  optimized?: Record<string, TFormatResult>;
  error?: string;
};

export type TImagesState = {
  images: Record<string, TImage>;
  imageOrder: string[];
  selectedImageId: string | undefined;
};
