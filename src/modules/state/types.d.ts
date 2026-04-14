declare module "Types" {
  export type TViewport = {
    scale: number;
    tx: number;
    ty: number;
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
    optimized: Record<string, TFormatResult>;
    formats: TFormat[];
    error?: string;
    viewport: TViewport;
  };

  export type TImagesState = {
    images: Record<string, TImage>;
    imageOrder: string[];
    selectedImageId: string | undefined;
  };
}
