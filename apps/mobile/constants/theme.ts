export const colors = {
  primary: {
    50: "#FFF5F4",
    100: "#FFE4E1",
    200: "#FDB4AF",
    300: "#FA8C84",
    400: "#F97066",
    500: "#F97066",
    600: "#E04D43",
    700: "#C03A31",
    800: "#9B2D25",
    900: "#7A241E",
  },
  accent: {
    50: "#F0FDFA",
    100: "#CCFBF1",
    200: "#99F6E4",
    300: "#5EEAD4",
    400: "#2DD4BF",
    500: "#14B8A6",
    600: "#0D9488",
    700: "#0F766E",
  },
  surface: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#1e293b",
    800: "#111827",
    900: "#0a0a0a",
    950: "#050505",
  },
  neutral: {
    50: "#fafafa",
    100: "#f5f5f5",
    200: "#e5e5e5",
    300: "#d4d4d4",
    400: "#a3a3a3",
    500: "#737373",
    600: "#525252",
    700: "#404040",
    800: "#262626",
    900: "#171717",
    950: "#0a0a0a",
  },
  success: "#22c55e",
  warning: "#f59e0b",
  error: "#ef4444",
  info: "#3b82f6",
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: "700" as const,
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: "600" as const,
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: "600" as const,
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    lineHeight: 24,
  },
  bodySmall: {
    fontSize: 14,
    fontWeight: "400" as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: "400" as const,
    lineHeight: 16,
  },
};

export const shadows = {
  sm: {
    shadowColor: "#F97066",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  md: {
    shadowColor: "#F97066",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  lg: {
    shadowColor: "#F97066",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 8,
  },
  glow: {
    shadowColor: "#FA8C84",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 6,
  },
};

// Glassmorphism helper values
export const glass = {
  light: {
    backgroundColor: "rgba(255,255,255,0.85)",
    borderColor: "#e2e8f0",
    borderWidth: 1,
  },
  medium: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: "#cbd5e1",
    borderWidth: 1,
  },
  dark: {
    backgroundColor: "rgba(0,0,0,0.4)",
    borderColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
  },
};
