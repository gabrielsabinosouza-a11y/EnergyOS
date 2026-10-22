import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server-auth";
import { AppError } from "@/lib/errors";
import { ValidationError } from "@/lib/db/validation";
import { handleRoute, routeContext } from "@/lib/http";
import { rateLimitForProfile } from "@/lib/rate-limit";
import { MAX_IMAGE_SIZE, validateTaskImage } from "@/lib/kanban-image-upload";

export async function POST(request: NextRequest) {
  const context = routeContext(request);
  return handleRoute(async (ctx) => {
    const { profileId } = await requireAuth(request);
    ctx.profileId = profileId;
    rateLimitForProfile(profileId, "kanban-image-upload", 12, 60_000);

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      throw new ValidationError("Envie um arquivo de imagem válido.");
    }
    const entry = form.get("file");
    if (!entry || typeof entry === "string" || !(entry instanceof File)) {
      throw new ValidationError("Selecione uma imagem para enviar.");
    }
    const validationError = validateTaskImage(entry);
    if (validationError) throw new ValidationError(validationError);

    // The client can spoof MIME metadata; verify the actual file signature too.
    const bytes = new Uint8Array(await entry.arrayBuffer());
    const isPng = bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((byte, index) => bytes[index] === byte);
    const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isWebp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    const validSignature = entry.type === "image/png" ? isPng
      : entry.type === "image/webp" ? isWebp
        : (entry.type === "image/jpeg" || entry.type === "image/jpg") && isJpeg;
    if (!validSignature || bytes.length > MAX_IMAGE_SIZE) {
      throw new ValidationError("O conteúdo do arquivo não corresponde a um PNG, JPG ou WebP válido.");
    }

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;
    if (!cloudName || !uploadPreset) throw new AppError("O serviço de imagens não está configurado.");

    const upload = new FormData();
    upload.append("file", new Blob([bytes], { type: entry.type }), entry.name);
    upload.append("upload_preset", uploadPreset);
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, { method: "POST", body: upload });
    const result = await response.json().catch(() => ({})) as { secure_url?: string; public_id?: string; error?: { message?: string } };
    if (!response.ok || !result.secure_url || !result.public_id) {
      throw new AppError(result.error?.message ?? "Não foi possível enviar a imagem. Tente novamente.", 502);
    }

    let url: URL;
    try { url = new URL(result.secure_url); } catch { throw new AppError("O serviço retornou uma URL inválida.", 502); }
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || !url.pathname.startsWith(`/${cloudName}/image/upload/`)) {
      throw new AppError("O serviço retornou uma imagem inválida.", 502);
    }

    return NextResponse.json({ imageUrl: result.secure_url, imagePath: result.public_id });
  }, context);
}
