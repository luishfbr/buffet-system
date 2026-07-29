import { describe, it, expect } from "vitest";
import { BRAND_COLORS, BRAND_PRESETS, PUBLIC_THEMES } from "./domain.js";

/**
 * A paleta da página pública é curada justamente para não depender do bom senso
 * de quem escolhe a cor. Este teste é quem garante isso: converte cada par
 * oklch para luminância relativa e cobra o contraste AA (4.5:1) do texto sobre
 * a cor de marca, nos dois temas.
 */

/** `oklch(L C H)` → sRGB linear (0–1), sem passar por gama. */
function oklchToLinearRgb(value: string): [number, number, number] {
  const match = value.match(
    /^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/
  );
  if (!match) throw new Error(`Cor fora do formato oklch(L C H): ${value}`);
  const [L, C, H] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ] as const;

  const hRad = (H * Math.PI) / 180;
  const a = C * Math.cos(hRad);
  const b = C * Math.sin(hRad);

  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;

  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function relativeLuminance(color: string): number {
  const [r, g, b] = oklchToLinearRgb(color).map((c) =>
    Math.min(1, Math.max(0, c))
  ) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort(
    (x, y) => y - x
  ) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

describe("BRAND_PRESETS (RF25)", () => {
  it("cobre todas as chaves declaradas em BRAND_COLORS", () => {
    expect(Object.keys(BRAND_PRESETS).sort()).toEqual([...BRAND_COLORS].sort());
  });

  it.each(BRAND_COLORS)("%s tem contraste AA nos dois temas", (key) => {
    const preset = BRAND_PRESETS[key];
    expect(preset.label.length).toBeGreaterThan(0);

    for (const theme of PUBLIC_THEMES) {
      const { brand, foreground } = preset[theme];
      expect(
        contrastRatio(brand, foreground),
        `${key}/${theme}: texto ilegível sobre a cor de marca`
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("mantém a marca clara no tema escuro, para destacar do fundo", () => {
    for (const key of BRAND_COLORS) {
      const lightness = Number(
        BRAND_PRESETS[key].dark.brand.match(/oklch\(\s*([\d.]+)/)![1]
      );
      expect(lightness, `${key}: cor escura demais no tema escuro`).toBeGreaterThan(
        0.6
      );
    }
  });
});
