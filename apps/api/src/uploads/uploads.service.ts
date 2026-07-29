import { BadRequestException, Injectable } from "@nestjs/common";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { generateId } from "@buffet/db";
import {
  IMAGE_EXTENSIONS,
  type PresignUploadInput,
  type UploadScope,
} from "@buffet/shared";

/** Janela curta: a URL assinada só precisa sobreviver ao clique do usuário. */
const PRESIGN_TTL_SECONDS = 60;

export interface PresignedUpload {
  /** Destino do PUT do navegador. */
  uploadUrl: string;
  /** URL definitiva do objeto, é ela que fica salva no banco. */
  publicUrl: string;
}

/**
 * Upload de imagens da página pública (RNF07).
 *
 * O byte não passa pela API: o navegador recebe uma URL pré-assinada e envia o
 * arquivo direto ao bucket. As duas travas de isolamento estão aqui:
 *
 * 1. a chave do objeto é **derivada no servidor** a partir do `organizationId`,
 *    então o cliente não escolhe caminho e não escreve no prefixo de outro tenant;
 * 2. `assertOwnedAssetUrl` valida toda URL antes de ser persistida — sem isso,
 *    qualquer campo de imagem viraria um "cole a URL que quiser".
 */
@Injectable()
export class UploadsService {
  private readonly bucket = process.env.S3_BUCKET ?? "buffet-assets";
  private readonly publicBaseUrl = (
    process.env.PUBLIC_ASSET_BASE_URL ?? "http://localhost:9000/buffet-assets"
  ).replace(/\/+$/, "");

  private readonly client = new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    endpoint: process.env.S3_ENDPOINT ?? "http://localhost:9000",
    // Obrigatório no MinIO (bucket no path, não em subdomínio).
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID ?? "buffet",
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? "buffetdev123",
    },
  });

  async presign(
    orgId: string,
    input: PresignUploadInput
  ): Promise<PresignedUpload> {
    const key = this.buildKey(orgId, input.scope, input.contentType);

    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: input.contentType,
        ContentLength: input.size,
      }),
      {
        expiresIn: PRESIGN_TTL_SECONDS,
        // `content-type` precisa ser declarado explicitamente: por padrão o SDK
        // assina só `content-length;host`, e aí o bucket grava o tipo que o
        // cliente mandar — dava para publicar um text/html no host de assets.
        // Com ele na assinatura, divergir do tipo declarado devolve 403.
        signableHeaders: new Set(["content-type", "content-length", "host"]),
      }
    );

    return { uploadUrl, publicUrl: `${this.publicBaseUrl}/${key}` };
  }

  async remove(orgId: string, url: string): Promise<void> {
    const key = this.assertOwnedAssetUrl(orgId, url);
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key })
    );
  }

  /**
   * Aceita a URL apenas se ela apontar para o bucket configurado **e** para o
   * prefixo desta organização. Retorna a key do objeto.
   *
   * Todo endpoint que grava uma URL de imagem passa por aqui (RNF05/RNF07).
   */
  assertOwnedAssetUrl(orgId: string, url: string): string {
    const prefix = `${this.publicBaseUrl}/${this.orgPrefix(orgId)}`;
    if (!url.startsWith(prefix)) {
      throw new BadRequestException("Imagem inválida");
    }
    const key = url.slice(this.publicBaseUrl.length + 1);
    // Barra o `..` que escaparia do prefixo depois da checagem acima.
    if (key.includes("..") || key.includes("//")) {
      throw new BadRequestException("Imagem inválida");
    }
    return key;
  }

  /** `orgs/<orgId>/<scope>/<uuidv7>.<ext>` — nada vem do cliente. */
  private buildKey(
    orgId: string,
    scope: UploadScope,
    contentType: keyof typeof IMAGE_EXTENSIONS
  ): string {
    return `${this.orgPrefix(orgId)}${scope}/${generateId()}.${IMAGE_EXTENSIONS[contentType]}`;
  }

  private orgPrefix(orgId: string): string {
    return `orgs/${orgId}/`;
  }
}
