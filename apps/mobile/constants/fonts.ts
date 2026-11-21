import { Platform } from 'react-native';

/**
 * Canonical Faroway font families (brand/BRAND.md).
 * Pinned OFL variable TTF sources from apps/web/app/fonts/README.md
 * (Google Fonts commit 6157dfaa640ca5738b4d1a7070fe389c3036d7fc).
 */
export const FONT_FAMILIES = {
  sans: 'PlusJakartaSans',
  display: 'PlayfairDisplay',
  displayItalic: 'PlayfairDisplay-Italic',
} as const;

export const FONT_SOURCES = {
  [FONT_FAMILIES.sans]: {
    uri: 'https://raw.githubusercontent.com/google/fonts/6157dfaa640ca5738b4d1a7070fe389c3036d7fc/ofl/plusjakartasans/PlusJakartaSans%5Bwght%5D.ttf',
  },
  [FONT_FAMILIES.display]: {
    uri: 'https://raw.githubusercontent.com/google/fonts/6157dfaa640ca5738b4d1a7070fe389c3036d7fc/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf',
  },
  [FONT_FAMILIES.displayItalic]: {
    uri: 'https://raw.githubusercontent.com/google/fonts/6157dfaa640ca5738b4d1a7070fe389c3036d7fc/ofl/playfairdisplay/PlayfairDisplay-Italic%5Bwght%5D.ttf',
  },
} as const;

export const FONT_LOAD_TIMEOUT_MS = 1500;

export const SYSTEM_FONT_FALLBACKS = {
  sans: Platform.select({
    ios: 'System',
    android: 'sans-serif',
    web: '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif',
    default: 'sans-serif',
  }),
  display: Platform.select({
    ios: 'Georgia',
    android: 'serif',
    web: '"Playfair Display", Georgia, serif',
    default: 'serif',
  }),
} as const;
