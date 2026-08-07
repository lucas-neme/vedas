import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { applyBrand, applyThemeMode, resolveMode, type ThemeMode } from '@/lib/theme';
import type { Branding } from '@/types';

const THEME_KEY = 'vedas.theme';

export const DEFAULT_BRANDING: Branding = {
  app_name: 'Vedas',
  app_tagline: 'CRM Pet Shop',
  logo_url: '',
  logo_emoji: '🐾',
  primary_color: '#0f766e',
  accent_color: '#f59e0b',
  sidebar_style: 'dark',
  default_theme: 'light',
  trade_name: '',
};

type ThemePreference = 'light' | 'dark' | 'system';

type BrandingState = {
  branding: Branding;
  mode: ThemeMode;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
  /** Aplica um branding na hora, sem salvar — usado no preview das Configurações. */
  preview: (branding: Branding | null) => void;
  refresh: () => void;
};

const BrandingContext = createContext<BrandingState | null>(null);

function readStoredPreference(): ThemePreference | null {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : null;
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = useState<Branding>(DEFAULT_BRANDING);
  const [previewBranding, setPreviewBranding] = useState<Branding | null>(null);
  const [preference, setPreferenceState] = useState<ThemePreference>(
    () => readStoredPreference() ?? 'light',
  );
  const [hasStoredPreference, setHasStoredPreference] = useState(() => readStoredPreference() !== null);

  const active = previewBranding ?? branding;

  const load = useCallback(() => {
    api<Branding>('/public/branding')
      .then((data) => {
        setBranding(data);
        // Sem escolha manual do usuário, vale o tema definido nas Configurações.
        if (!readStoredPreference()) {
          setPreferenceState(data.default_theme);
          setHasStoredPreference(false);
        }
      })
      .catch(() => {
        /* mantém o branding padrão se a API ainda não respondeu */
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const mode = useMemo(() => resolveMode(preference), [preference]);

  useEffect(() => {
    applyThemeMode(mode);
    applyBrand(
      {
        primary: active.primary_color,
        accent: active.accent_color,
        sidebarStyle: active.sidebar_style,
      },
      mode,
    );
  }, [active, mode]);

  // Acompanha o sistema operacional quando a preferência é "system".
  useEffect(() => {
    if (preference !== 'system') return;
    const query = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => setPreferenceState('system');
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, [preference]);

  useEffect(() => {
    document.title = active.app_tagline
      ? `${active.app_name} · ${active.app_tagline}`
      : active.app_name;

    const emoji = active.logo_emoji || '🐾';
    const link =
      (document.querySelector("link[rel='icon']") as HTMLLinkElement | null) ??
      document.head.appendChild(Object.assign(document.createElement('link'), { rel: 'icon' }));
    link.href = active.logo_url
      ? active.logo_url
      : `data:image/svg+xml,${encodeURIComponent(
          `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">${emoji}</text></svg>`,
        )}`;
  }, [active]);

  const setPreference = useCallback((next: ThemePreference) => {
    localStorage.setItem(THEME_KEY, next);
    setHasStoredPreference(true);
    setPreferenceState(next);
  }, []);

  const toggleTheme = useCallback(() => {
    setPreference(resolveMode(preference) === 'dark' ? 'light' : 'dark');
  }, [preference, setPreference]);

  const value = useMemo(
    () => ({
      branding: active,
      mode,
      preference,
      setPreference,
      toggleTheme,
      preview: setPreviewBranding,
      refresh: () => {
        if (!hasStoredPreference) localStorage.removeItem(THEME_KEY);
        load();
      },
    }),
    [active, mode, preference, setPreference, toggleTheme, load, hasStoredPreference],
  );

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingState {
  const context = useContext(BrandingContext);
  if (!context) throw new Error('useBranding precisa estar dentro de <BrandingProvider>.');
  return context;
}
