declare module "Types" {
  export type TPersistedFormatMeta = {
    size: number;
    mimeType: string;
  };

  export type TPersistedQuadrantSetting =
    | { mode: "original" }
    | {
        mode: "encode";
        format: "avif" | "jpeg" | "png" | "webp";
        quality: number;
      };

  export type TPersistedImageMeta = MergeWithPriority<
    {
      optimized: Record<string, TPersistedFormatMeta>;
    },
    Omit<TImage, "file">
  >;

  export type TPersistedAppMeta = {
    version: typeof PERSISTENCE_VERSION;
    imageOrder: string[];
    selectedImageId: string | undefined;
    images: Record<string, TPersistedImageMeta>;
  };
}
