/** Chat media helpers shared by the DM and group composers (Amigos/Grupos).
 *  Uploads go straight to Cloudinary from the client (browser → CDN), so both
 *  chat surfaces stay in sync without server round-trips for the file blob. */

export const MAX_VIDEO_SECONDS = 30;
export const MAX_AUDIO_SECONDS = 120;
export const MAX_MEDIA_BYTES = 20 * 1024 * 1024;

export function validateVideoFile(file: File): void {
  if (file.type !== "video/mp4" && !/\.mp4$/i.test(file.name)) {
    throw new Error("Vídeos devem estar no formato MP4.");
  }
  if (file.size > MAX_MEDIA_BYTES) throw new Error("Vídeos devem ter no máximo 20 MB.");
}

export function validateMediaSize(file: File): void {
  if (file.size > MAX_MEDIA_BYTES) throw new Error("Arquivos devem ter no máximo 20 MB.");
}

/** Upload a media file to Cloudinary and return its secure URL (+ optional duration). */
export async function uploadToCloudinary(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<{ secureUrl: string; durationSeconds: number | undefined }> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
  if (!cloudName || !uploadPreset) throw new Error("Cloudinary não configurado.");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  // Imagens usam o endpoint de imagem; áudio e vídeo usam o de vídeo/raw.
  const isImage = file.type.startsWith("image/");
  const endpoint = isImage
    ? `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`
    : `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;

  const data = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", endpoint);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText) as Record<string, unknown>); } catch { reject(new Error("Resposta de upload inválida.")); }
      } else reject(new Error("Falha no upload."));
    };
    xhr.onerror = () => reject(new Error("Falha no upload."));
    xhr.send(formData);
  });
  const duration = Number(data.duration);
  return {
    secureUrl: data.secure_url as string,
    durationSeconds: Number.isFinite(duration) && duration > 0 ? Math.round(duration) : undefined,
  };
}

/** Reads a video's duration in seconds (0 if it can't be determined). */
export function readVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.onloadedmetadata = () => {
      const d = Number.isFinite(video.duration) ? video.duration : 0;
      URL.revokeObjectURL(url);
      resolve(Math.round(d));
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(0);
    };
    video.src = url;
  });
}