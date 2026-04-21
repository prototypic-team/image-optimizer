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
    weight: {
      original: number;
      optimized: number | undefined;
    };
    formats: {
      config: TFormat;
      result: TFormatResult | undefined;
      error: string | undefined;
    }[];
    viewport: TViewport;
  };

  export type TImagesState = {
    images: Record<string, TImage>;
    imageOrder: string[];
    selectedImageId: string | undefined;
  };
}
