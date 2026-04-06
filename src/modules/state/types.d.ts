export type TImage = {
  id: string;
  name: string;
  fileName: string;
  size: number;
  file: File;
  status: "pending" | "processing" | "done" | "error";
  optimizedSize?: number;
  error?: string;
};

export type TImagesState = {
  images: Record<string, TImage>;
  imageOrder: string[];
  selectedImageId: string | null;
};
