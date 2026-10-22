// The home banner: "¿Quién se pondrá en la brecha?" over a broken stone wall, light and fire
// pouring through the breach, and a warrior kneeling in prayer (Ezequiel 22:30).
// Drawn in SVG so it is sharp on every phone and weighs almost nothing.

// [x, y, size] of each little flame along the broken edges of the wall.
const FLAMES = [
  [34, 124, 0.7], [96, 120, 0.8], [122, 128, 1.3], [140, 137, 1.7], [157, 166, 1.5], [158, 202, 1.2], [152, 242, 1],
  [247, 238, 1], [248, 200, 1.2], [246, 162, 1.5], [260, 139, 1.7], [282, 128, 1.3], [308, 120, 0.8], [370, 123, 0.7],
];
// [x, y, radius, delay in s] of the embers that float up from the breach.
const EMBERS = [
  [172, 240, 1.4, 0], [188, 210, 1, 1.2], [214, 228, 1.6, 0.6], [230, 200, 1.1, 2], [160, 190, 1.2, 2.8],
  [242, 240, 1, 1.6], [200, 180, 1.3, 3.4], [134, 160, 1, 0.9], [268, 170, 1.2, 2.4], [120, 130, 0.9, 3],
];

// The group places the flame; the animation (which replaces any transform) runs on the inner <use>.
const flame = ([x, y, s], i) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><use href="#flame" class="flick" style="animation-delay:-${((i * 0.37) % 1.6).toFixed(2)}s"/></g>`;
const ember = ([x, y, r, delay]) =>
  `<circle class="ember" cx="${x}" cy="${y}" r="${r}" style="animation-delay:-${delay}s"/>`;

export function breachArt() {
  return `
  <section class="art" aria-label="¿Quién se pondrá en la brecha? Ezequiel 22:30">
    <svg viewBox="0 0 400 320" preserveAspectRatio="xMidYMax slice" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="glow" cx="200" cy="225" r="230" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#fff6d6"/>
          <stop offset=".16" stop-color="#ffd27a"/>
          <stop offset=".36" stop-color="#f08a2c"/>
          <stop offset=".62" stop-color="#8f2f10"/>
          <stop offset="1" stop-color="#1c0c06"/>
        </radialGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#b8662c"/>
          <stop offset="1" stop-color="#3a1c0c"/>
        </linearGradient>
        <linearGradient id="fire" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stop-color="#ff7a18"/>
          <stop offset=".55" stop-color="#ffb43a"/>
          <stop offset="1" stop-color="#fff0a8"/>
        </linearGradient>
        <radialGradient id="shade" cx="200" cy="230" r="220" gradientUnits="userSpaceOnUse">
          <stop offset=".25" stop-color="#ff9a3c" stop-opacity=".35"/>
          <stop offset=".6" stop-color="#000" stop-opacity=".15"/>
          <stop offset="1" stop-color="#000" stop-opacity=".7"/>
        </radialGradient>
        <pattern id="stones" width="120" height="72" patternUnits="userSpaceOnUse">
          <rect width="120" height="72" fill="#2e1d12"/>
          <g stroke="#24160d" stroke-width="1">
            <rect x="1" y="1" width="33" height="22" rx="5" fill="#7a5638"/>
            <rect x="36" y="2" width="27" height="21" rx="4" fill="#5e402a"/>
            <rect x="65" y="1" width="39" height="22" rx="6" fill="#8c6a48"/>
            <rect x="106" y="2" width="13" height="21" rx="3" fill="#6b4930"/>
            <rect x="-10" y="25" width="29" height="22" rx="5" fill="#6b4930"/>
            <rect x="110" y="25" width="29" height="22" rx="5" fill="#6b4930"/>
            <rect x="21" y="26" width="41" height="21" rx="6" fill="#835e3d"/>
            <rect x="64" y="25" width="25" height="22" rx="4" fill="#5a3c27"/>
            <rect x="91" y="26" width="17" height="21" rx="4" fill="#7a5638"/>
            <rect x="1" y="49" width="22" height="22" rx="4" fill="#8c6a48"/>
            <rect x="25" y="50" width="35" height="21" rx="5" fill="#6b4930"/>
            <rect x="62" y="49" width="31" height="22" rx="6" fill="#7a5638"/>
            <rect x="95" y="50" width="24" height="21" rx="4" fill="#5e402a"/>
          </g>
        </pattern>
        <radialGradient id="sky" cx="200" cy="0" r="240" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#c2461a" stop-opacity=".55"/>
          <stop offset="1" stop-color="#c2461a" stop-opacity="0"/>
        </radialGradient>
        <path id="flame" d="M0 0 C-7 -6 -6 -14 -1 -24 C0 -16 4 -15 3 -22 C9 -14 8 -5 0 0 Z" fill="url(#fire)"/>
        <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4"/></filter>
      </defs>

      <rect width="400" height="320" fill="url(#glow)"/>
      <rect width="400" height="320" fill="url(#sky)"/>
      <g fill="#fff3c4" opacity=".13">
        <polygon points="200,230 120,0 160,0"/>
        <polygon points="200,230 185,0 215,0"/>
        <polygon points="200,230 240,0 285,0"/>
        <polygon points="200,230 60,0 85,0"/>
        <polygon points="200,230 320,0 345,0"/>
      </g>
      <path d="M150 262 Q172 246 196 254 Q222 242 252 258 L252 280 L150 280 Z" fill="#8a3714" opacity=".55"/>
      <path d="M140 320 L156 292 Q200 282 246 292 L262 320 Z" fill="url(#ground)"/>

      <!-- the broken wall, left and right of the breach -->
      <g>
        <path d="M0 320 V126 L30 120 L60 128 L95 118 L125 127 L148 140 L162 176 L150 216 L158 262 L146 320 Z" fill="url(#stones)"/>
        <path d="M256 320 L244 264 L254 222 L242 182 L254 144 L278 126 L310 118 L345 128 L375 120 L400 126 V320 Z" fill="url(#stones)"/>
        <path d="M0 320 V126 L30 120 L60 128 L95 118 L125 127 L148 140 L162 176 L150 216 L158 262 L146 320 Z M256 320 L244 264 L254 222 L242 182 L254 144 L278 126 L310 118 L345 128 L375 120 L400 126 V320 Z" fill="url(#shade)"/>
        <path d="M125 127 L148 140 L162 176 L150 216 L158 262 L146 320 M256 320 L244 264 L254 222 L242 182 L254 144 L278 126" fill="none" stroke="#ff8a2a" stroke-width="5" opacity=".75" filter="url(#soft)"/>
      </g>

      <!-- fallen stones at the foot of the breach -->
      <g fill="#4a3020" stroke="#24160d">
        <path d="M146 304 l12 -6 l9 5 l-3 9 l-15 2 z"/>
        <path d="M160 314 l8 -4 l7 3 l-1 6 l-12 1 z"/>
        <path d="M238 306 l11 -5 l10 6 l-2 8 l-16 1 z"/>
        <path d="M226 315 l7 -3 l6 3 l-1 5 l-11 0 z"/>
      </g>

      <!-- a sword planted by the wall -->
      <g transform="translate(292 0)">
        <path d="M0 262 L0 314" stroke="#c9ccd1" stroke-width="3"/>
        <path d="M-9 268 H9" stroke="#5a4a3a" stroke-width="4" stroke-linecap="round"/>
        <path d="M0 252 V266" stroke="#3a2a1e" stroke-width="4"/>
        <circle cx="0" cy="251" r="2.6" fill="#5a4a3a"/>
      </g>

      <!-- the warrior kneeling in prayer, seen from behind -->
      <g fill="#1a0f09">
        <circle cx="200" cy="258" r="8"/>
        <path d="M186 271 Q200 264 214 271 L218 297 Q201 303 183 297 Z"/>
        <path d="M177 312 Q179 296 189 293 L213 293 Q225 297 226 312 Z"/>
      </g>
      <path d="M192 252 Q200 247 208 252" stroke="#ffcf7a" stroke-width="1.5" fill="none" opacity=".7"/>

      <g class="flames">${FLAMES.map(flame).join('')}</g>
      <g class="embers" fill="#ffc35a">${EMBERS.map(ember).join('')}</g>
    </svg>
    <h2 class="art-title"><span>¿Quién se pondrá</span><span class="small">en la</span><span class="big">Brecha?</span></h2>
  </section>`;
}
