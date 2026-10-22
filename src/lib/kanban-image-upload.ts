import { useCallback, useState, useRef } from "react";

/** Image upload validation constants */
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

/** Upload result from Cloudinary */
export interface ImageUploadResult {
  url: string;
  path?: string;
  error?: string;
}

/** Hook for uploading task reference images via Cloudinary */
export function useTaskImageUpload() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = useCallback(async (file: File): Promise<ImageUploadResult> => {
    // Validate file type
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      const result: ImageUploadResult = { url: "", error: "Formato de imagem não suportado. Use PNG, JPG ou WebP." };
      setError(result.error);
      return result;
    }

    // Validate file size
    if (file.size > MAX_IMAGE_SIZE) {
      const result: ImageUploadResult = { url: "", error: "A imagem é muito grande. Máximo de 5MB." };
      setError(result.error);
      return result;
    }

    setUploading(true);
    setError(null);

    try {
      const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
      const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

      if (!cloudName || !uploadPreset) {
        throw new Error("Cloudinary não está configurado");
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("upload_preset", uploadPreset);

      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || "Falha no upload");
      }

      const data = await res.json();
      const result: ImageUploadResult = {
        url: data.secure_url,
        path: data.secure_url, // Store the same URL for simplicity
      };
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro desconhecido";
      setError(message);
      const result: ImageUploadResult = { url: "", error: message };
      return result;
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }, []);

  const triggerUpload = useCallback((input: HTMLInputElement) => {
    input.click();
  }, []);

  return {
    uploading,
    error,
    fileInputRef,
    uploadImage,
    triggerUpload,
    setError: (e: string | null) => setError(e),
  };
}

/** Get file extension from filename */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() ?? '';
}

/** Format file size for display */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0B";
  const k = 1024;
  const sizes = ["B", "KB", "MB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))}${sizes[i]}`;
}