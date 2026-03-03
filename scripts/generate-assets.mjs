/**
 * Faroway Brand Asset Generator
 * Generates: logo, favicon, app icon, splash screen
 * Brand: Coral #F97066 + Navy #0F172A + White
 * Concept: Paper airplane leaving a curved AI-powered route
 */

import sharp from 'sharp';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const CORAL = '#F97066';
const CORAL_DARK = '#E85D52';
const NAVY = '#0F172A';
const WHITE = '#FFFFFF';
const GOLD = '#FBBF24';

// ─── Logo Mark SVG (the icon only, square) ──────────────────────────────────
// Concept: stylized paper airplane with a dotted arc trail, on coral circle background
function logoMarkSVG(size = 1024) {
  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.46; // circle radius
  
  // Paper airplane proportions scaled to size
  const scale = s / 1024;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF8A7A;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#F97066;stop-opacity:1" />
    </linearGradient>
    <linearGradient id="planeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FFFFFF;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#FFE4E1;stop-opacity:1" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="${4 * scale}" stdDeviation="${8 * scale}" flood-color="rgba(15,23,42,0.3)"/>
    </filter>
  </defs>
  
  <!-- Background circle -->
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#bgGrad)"/>
  
  <!-- Dotted arc trail (route path) - left to right, slight curve upward -->
  ${generateDots(s)}
  
  <!-- Paper airplane (pointing upper-right) -->
  ${paperAirplane(s)}
  
  <!-- Small AI sparkle stars -->
  ${sparkles(s)}
</svg>`;
}

function generateDots(s) {
  const scale = s / 1024;
  const dots = [];
  // Arc from lower-left to lower-right of the plane, suggesting route
  for (let i = 0; i < 7; i++) {
    const t = i / 8;
    // Quadratic bezier-like curve points
    const x = (200 + t * 280) * scale;
    const y = (640 - Math.sin(t * Math.PI) * 80 - t * 60) * scale;
    const r = (10 - i * 0.8) * scale;
    const opacity = 0.3 + t * 0.4;
    dots.push(`<circle cx="${x}" cy="${y}" r="${r}" fill="white" opacity="${opacity}"/>`);
  }
  return dots.join('\n  ');
}

function paperAirplane(s) {
  const scale = s / 1024;
  // Paper airplane pointing upper-right, centered-right in the circle
  // Main body triangle + fold
  const cx = 520 * scale;
  const cy = 480 * scale;
  
  // Rotate 35 degrees counter-clockwise from pointing right
  const angle = -35;
  
  return `<g transform="translate(${cx}, ${cy}) rotate(${angle})" filter="url(#shadow)">
    <!-- Main body -->
    <polygon points="${240 * scale},0 ${-120 * scale},${-90 * scale} ${-80 * scale},0" 
             fill="url(#planeGrad)" />
    <!-- Bottom wing -->
    <polygon points="${240 * scale},0 ${-120 * scale},${90 * scale} ${-80 * scale},0" 
             fill="white" opacity="0.85" />
    <!-- Center fold line -->
    <line x1="${-80 * scale}" y1="0" x2="${-120 * scale}" y2="${-90 * scale}" 
          stroke="rgba(249,112,102,0.3)" stroke-width="${3 * scale}"/>
    <!-- Tail flap -->
    <polygon points="${-80 * scale},0 ${-120 * scale},${90 * scale} ${-120 * scale},${20 * scale}" 
             fill="white" opacity="0.5" />
  </g>`;
}

function sparkles(s) {
  const scale = s / 1024;
  // 3 small star/sparkle shapes
  const stars = [
    { x: 720, y: 280, size: 28 },
    { x: 780, y: 340, size: 18 },
    { x: 700, y: 350, size: 14 },
  ];
  
  return stars.map(({ x, y, size }) => {
    const sx = x * scale;
    const sy = y * scale;
    const ss = size * scale;
    return `<path d="M${sx},${sy - ss} L${sx + ss * 0.25},${sy - ss * 0.25} L${sx + ss},${sy} L${sx + ss * 0.25},${sy + ss * 0.25} L${sx},${sy + ss} L${sx - ss * 0.25},${sy + ss * 0.25} L${sx - ss},${sy} L${sx - ss * 0.25},${sy - ss * 0.25} Z" fill="white" opacity="0.9"/>`;
  }).join('\n  ');
}

// ─── Wordmark SVG (icon + "faroway" text) ───────────────────────────────────
function wordmarkSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="160" viewBox="0 0 600 160">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF8A7A" />
      <stop offset="100%" style="stop-color:#F97066" />
    </linearGradient>
  </defs>
  
  <!-- Icon mark (scaled down) -->
  <g transform="scale(0.15) translate(10, 10)">
    ${logoMarkSVG(1024).replace(/<svg[^>]*>/, '').replace('</svg>', '')}
  </g>
  
  <!-- Faroway text -->
  <text x="175" y="108" 
        font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif"
        font-weight="700"
        font-size="72"
        letter-spacing="-2"
        fill="${NAVY}">faroway</text>
  
  <!-- Tagline -->
  <text x="177" y="132" 
        font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif"
        font-weight="400"
        font-size="18"
        letter-spacing="3"
        fill="#64748B">AI TRAVEL PLANNER</text>
</svg>`;
}

// ─── Splash Screen SVG ───────────────────────────────────────────────────────
function splashSVG(width = 1284, height = 2778) {
  const cx = width / 2;
  const cy = height / 2;
  const iconSize = Math.min(width, height) * 0.35;
  const iconX = cx - iconSize / 2;
  const iconY = cy - iconSize / 2 - height * 0.06;
  
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="splash-bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#0F172A" />
      <stop offset="60%" style="stop-color:#1E293B" />
      <stop offset="100%" style="stop-color:#0F172A" />
    </linearGradient>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF8A7A" />
      <stop offset="100%" style="stop-color:#F97066" />
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="${iconSize * 0.15}" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <filter id="shadow">
      <feDropShadow dx="0" dy="${iconSize * 0.04}" stdDeviation="${iconSize * 0.08}" flood-color="rgba(249,112,102,0.4)"/>
    </filter>
  </defs>
  
  <!-- Background -->
  <rect width="${width}" height="${height}" fill="url(#splash-bg)"/>
  
  <!-- Subtle radial glow behind icon -->
  <radialGradient id="glow-bg" cx="50%" cy="44%" r="40%">
    <stop offset="0%" style="stop-color:#F97066;stop-opacity:0.15" />
    <stop offset="100%" style="stop-color:transparent;stop-opacity:0" />
  </radialGradient>
  <rect width="${width}" height="${height}" fill="url(#glow-bg)"/>
  
  <!-- Decorative subtle dots grid -->
  ${splashDots(width, height)}
  
  <!-- Icon mark (centered) -->
  <g transform="translate(${iconX}, ${iconY}) scale(${iconSize / 1024})" filter="url(#shadow)">
    <circle cx="512" cy="512" r="${512 * 0.46}" fill="url(#bgGrad)"/>
    ${generateDots(1024)}
    ${paperAirplane(1024)}
    ${sparkles(1024)}
  </g>
  
  <!-- App name -->
  <text x="${cx}" y="${iconY + iconSize + height * 0.065}" 
        text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Helvetica Neue', sans-serif"
        font-weight="700"
        font-size="${width * 0.13}"
        letter-spacing="${-width * 0.003}"
        fill="white">faroway</text>
  
  <!-- Tagline -->
  <text x="${cx}" y="${iconY + iconSize + height * 0.11}" 
        text-anchor="middle"
        font-family="-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', sans-serif"
        font-weight="400"
        font-size="${width * 0.038}"
        letter-spacing="${width * 0.008}"
        fill="rgba(148,163,184,1)">AI TRAVEL PLANNER</text>
</svg>`;
}

function splashDots(w, h) {
  const dots = [];
  const spacing = Math.min(w, h) * 0.08;
  for (let x = 0; x < w; x += spacing) {
    for (let y = 0; y < h; y += spacing) {
      dots.push(`<circle cx="${x + spacing / 2}" cy="${y + spacing / 2}" r="1.5" fill="rgba(255,255,255,0.04)"/>`);
    }
  }
  return dots.join('');
}

// ─── Generate all assets ─────────────────────────────────────────────────────

async function svgToPng(svgStr, outputPath, width, height) {
  const buf = Buffer.from(svgStr);
  await sharp(buf, { density: 300 })
    .resize(width, height, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ quality: 100 })
    .toFile(outputPath);
  console.log(`✅ ${outputPath}`);
}

async function main() {
  // Dirs
  const webPublic = join(ROOT, 'apps/web/public');
  const mobileAssets = join(ROOT, 'apps/mobile/assets');
  const brandDir = join(ROOT, 'brand');
  mkdirSync(brandDir, { recursive: true });
  
  const iconSvg = logoMarkSVG(1024);
  const splashSvgStr = splashSVG(1284, 2778);
  
  // Save raw SVGs for reference
  writeFileSync(join(brandDir, 'icon.svg'), iconSvg);
  writeFileSync(join(brandDir, 'wordmark.svg'), wordmarkSVG());
  writeFileSync(join(brandDir, 'splash.svg'), splashSvgStr);
  console.log('✅ SVG sources saved to brand/');

  // --- Web assets ---
  // Favicon (32x32)
  await svgToPng(iconSvg, join(webPublic, 'favicon.png'), 32, 32);
  // Favicon ICO (just use 32px PNG — Next.js handles it)
  await svgToPng(iconSvg, join(webPublic, 'favicon-16.png'), 16, 16);
  await svgToPng(iconSvg, join(webPublic, 'favicon-32.png'), 32, 32);
  // PWA icons
  await svgToPng(iconSvg, join(webPublic, 'icon-192.png'), 192, 192);
  await svgToPng(iconSvg, join(webPublic, 'icon-512.png'), 512, 512);
  // OG / apple touch
  await svgToPng(iconSvg, join(webPublic, 'apple-touch-icon.png'), 180, 180);
  await svgToPng(iconSvg, join(webPublic, 'icon.png'), 512, 512);

  // --- Mobile assets ---
  // App icon (must be 1024x1024 for Expo)
  await svgToPng(iconSvg, join(mobileAssets, 'icon.png'), 1024, 1024);
  // Adaptive icon (Android, needs background)
  await svgToPng(iconSvg, join(mobileAssets, 'adaptive-icon.png'), 1024, 1024);
  // Favicon for mobile
  await svgToPng(iconSvg, join(mobileAssets, 'favicon.png'), 64, 64);
  // Notification icon (white on transparent)
  await generateNotificationIcon(join(mobileAssets, 'notification-icon.png'));
  
  // Splash screen (1284x2778 for iPhone 14 Pro Max)
  await svgToPng(splashSvgStr, join(mobileAssets, 'splash.png'), 1284, 2778);
  // Splash icon variant (just the mark for Expo splash background approach)
  await svgToPng(iconSvg, join(mobileAssets, 'splash-icon.png'), 512, 512);
  
  // --- Brand kit ---
  await svgToPng(iconSvg, join(brandDir, 'icon-1024.png'), 1024, 1024);
  await svgToPng(iconSvg, join(brandDir, 'icon-512.png'), 512, 512);
  await svgToPng(iconSvg, join(brandDir, 'icon-256.png'), 256, 256);
  await svgToPng(splashSvgStr, join(brandDir, 'splash-1284x2778.png'), 1284, 2778);

  console.log('\n🎉 All Faroway brand assets generated!');
}

async function generateNotificationIcon(outputPath) {
  // White plane on transparent background for Android notifications
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96">
    <g transform="translate(48, 48) rotate(-35)">
      <polygon points="40,0 -20,-15 -13,0" fill="white"/>
      <polygon points="40,0 -20,15 -13,0" fill="white" opacity="0.8"/>
    </g>
  </svg>`;
  await svgToPng(svg, outputPath, 96, 96);
}

main().catch(console.error);
