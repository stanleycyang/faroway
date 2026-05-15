import {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
  glass,
} from "../../constants/theme";

describe("theme constants", () => {
  describe("colors", () => {
    it("has primary color scale", () => {
      expect(colors.primary[500]).toBe("#F97066");
      expect(colors.primary[50]).toBe("#FFF5F4");
      expect(colors.primary[900]).toBe("#7A241E");
    });

    it("has accent color scale", () => {
      expect(colors.accent[500]).toBe("#14B8A6");
    });

    it("has surface color scale", () => {
      expect(colors.surface[50]).toBe("#f8fafc");
      expect(colors.surface[900]).toBe("#0a0a0a");
    });

    it("has neutral color scale", () => {
      expect(colors.neutral[50]).toBe("#fafafa");
    });

    it("has semantic colors", () => {
      expect(colors.success).toBe("#22c55e");
      expect(colors.warning).toBe("#f59e0b");
      expect(colors.error).toBe("#ef4444");
      expect(colors.info).toBe("#3b82f6");
    });
  });

  describe("spacing", () => {
    it("has consistent spacing scale", () => {
      expect(spacing.xs).toBe(4);
      expect(spacing.sm).toBe(8);
      expect(spacing.md).toBe(16);
      expect(spacing.lg).toBe(24);
      expect(spacing.xl).toBe(32);
      expect(spacing["2xl"]).toBe(48);
      expect(spacing["3xl"]).toBe(64);
    });
  });

  describe("borderRadius", () => {
    it("has radius scale", () => {
      expect(borderRadius.sm).toBe(8);
      expect(borderRadius.md).toBe(12);
      expect(borderRadius.lg).toBe(16);
      expect(borderRadius.xl).toBe(24);
      expect(borderRadius.full).toBe(9999);
    });
  });

  describe("typography", () => {
    it("has h1 style", () => {
      expect(typography.h1.fontSize).toBe(32);
      expect(typography.h1.fontWeight).toBe("700");
    });

    it("has body style", () => {
      expect(typography.body.fontSize).toBe(16);
      expect(typography.body.fontWeight).toBe("400");
    });

    it("has caption style", () => {
      expect(typography.caption.fontSize).toBe(12);
    });
  });

  describe("shadows", () => {
    it("has sm shadow", () => {
      expect(shadows.sm.elevation).toBe(2);
    });

    it("has md shadow", () => {
      expect(shadows.md.elevation).toBe(4);
    });

    it("has lg shadow", () => {
      expect(shadows.lg.elevation).toBe(8);
    });

    it("has glow shadow", () => {
      expect(shadows.glow.shadowOpacity).toBe(0.35);
    });
  });

  describe("glass", () => {
    it("has light glass style", () => {
      expect(glass.light.borderWidth).toBe(1);
    });

    it("has medium glass style", () => {
      expect(glass.medium.borderWidth).toBe(1);
    });

    it("has dark glass style", () => {
      expect(glass.dark.borderWidth).toBe(1);
    });
  });
});
