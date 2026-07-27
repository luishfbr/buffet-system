import { api } from "./api";
import { MAX_IMAGE_BYTES, type UploadScope } from "@buffet/shared";

/** Lado maior da imagem depois do redimensionamento. */
const MAX_EDGE = 1600;
const WEBP_QUALITY = 0.82;

interface PresignedUpload {
  uploadUrl: string;
  publicUrl: string;
}

/**
 * Envia uma imagem ao bucket e devolve a URL definitiva (RNF07).
 *
 * O arquivo não passa pela API: ela só assina a autorização de escrita, e o
 * navegador faz o PUT direto. Antes disso a imagem é reduzida e reencodada em
 * WebP aqui mesmo — o que corta o peso do upload e normaliza o formato sem
 * precisar processar imagem no servidor.
 */
export async function uploadImage(
  file: File,
  scope: UploadScope
): Promise<string> {
  const blob = await toWebp(file);

  if (blob.size > MAX_IMAGE_BYTES) {
    throw new Error("Imagem muito grande, mesmo depois de reduzida.");
  }

  const { uploadUrl, publicUrl } = await api.post<PresignedUpload>(
    "/uploads/presign",
    { scope, contentType: blob.type, size: blob.size }
  );

  const res = await fetch(uploadUrl, {
    method: "PUT",
    body: blob,
    // Precisa bater com o que foi assinado, senão o bucket recusa.
    headers: { "Content-Type": blob.type },
  });
  if (!res.ok) {
    throw new Error("Não foi possível enviar a imagem. Tente de novo.");
  }

  return publicUrl;
}

/** Apaga o objeto do bucket. Falha aqui não é bloqueante para o usuário. */
export async function deleteImage(url: string): Promise<void> {
  await api.post("/uploads/delete", { url });
}

async function toWebp(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem.");
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Formatos que o navegador não decodifica (HEIC do iPhone, por exemplo).
    throw new Error("Formato não suportado. Use JPG, PNG ou WebP.");
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/webp", WEBP_QUALITY)
  );
  if (!blob || blob.type !== "image/webp") {
    throw new Error("Não foi possível processar a imagem.");
  }
  return blob;
}
