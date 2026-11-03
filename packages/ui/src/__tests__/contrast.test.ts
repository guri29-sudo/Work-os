import { describe, it, expect } from "vitest";

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  }) as [number, number, number];
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hexToRgb(hex1));
  const l2 = relativeLuminance(hexToRgb(hex2));
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

describe("WCAG AA Contrast Conformance", () => {
  describe("Light Theme", () => {
    const surface = "#ffffff";
    const canvas = "#f8fafc";

    it("primary text meets AA (>= 4.5:1) on surface and canvas", () => {
      const primary = "#0f172a";
      expect(contrastRatio(primary, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(primary, canvas)).toBeGreaterThanOrEqual(4.5);
    });

    it("secondary text meets AA (>= 4.5:1) on surface and canvas", () => {
      const secondary = "#334155";
      expect(contrastRatio(secondary, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(secondary, canvas)).toBeGreaterThanOrEqual(4.5);
    });

    it("muted text meets AA (>= 4.5:1) on surface", () => {
      const muted = "#475569"; // Slate 600 for high-clarity AA body readability
      expect(contrastRatio(muted, surface)).toBeGreaterThanOrEqual(4.5);
    });

    it("indigo accent button has >= 3:1 on surface and >= 4.5:1 for button text", () => {
      const accent = "#4f46e5"; // Indigo 600 for strong contrast
      const white = "#ffffff";
      expect(contrastRatio(accent, surface)).toBeGreaterThanOrEqual(3.0);
      expect(contrastRatio(accent, white)).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe("Dark Theme", () => {
    const surface = "#0f172a";
    const canvas = "#090d16";

    it("primary text meets AA (>= 4.5:1) on dark surface and canvas", () => {
      const primary = "#f8fafc";
      expect(contrastRatio(primary, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(primary, canvas)).toBeGreaterThanOrEqual(4.5);
    });

    it("secondary text meets AA (>= 4.5:1) on dark surface and canvas", () => {
      const secondary = "#cbd5e1";
      expect(contrastRatio(secondary, surface)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(secondary, canvas)).toBeGreaterThanOrEqual(4.5);
    });

    it("muted text meets AA (>= 4.5:1) on dark surface", () => {
      const muted = "#94a3b8";
      expect(contrastRatio(muted, surface)).toBeGreaterThanOrEqual(4.5);
    });

    it("dark accent meets UI element ratio (>= 3:1)", () => {
      const accent = "#818cf8";
      expect(contrastRatio(accent, surface)).toBeGreaterThanOrEqual(3.0);
    });
  });
});