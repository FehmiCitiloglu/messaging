// Tasarım token'ları — frontend/app/globals.css içindeki @theme paletiyle
// birebir aynı değerler. Açık/koyu çözümü useThemeColors() ile alınır.

import type { TextStyle } from "react-native";

export const brand = {
  50: "#eef2ff",
  100: "#e0e7ff",
  200: "#c7d2fe",
  300: "#a5b4fc",
  400: "#818cf8",
  500: "#6366f1",
  600: "#4f46e5",
  700: "#4338ca",
  800: "#3730a3",
  900: "#312e81",
} as const;

export const slate = {
  50: "#f8fafc",
  100: "#f1f5f9",
  200: "#e2e8f0",
  300: "#cbd5e1",
  400: "#94a3b8",
  500: "#64748b",
  600: "#475569",
  700: "#334155",
  800: "#1e293b",
  900: "#0f172a",
} as const;

export const accents = {
  emerald400: "#34d399",
  emerald500: "#10b981",
  emerald600: "#059669",
  red200: "#fecaca",
  red300: "#fca5a5",
  red400: "#f87171",
  red500: "#ef4444",
  red600: "#dc2626",
  red700: "#b91c1c",
  amber400: "#fbbf24",
  amber500: "#f59e0b",
  amber600: "#d97706",
  sky200: "#bae6fd",
  fuchsia400: "#e879f9",
  fuchsia500: "#d946ef",
} as const;

/** Çözümlenmiş tema renkleri (açık/koyu). */
export interface ThemeColors {
  dark: boolean;
  // Marka
  brand50: string;
  brand100: string;
  brand300: string;
  brand400: string;
  brand500: string;
  brand600: string;
  brand700: string;
  // Yüzeyler
  canvas: string;
  panel: string;
  panelAlt: string;
  bubbleAlt: string;
  // Metin
  text: string;
  textMuted: string;
  textFaint: string;
  // Kenarlıklar / kontroller
  border: string;
  borderStrong: string;
  inputBg: string;
  skeleton: string;
  // Durum renkleri
  success: string;
  danger: string;
  dangerSoftBg: string;
  dangerSoftBorder: string;
  dangerSoftText: string;
  warnSoftBg: string;
  warnSoftBorder: string;
  warnSoftText: string;
  infoSoftBg: string;
  infoSoftBorder: string;
  infoSoftText: string;
  onBrand: string;
}

export const lightColors: ThemeColors = {
  dark: false,
  brand50: brand[50],
  brand100: brand[100],
  brand300: brand[300],
  brand400: brand[400],
  brand500: brand[500],
  brand600: brand[600],
  brand700: brand[700],
  canvas: "#f6f7fb",
  panel: "#ffffff",
  panelAlt: slate[50],
  bubbleAlt: "#f1f3f9",
  text: "#1e2537",
  textMuted: slate[500],
  textFaint: slate[400],
  border: "#e6eaf2",
  borderStrong: slate[200],
  inputBg: slate[50],
  skeleton: "rgba(148, 163, 184, 0.22)",
  success: accents.emerald600,
  danger: accents.red600,
  dangerSoftBg: "#fef2f2",
  dangerSoftBorder: accents.red200,
  dangerSoftText: accents.red700,
  warnSoftBg: "#fffbeb",
  warnSoftBorder: "#fde68a",
  warnSoftText: "#92400e",
  infoSoftBg: "#ffffff",
  infoSoftBorder: slate[200],
  infoSoftText: slate[600],
  onBrand: "#ffffff",
};

export const darkColors: ThemeColors = {
  dark: true,
  brand50: brand[900],
  brand100: brand[800],
  brand300: brand[300],
  brand400: brand[400],
  brand500: brand[500],
  brand600: brand[600],
  brand700: brand[700],
  canvas: "#0a0b10",
  panel: "#12141d",
  panelAlt: "#1a1d2a",
  bubbleAlt: "#222636",
  text: "#e6e8f0",
  textMuted: slate[400],
  textFaint: slate[500],
  border: slate[800],
  borderStrong: slate[700],
  inputBg: "#1a1d2a",
  skeleton: "rgba(148, 163, 184, 0.18)",
  success: accents.emerald400,
  danger: accents.red400,
  dangerSoftBg: "rgba(127, 29, 29, 0.4)",
  dangerSoftBorder: "rgba(127, 29, 29, 0.6)",
  dangerSoftText: accents.red300,
  warnSoftBg: "rgba(120, 53, 15, 0.4)",
  warnSoftBorder: "rgba(127, 51, 0, 0.6)",
  warnSoftText: "#fcd34d",
  infoSoftBg: "rgba(26, 29, 42, 0.95)",
  infoSoftBorder: slate[700],
  infoSoftText: "#f1f5f9",
  onBrand: "#ffffff",
};

// Tipografi ölçeği (globals.css @theme ile aynı punto karşılıkları).
export const fontSize = {
  "2xs": 11,
  xs: 12,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  "2xl": 24,
} satisfies Record<string, number>;

export const lineHeight = {
  "2xs": 16,
  xs: 17,
  sm: 19,
  base: 22,
  lg: 24,
  xl: 27,
  "2xl": 32,
} satisfies Record<string, number>;

/** --radius-bubble: 1.1rem */
export const BUBBLE_RADIUS = 18;
/** --radius-panel: 1rem */
export const PANEL_RADIUS = 16;

/** --shadow-soft / --shadow-pop (yumuşak gölgeler). */
export const SHADOW_SOFT = {
  shadowColor: "#0f172a",
  shadowOpacity: 0.08,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 2,
} as const;

export const SHADOW_POP = {
  shadowColor: "#0f172a",
  shadowOpacity: 0.16,
  shadowRadius: 24,
  shadowOffset: { width: 0, height: 12 },
  elevation: 6,
} as const;

/** Sık kullanılan tipografi stilleri. */
export const textStyle = {
  h1: { fontSize: fontSize.xl, lineHeight: lineHeight.xl, fontWeight: "700" },
  h2: { fontSize: fontSize.lg, lineHeight: lineHeight.lg, fontWeight: "600" },
  body: { fontSize: fontSize.base, lineHeight: lineHeight.base },
  small: { fontSize: fontSize.sm, lineHeight: lineHeight.sm },
  caption: { fontSize: fontSize.xs, lineHeight: lineHeight.xs },
  tiny: { fontSize: fontSize["2xs"], lineHeight: lineHeight["2xs"] },
} satisfies Record<string, TextStyle>;