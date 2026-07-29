import { describe, it, expect, beforeAll } from "vitest";
import { BadRequestException } from "@nestjs/common";
import { UploadsService } from "./uploads.service.js";

const BASE = "http://localhost:9000/buffet-assets";
const ORG_A = "019f9181-2afb-7214-9a24-f7f5abe1a71a";
const ORG_B = "019f9025-65b6-72a6-860f-cf04239034f3";

let uploads: UploadsService;

beforeAll(() => {
  // O service lê o ambiente no construtor.
  process.env.PUBLIC_ASSET_BASE_URL = BASE;
  process.env.S3_BUCKET = "buffet-assets";
  uploads = new UploadsService();
});

describe("UploadsService.assertOwnedAssetUrl (RNF07/RNF05)", () => {
  it("aceita URL do bucket dentro do prefixo da própria organização", () => {
    const key = uploads.assertOwnedAssetUrl(
      ORG_A,
      `${BASE}/orgs/${ORG_A}/logo/abc.webp`
    );
    expect(key).toBe(`orgs/${ORG_A}/logo/abc.webp`);
  });

  it("rejeita URL do prefixo de outra organização", () => {
    expect(() =>
      uploads.assertOwnedAssetUrl(ORG_A, `${BASE}/orgs/${ORG_B}/logo/abc.webp`)
    ).toThrow(BadRequestException);
  });

  it("rejeita host externo, mesmo com o caminho certo", () => {
    expect(() =>
      uploads.assertOwnedAssetUrl(
        ORG_A,
        `https://evil.example.com/orgs/${ORG_A}/logo/abc.webp`
      )
    ).toThrow(BadRequestException);
  });

  it("rejeita esquemas não-http", () => {
    for (const url of [
      `javascript:alert(1)//${BASE}/orgs/${ORG_A}/x.webp`,
      `data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=`,
    ]) {
      expect(() => uploads.assertOwnedAssetUrl(ORG_A, url)).toThrow(
        BadRequestException
      );
    }
  });

  it("rejeita travessia de caminho que escaparia do prefixo", () => {
    expect(() =>
      uploads.assertOwnedAssetUrl(
        ORG_A,
        `${BASE}/orgs/${ORG_A}/../${ORG_B}/logo/abc.webp`
      )
    ).toThrow(BadRequestException);
  });

  it("rejeita um prefixo de org que só começa igual", () => {
    // `orgs/<ORG_A>extra/` não pode passar por "começa com orgs/<ORG_A>".
    expect(() =>
      uploads.assertOwnedAssetUrl(ORG_A, `${BASE}/orgs/${ORG_A}extra/logo/a.webp`)
    ).toThrow(BadRequestException);
  });
});

describe("UploadsService.presign (RNF07)", () => {
  it("deriva a chave do objeto a partir do organizationId, não do cliente", async () => {
    const { publicUrl, uploadUrl } = await uploads.presign(ORG_A, {
      scope: "package",
      contentType: "image/webp",
      size: 1024,
    });

    expect(publicUrl.startsWith(`${BASE}/orgs/${ORG_A}/package/`)).toBe(true);
    expect(publicUrl.endsWith(".webp")).toBe(true);
    // A URL gerada é aceita de volta pela validação — presign e persistência
    // concordam sobre o formato da chave.
    expect(() => uploads.assertOwnedAssetUrl(ORG_A, publicUrl)).not.toThrow();
    expect(uploads.assertOwnedAssetUrl(ORG_A, publicUrl)).toContain(
      `orgs/${ORG_A}/package/`
    );
    // E o PUT assinado aponta para o mesmo objeto, com prazo de validade.
    expect(uploadUrl).toContain(`orgs/${ORG_A}/package/`);
    expect(uploadUrl).toContain("X-Amz-Expires=60");
  });

  it("assina content-type e content-length, travando tipo e tamanho do envio", async () => {
    const { uploadUrl } = await uploads.presign(ORG_A, {
      scope: "cover",
      contentType: "image/png",
      size: 4096,
    });

    // Sem content-type na assinatura, o bucket aceitaria gravar um text/html
    // com a mesma URL — o objeto passaria a ser servido como HTML.
    const signed =
      new URL(uploadUrl).searchParams.get("X-Amz-SignedHeaders") ?? "";
    expect(signed.split(";")).toEqual(
      expect.arrayContaining(["content-type", "content-length", "host"])
    );
  });

  it("usa a extensão do content-type declarado", async () => {
    const jpg = await uploads.presign(ORG_A, {
      scope: "logo",
      contentType: "image/jpeg",
      size: 2048,
    });
    expect(jpg.publicUrl.endsWith(".jpg")).toBe(true);
  });
});
