import { useState, type FormEvent } from 'react';
import { BrandMark } from '@/components/BrandMark';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';

export function LoginPage() {
  const { login } = useAuth();
  const { branding } = useBranding();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="brand">
          <BrandMark size="lg" />
          <div style={{ minWidth: 0 }}>
            <h1 style={{ fontSize: 20 }}>{branding.app_name}</h1>
            <span className="text-sm muted">{branding.app_tagline}</span>
          </div>
        </div>

        {error ? <div className="alert error mb-16">{error}</div> : null}

        <div className="stack">
          <div className="field">
            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="username"
              placeholder="voce@sualoja.com.br"
              autoFocus
              required
            />
          </div>
          <div className="field">
            <label htmlFor="password">Senha</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
            />
          </div>
          <button type="submit" className="btn lg block" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Entrar'}
          </button>
        </div>

        {branding.trade_name ? (
          <p className="text-xs muted" style={{ textAlign: 'center', marginBottom: 0, marginTop: 20 }}>
            {branding.trade_name}
          </p>
        ) : null}
      </form>
    </div>
  );
}
