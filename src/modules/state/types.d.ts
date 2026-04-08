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
  error?: string;
};

export type TImagesState = {
  images: Record<string, TImage>;
  imageOrder: string[];
  selectedImageId: string | undefined;
};
