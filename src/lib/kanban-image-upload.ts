export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;

export interface ImageUploadResult {
  url: string;
  path: string;
}

const ALLOWED_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp"]);

export function validateTaskImage(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  const supportedType = ALLOWED_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_IMAGE_TYPES)[number])
    || (file.type === "image/jpg" && ALLOWED_EXTENSIONS.has(extension));
  if (!supportedType || !ALLOWED_EXTENSIONS.has(extension)) return "Formato não suportado. Envie PNG, JPG ou WebP.";
  if (!file.size) return "O arquivo está vazio.";
  if (file.size > MAX_IMAGE_SIZE) return "A imagem deve ter no máximo 5 MB.";
  return null;
}

/** Resize large references and encode them as WebP when the browser can do so. */
export async function optimizeTaskImage(file: File): Promise<File> {
  if (typeof createImageBitmap !== "function") return file;

  const bitmap = await createImageBitmap(file);
  try {
    const maxDimension = 1600;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext("2d");
    if (!context) return file;
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.84));
    if (!blob || (scale === 1 && blob.size >= file.size)) return file;
    const baseName = file.name.replace(/\.[^.]+$/, "");
    return new File([blob], `${baseName}.webp`, { type: "image/webp", lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
