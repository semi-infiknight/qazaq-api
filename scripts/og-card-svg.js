/**
 * OG social card SVG (1200×630) with CatalogueLoader-style ring + stack bars.
 * Used by scripts/generate-og.mjs to rasterize frames.
 */
const W = 1200;
const H = 630;

const CYAN = "#3dd6c3";
const TEAL_DIM = "rgba(26, 90, 82, 0.45)";
const TEXT = "#f2f2f2";
const MUTE = "#9a9a9a";

function barRects(barScales, barOpacities) {
  const widths = [0.88, 0.72, 0.56];
  const ys = [-14, 0, 14];
  const maxW = 148;
  return widths
    .map((frac, i) => {
      const w = maxW * frac * barScales[i];
      const y = ys[i];
      const opacity = barOpacities[i];
      return `<rect x="${-maxW / 2}" y="${y - 3}" width="${w}" height="6" rx="3" fill="url(#qzBar)" opacity="${opacity.toFixed(3)}"/>`;
    })
    .join("\n");
}

/**
 * @param {{ ringRotation?: number, dashOffset?: number, barScales?: number[], barOpacities?: number[] }} opts
 */
export function buildOgCardSvg(opts = {}) {
  const {
    ringRotation = 0,
    dashOffset = 0,
    barScales = [0.85, 0.75, 0.65],
    barOpacities = [0.55, 0.55, 0.55],
  } = opts;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="qzBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1a5a52" stop-opacity="0.35"/>
      <stop offset="45%" stop-color="${CYAN}"/>
      <stop offset="100%" stop-color="#e8b04a"/>
    </linearGradient>
    <radialGradient id="bgGlow" cx="50%" cy="42%" r="55%">
      <stop offset="0%" stop-color="${CYAN}" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#0a0a0a" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#0a0a0a"/>
  <rect width="${W}" height="${H}" fill="url(#bgGlow)"/>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="2"/>
  <text x="600" y="118" text-anchor="middle" fill="${TEXT}" font-family="Inter, system-ui, sans-serif" font-size="52" font-weight="700" letter-spacing="-0.02em">Qazaq Stack</text>
  <text x="600" y="168" text-anchor="middle" fill="${MUTE}" font-family="JetBrains Mono, ui-monospace, monospace" font-size="22" letter-spacing="0.12em">KAZAKHSTAN API CATALOGUE</text>
  <g transform="translate(600, 340)">
    <g transform="rotate(${ringRotation.toFixed(2)})">
      <circle cx="0" cy="0" r="86" fill="none" stroke="${TEAL_DIM}" stroke-width="2.5"/>
      <circle cx="0" cy="0" r="86" fill="none" stroke="${CYAN}" stroke-width="2.5" stroke-linecap="round"
        stroke-dasharray="104 424" stroke-dashoffset="${dashOffset.toFixed(2)}"/>
    </g>
    ${barRects(barScales, barOpacities)}
  </g>
  <text x="600" y="520" text-anchor="middle" fill="${MUTE}" font-family="JetBrains Mono, ui-monospace, monospace" font-size="20" letter-spacing="0.08em">SEARCH IT · STACK IT · SHIP IT</text>
  <text x="600" y="558" text-anchor="middle" fill="rgba(255,255,255,0.35)" font-family="Inter, system-ui, sans-serif" font-size="17">data.egov.kz · NBK · 2GIS · Kaspi · Kazhydromet · +7 telco</text>
</svg>`;
}

export const OG_WIDTH = W;
export const OG_HEIGHT = H;
