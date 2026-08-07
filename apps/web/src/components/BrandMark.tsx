import { useBranding } from '@/contexts/BrandingContext';
import type { Branding } from '@/types';

/** Logo da loja: usa a imagem enviada nas Configurações ou o emoji de fallback. */
export function BrandMark({
  size = 'md',
  branding,
}: {
  size?: 'md' | 'lg';
  branding?: Branding;
}) {
  const context = useBranding();
  const active = branding ?? context.branding;

  return (
    <span className={`brand-logo${size === 'lg' ? ' lg' : ''}`} aria-hidden>
      {active.logo_url ? (
        <img src={active.logo_url} alt="" />
      ) : (
        (active.logo_emoji || '🐾')
      )}
    </span>
  );
}
