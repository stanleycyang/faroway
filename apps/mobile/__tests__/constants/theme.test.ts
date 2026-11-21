import {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
  glass,
  travel,
  fontFamilies,
  bookingButtons,
} from '../../constants/theme';

describe('theme constants', () => {
  describe('colors', () => {
    it('has primary color scale', () => {
      expect(colors.primary[500]).toBe('#F97066');
      expect(colors.primary[50]).toBe('#FFF5F4');
      expect(colors.primary[900]).toBe('#7A241E');
    });

    it('has accent color scale', () => {
      expect(colors.accent[500]).toBe('#14B8A6');
    });

    it('has surface color scale', () => {
      expect(colors.surface[50]).toBe('#f8fafc');
      expect(colors.surface[900]).toBe('#0a0a0a');
    });

    it('has neutral color scale', () => {
      expect(colors.neutral[50]).toBe('#fafafa');
    });

    it('has semantic colors', () => {
      expect(colors.success).toBe('#22c55e');
      expect(colors.warning).toBe('#f59e0b');
      expect(colors.error).toBe('#ef4444');
      expect(colors.info).toBe('#3b82f6');
    });
  });

  describe('spacing', () => {
    it('has consistent spacing scale', () => {
      expect(spacing.xs).toBe(4);
      expect(spacing.sm).toBe(8);
      expect(spacing.md).toBe(16);
      expect(spacing.lg).toBe(24);
      expect(spacing.xl).toBe(32);
      expect(spacing['2xl']).toBe(48);
      expect(spacing['3xl']).toBe(64);
    });
  });

  describe('borderRadius', () => {
    it('has radius scale', () => {
      expect(borderRadius.sm).toBe(8);
      expect(borderRadius.md).toBe(12);
      expect(borderRadius.lg).toBe(16);
      expect(borderRadius.xl).toBe(24);
      expect(borderRadius.full).toBe(9999);
    });
  });

  describe('typography', () => {
    it('has h1 style', () => {
      expect(typography.h1.fontSize).toBe(32);
      expect(typography.h1.fontWeight).toBe('700');
    });

    it('has body style', () => {
      expect(typography.body.fontSize).toBe(16);
      expect(typography.body.fontWeight).toBe('400');
    });

    it('has caption style', () => {
      expect(typography.caption.fontSize).toBe(12);
    });
  });

  describe('shadows', () => {
    it('has sm shadow', () => {
      expect(shadows.sm.elevation).toBe(2);
    });

    it('has md shadow', () => {
      expect(shadows.md.elevation).toBe(4);
    });

    it('has lg shadow', () => {
      expect(shadows.lg.elevation).toBe(8);
    });

    it('has glow shadow', () => {
      expect(shadows.glow.shadowOpacity).toBe(0.35);
    });
  });

  describe('glass', () => {
    it('has light glass style', () => {
      expect(glass.light.borderWidth).toBe(1);
    });

    it('has medium glass style', () => {
      expect(glass.medium.borderWidth).toBe(1);
    });

    it('has dark glass style', () => {
      expect(glass.dark.borderWidth).toBe(1);
    });
  });

  describe('brand tokens and WCAG AA contrast', () => {
    function relativeLuminance(hex: string) {
      const clean = hex.replace('#', '');
      const [r, g, b] = [0, 2, 4].map((offset) => {
        const channel = parseInt(clean.slice(offset, offset + 2), 16) / 255;
        return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function contrastRatio(fg: string, bg: string) {
      const l1 = relativeLuminance(fg);
      const l2 = relativeLuminance(bg);
      return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    }

    it('exports brand font families, warm paper surface, and unified booking buttons', () => {
      expect(fontFamilies.sans).toBe('PlusJakartaSans');
      expect(fontFamilies.display).toBe('PlayfairDisplay');
      expect(typography.h1.fontFamily).toBe('PlayfairDisplay');
      expect(typography.body.fontFamily).toBe('PlusJakartaSans');
      expect(travel.ocean).toBe('#143D46');
      expect(travel.paperBg).toBe('#FAF8F3');
      expect(colors.action.primary).toBe('#C03A31');
      expect(bookingButtons.primaryBg).toBe('#C03A31');
      expect(bookingButtons.primaryText).toBe('#FFFFFF');
      expect(bookingButtons.oceanGradient).toEqual(['#143D46', '#0F2E35']);
    });

    it('satisfies WCAG AA (>= 4.5:1) for interactive brand text and button pairs', () => {
      expect(contrastRatio(colors.action.primary, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.action.primary, travel.paperBg)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.primary[800], '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(colors.surface[600], travel.paperBg)).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(bookingButtons.primaryText, bookingButtons.primaryBg)
      ).toBeGreaterThanOrEqual(4.5);
      expect(
        contrastRatio(bookingButtons.inverseText, bookingButtons.inverseBg)
      ).toBeGreaterThanOrEqual(4.5);
    });
  });
});
