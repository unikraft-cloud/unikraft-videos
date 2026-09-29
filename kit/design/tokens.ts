/**
 * Design tokens lifted from unikraft-cloud/www (apps/landing/src/styles/global.css,
 * Container.astro, Hero.astro), using the site's dark theme (`[data-theme="dark"]`).
 */

export const C = {
  black: '#000000',
  white: '#ffffff',

  // Tailwind slate (identical to --color-slate-*)
  slate50: '#f8fafc',
  slate100: '#f1f5f9',
  slate200: '#e2e8f0',
  slate300: '#cbd5e1',
  slate400: '#94a3b8',
  slate500: '#64748b',
  slate600: '#475569',
  slate700: '#334155',
  slate800: '#1e293b',
  slate900: '#0f172a',
  slate950: '#020617',

  // Brand blues (--color-blue-100…400 resolved from their hsl() values)
  blue50: '#eff6ff', // --color-primary in dark mode (body text)
  blue100: '#61a6fa', // eyebrows in dark mode
  blue200: '#3c83f6', // accent text in dark mode, primary button border
  blue300: '#2463eb', // primary button fill, terminal prompt
  blue400: '#0070f0', // --color-accent — THE Unikraft blue
  blueWave: '#318bf2',
  blueDeep: '#1d4ed8', // --background-image-blue-gradient start

  // Dark frame backgrounds (Container.astro dark variants)
  navy: '#0a1530', // tint-c radial core
  navyDeep: '#050a14', // tint-b top
  auraBlue: 'rgb(0 98 183)', // radial-aura-surface

  // Status colours
  red: '#f07160', // --color-red-100
  rose: '#e11d48', // TCB "warn" layers
  green: '#4ade80', // terminal success / "All systems operational"
  orange: '#ff9f29', // --color-orange-100

  // Logo gradient anchors
  logoBlue: '#0059e9',
  logoSky: '#00a2f6',
  logoCyan: '#00d9fd',
  logoTeal: '#00e8ce',
} as const;

/** Terminal palette (Hero.astro `.hero-terminal`). */
export const TERM = {
  bg: '#0b0e14',
  bar: '#11141b',
  text: '#e6e8ee',
  secondary: '#8a93a6',
  prompt: C.blue300,
  comment: '#6d7588',
  success: C.green,
  red: '#ff5f57',
  yellow: '#febc2e',
  greenDot: '#28c840',
} as const;

export const FONT = {
  sans: '"InterVariable", "Inter", system-ui, sans-serif',
  // Plex Mono has no geometric shapes (■ ● ○): the bundled Inter covers them, so renders don't depend on system fonts.
  mono: '"IBM Plex Mono", "InterVariable", ui-monospace, SFMono-Regular, Menlo, monospace',
} as const;

/** Site typography recipes, scaled for a 1920×1080 canvas. */
export const TYPE = {
  /** Display headline: `font-bold tracking-tighter leading-none`. */
  display: {
    fontFamily: FONT.sans,
    fontWeight: 700,
    letterSpacing: '-0.05em',
    lineHeight: 0.95,
  },
  /** Section title: `font-medium tracking-tight leading-[1.05]`. */
  title: {
    fontFamily: FONT.sans,
    fontWeight: 500,
    letterSpacing: '-0.035em',
    lineHeight: 1.05,
  },
  /** Mono eyebrow / label: `font-mono uppercase tracking-wider`. */
  eyebrow: {
    fontFamily: FONT.mono,
    fontWeight: 500,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
} as const;

/** `#rrggbb` → `rgba(r, g, b, a)`. */
export const alpha = (hex: string, a: number): string => {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

/** Linear blend of two `#rrggbb` colours. */
export const mix = (a: string, b: string, t: number): string => {
  const pa = a.replace('#', '');
  const pb = b.replace('#', '');
  const ch = (i: number) => {
    const va = parseInt(pa.slice(i, i + 2), 16);
    const vb = parseInt(pb.slice(i, i + 2), 16);
    return Math.round(va + (vb - va) * t)
      .toString(16)
      .padStart(2, '0');
  };
  return `#${ch(0)}${ch(2)}${ch(4)}`;
};

/** Safe margins for 1920×1080 (the site's `max-w-6xl px-5` column, scaled). */
export const SAFE = { x: 120, top: 64, bottom: 72 } as const;
