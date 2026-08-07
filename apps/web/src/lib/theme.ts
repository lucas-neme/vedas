/**
 * Gera a paleta do sistema a partir das cores escolhidas em Configurações.
 * As variantes são derivadas em HSL para funcionar com qualquer cor de marca.
 */

export type ThemeMode = 'light' | 'dark';

type Hsl = { h: number; s: number; l: number };

export function hexToHsl(hex: string): Hsl {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;

  if (delta !== 0) {
    s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min);
    if (max === r) h = ((g - b) / delta + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / delta + 2) / 6;
    else h = ((r - g) / delta + 4) / 6;
  }

  return { h: h * 360, s: s * 100, l: l * 100 };
}

function css({ h, s, l }: Hsl, lightness?: number, saturation?: number): string {
  const finalL = Math.min(100, Math.max(0, lightness ?? l));
  const finalS = Math.min(100, Math.max(0, saturation ?? s));
  return `hsl(${h.toFixed(0)} ${finalS.toFixed(0)}% ${finalL.toFixed(0)}%)`;
}

/** Relative luminance, para decidir entre texto claro ou escuro sobre a cor. */
export function readableTextOn(hex: string): string {
  const clean = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => {
    const value = parseInt(clean.slice(offset, offset + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.55 ? '#0f172a' : '#ffffff';
}

export function isValidHex(value: string): boolean {
  return /^#[0-9a-fA-F]{6}$/.test(value);
}

export type BrandColors = {
  primary: string;
  accent: string;
  sidebarStyle: 'dark' | 'light' | 'brand';
};

/**
 * Escreve as variáveis CSS de marca no <html>. Os tokens de superfície
 * (fundo, texto, borda) vivem no styles.css e reagem ao data-theme.
 */
export function applyBrand(colors: BrandColors, mode: ThemeMode): void {
  const root = document.documentElement;
  const primary = isValidHex(colors.primary) ? colors.primary : '#0f766e';
  const accent = isValidHex(colors.accent) ? colors.accent : '#f59e0b';

  const p = hexToHsl(primary);
  const a = hexToHsl(accent);
  const dark = mode === 'dark';

  const set = (name: string, value: string) => root.style.setProperty(name, value);

  set('--brand', primary);
  set('--brand-hover', css(p, dark ? p.l + 8 : p.l - 8));
  set('--brand-active', css(p, dark ? p.l + 14 : p.l - 14));
  set('--brand-strong', css(p, dark ? 78 : Math.max(p.l - 22, 12)));
  set('--brand-soft', dark ? css(p, 20, Math.min(p.s, 45)) : css(p, 95, Math.min(p.s, 70)));
  set('--brand-soft-border', dark ? css(p, 28, Math.min(p.s, 45)) : css(p, 88, Math.min(p.s, 70)));
  set('--brand-soft-text', dark ? css(p, 78) : css(p, Math.max(p.l - 18, 18)));
  set('--brand-contrast', readableTextOn(primary));
  set('--brand-ring', dark ? css(p, 32, Math.min(p.s, 60)) : css(p, 88, Math.min(p.s, 80)));

  set('--accent', accent);
  set('--accent-soft', dark ? css(a, 22, Math.min(a.s, 50)) : css(a, 93, Math.min(a.s, 85)));
  set('--accent-soft-text', dark ? css(a, 78) : css(a, Math.max(a.l - 28, 20)));
  set('--accent-contrast', readableTextOn(accent));

  // Barra lateral
  if (colors.sidebarStyle === 'brand') {
    set('--sidebar-bg', css(p, dark ? 16 : Math.max(p.l - 26, 14)));
    set('--sidebar-fg', 'rgb(255 255 255 / 0.78)');
    set('--sidebar-fg-strong', '#ffffff');
    set('--sidebar-hover', 'rgb(255 255 255 / 0.10)');
    set('--sidebar-active', css(p, dark ? 34 : Math.min(p.l + 6, 46)));
    set('--sidebar-active-fg', '#ffffff');
    set('--sidebar-border', 'rgb(255 255 255 / 0.10)');
    set('--sidebar-muted', 'rgb(255 255 255 / 0.45)');
  } else if (colors.sidebarStyle === 'light') {
    set('--sidebar-bg', dark ? 'hsl(222 20% 13%)' : '#ffffff');
    set('--sidebar-fg', dark ? 'hsl(215 16% 70%)' : 'hsl(215 19% 35%)');
    set('--sidebar-fg-strong', dark ? '#ffffff' : 'hsl(222 47% 11%)');
    set('--sidebar-hover', dark ? 'rgb(255 255 255 / 0.06)' : 'hsl(210 40% 96%)');
    set('--sidebar-active', 'var(--brand-soft)');
    set('--sidebar-active-fg', 'var(--brand-soft-text)');
    set('--sidebar-border', dark ? 'rgb(255 255 255 / 0.08)' : 'hsl(214 32% 91%)');
    set('--sidebar-muted', dark ? 'rgb(255 255 255 / 0.40)' : 'hsl(215 16% 55%)');
  } else {
    set('--sidebar-bg', dark ? 'hsl(222 30% 9%)' : 'hsl(222 47% 11%)');
    set('--sidebar-fg', 'rgb(255 255 255 / 0.72)');
    set('--sidebar-fg-strong', '#ffffff');
    set('--sidebar-hover', 'rgb(255 255 255 / 0.07)');
    set('--sidebar-active', primary);
    set('--sidebar-active-fg', readableTextOn(primary));
    set('--sidebar-border', 'rgb(255 255 255 / 0.09)');
    set('--sidebar-muted', 'rgb(255 255 255 / 0.42)');
  }
}

export function applyThemeMode(mode: ThemeMode): void {
  document.documentElement.dataset.theme = mode;
  document.documentElement.style.colorScheme = mode;
}

export function resolveMode(preference: 'light' | 'dark' | 'system'): ThemeMode {
  if (preference === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return preference;
}

/** Paletas prontas oferecidas na tela de Configurações. */
export const COLOR_PRESETS: Array<{ name: string; primary: string; accent: string }> = [
  { name: 'Verde pet', primary: '#0f766e', accent: '#f59e0b' },
  { name: 'Azul confiança', primary: '#1d4ed8', accent: '#f97316' },
  { name: 'Laranja ração', primary: '#c2410c', accent: '#0d9488' },
  { name: 'Roxo premium', primary: '#6d28d9', accent: '#ec4899' },
  { name: 'Rosa carinho', primary: '#be185d', accent: '#0ea5e9' },
  { name: 'Grafite', primary: '#334155', accent: '#22c55e' },
  { name: 'Vermelho vivo', primary: '#b91c1c', accent: '#0284c7' },
  { name: 'Verde folha', primary: '#15803d', accent: '#a16207' },
];
