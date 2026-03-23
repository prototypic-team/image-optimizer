const isFile = (entry: FileSystemEntry): entry is FileSystemFileEntry =>
  entry.isFile;

const isDirectory = (
  entry: FileSystemEntry | null
): entry is FileSystemDirectoryEntry => !!entry && entry.isDirectory;

/** Reads all image files from directory (including nested). */
async function readFilesFromDirectory(
  dir: FileSystemEntry | null
): Promise<File[]> {
  if (!isDirectory(dir)) return [];

  const reader = dir.createReader();
  const files: File[] = [];

  function read(): Promise<void> {
    return new Promise((resolve, reject) => {
      reader.readEntries(
        (entries: FileSystemEntry[]) => {
          if (entries.length === 0) {
            resolve();
            return;
          }
          Promise.all(
            entries.map((entry) => {
              if (isFile(entry)) {
                return new Promise<void>((res, rej) => {
                  entry.file((f) => {
                    if (isImageFile(f)) files.push(f);
                    res();
                  }, rej);
                });
              }
              return readFilesFromDirectory(entry).then((nested) => {
                files.push(...nested);
              });
            })
          )
            .then(() => read())
            .then(resolve)
            .catch(reject);
        },
        (err) => reject(err ?? new Error("readEntries failed"))
      );
    });
  }

  return read().then(() => files);
}

const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".avif"];
const IMAGE_MIME_PREFIXES = ["image/"];

const isImageFile = (file: File): boolean => {
  if (IMAGE_MIME_PREFIXES.some((p) => file.type.startsWith(p))) return true;
  const name = file.name.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => name.endsWith(ext));
};

export async function collectFilesFromDrop(
  dataTransfer: DataTransfer | null
): Promise<File[]> {
  if (!dataTransfer) return [];
  const files: File[] = [];

  for (const item of dataTransfer.items) {
    if (item.kind === "string") continue;
    const entry = item.webkitGetAsEntry?.() ?? null;
    if (entry) {
      if (isFile(entry)) {
        const file = item.getAsFile();
        if (file && isImageFile(file)) files.push(file);
      } else {
        const dirFiles = await readFilesFromDirectory(entry);
        files.push(...dirFiles);
      }
    }
  }
  return files;
}

const ACCEPT_EXTENSIONS = IMAGE_EXTENSIONS.join(",");

type UseFilePickerOptions = {
  onFilesSelected: (files: File[]) => void;
};

export const useFilePicker = (options: UseFilePickerOptions) => {
  const { onFilesSelected } = options;

  const handleFileList = (files: FileList | File[] | null) => {
    if (!files) return;
    const imageFiles = Array.from(files).filter(isImageFile);
    if (imageFiles.length > 0) {
      onFilesSelected(imageFiles);
    }
  };

  const openFilePicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ACCEPT_EXTENSIONS;
    input.onchange = () => {
      handleFileList(input.files);
    };
    input.click();
  };

  const openFolderPicker = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.setAttribute("webkitdirectory", "");
    input.setAttribute("directory", "");
    input.onchange = () => {
      const files = input.files ? Array.from(input.files) : [];
      const imageFiles = files.filter(isImageFile);
      if (imageFiles.length > 0) {
        onFilesSelected(imageFiles);
      }
    };
    input.click();
  };

  return { openFilePicker, openFolderPicker, handleFileList };
};
