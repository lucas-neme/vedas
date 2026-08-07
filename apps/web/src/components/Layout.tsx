import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BrandMark } from '@/components/BrandMark';
import { useAuth } from '@/contexts/AuthContext';
import { useBranding } from '@/contexts/BrandingContext';
import { initials } from '@/lib/format';

type Role = 'admin' | 'gerente' | 'operador';
type NavItem = { to: string; label: string; icon: string; roles?: Role[] };

const NAV_GROUPS: Array<{ title: string; items: NavItem[] }> = [
  {
    title: 'Operação',
    items: [
      { to: '/', label: 'Painel', icon: '📊' },
      { to: '/pdv', label: 'PDV / Nova venda', icon: '🛒' },
      { to: '/vendas', label: 'Vendas', icon: '🧾' },
      { to: '/notas-fiscais', label: 'Notas fiscais', icon: '📄' },
      { to: '/recebimentos', label: 'Contas a receber', icon: '💰' },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      { to: '/clientes', label: 'Clientes e pets', icon: '🐾' },
      { to: '/produtos', label: 'Produtos', icon: '📦' },
      { to: '/estoque', label: 'Estoque', icon: '🏷️' },
      { to: '/fornecedores', label: 'Fornecedores', icon: '🚚' },
      { to: '/categorias', label: 'Categorias e marcas', icon: '🗂️' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { to: '/relatorios', label: 'Relatórios', icon: '📈' },
      { to: '/configuracoes', label: 'Configurações', icon: '⚙️', roles: ['admin', 'gerente'] },
      { to: '/usuarios', label: 'Usuários', icon: '👥', roles: ['admin'] },
    ],
  },
];

const TITLES: Record<string, { title: string; subtitle: string }> = {
  '/': { title: 'Painel', subtitle: 'Visão geral da loja' },
  '/pdv': { title: 'PDV', subtitle: 'Registrar uma nova venda' },
  '/vendas': { title: 'Vendas', subtitle: 'Histórico e detalhes das vendas' },
  '/notas-fiscais': { title: 'Notas fiscais', subtitle: 'NF-e e NFC-e emitidas' },
  '/recebimentos': { title: 'Contas a receber', subtitle: 'Crediário e boletos em aberto' },
  '/clientes': { title: 'Clientes', subtitle: 'Tutores e seus pets' },
  '/produtos': { title: 'Produtos', subtitle: 'Catálogo da loja' },
  '/estoque': { title: 'Estoque', subtitle: 'Entradas, lotes, validades e perdas' },
  '/fornecedores': { title: 'Fornecedores', subtitle: 'Distribuidores e representantes' },
  '/categorias': { title: 'Categorias e marcas', subtitle: 'Organização do catálogo' },
  '/relatorios': { title: 'Relatórios', subtitle: 'Desempenho e oportunidades' },
  '/configuracoes': { title: 'Configurações', subtitle: 'Aparência, loja, responsável e fiscal' },
  '/usuarios': { title: 'Usuários', subtitle: 'Equipe com acesso ao sistema' },
};

const COLLAPSE_KEY = 'vedas.sidebar.collapsed';

export function Layout() {
  const { user, logout, can } = useAuth();
  const { branding, mode, toggleTheme } = useBranding();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  // Atalho: F2 abre o PDV de qualquer tela.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'F2') {
        event.preventDefault();
        navigate('/pdv');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);

  const base = `/${location.pathname.split('/')[1] ?? ''}`;
  const meta = TITLES[location.pathname] ?? TITLES[base] ?? { title: branding.app_name, subtitle: '' };

  return (
    <div
      className={`app-shell${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}
    >
      <div className="sidebar-scrim" onClick={() => setMobileOpen(false)} />

      <aside className="sidebar">
        <div className="sidebar-brand">
          <BrandMark />
          <span className="brand-text truncate">
            {branding.app_name}
            <small>{branding.app_tagline}</small>
          </span>
        </div>

        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.roles || can(...item.roles));
          if (!items.length) return null;
          return (
            <div key={group.title}>
              <div className="sidebar-group">{group.title}</div>
              <nav>
                {items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.to === '/'} title={item.label}>
                    <span className="icon">{item.icon}</span>
                    <span className="label-text">{item.label}</span>
                  </NavLink>
                ))}
              </nav>
            </div>
          );
        })}

        <div className="sidebar-footer">
          <div className="sidebar-user" style={{ cursor: 'default' }}>
            <span className="avatar">{initials(user?.name ?? '?')}</span>
            <div className="user-text" style={{ minWidth: 0 }}>
              <div className="truncate" style={{ color: 'var(--sidebar-fg-strong)', fontWeight: 600 }}>
                {user?.name}
              </div>
              <div style={{ fontSize: 11, textTransform: 'capitalize' }}>{user?.role}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="row" style={{ minWidth: 0 }}>
            <button
              type="button"
              className="icon-btn plain"
              onClick={() => {
                if (window.innerWidth <= 900) setMobileOpen((value) => !value);
                else setCollapsed((value) => !value);
              }}
              aria-label="Alternar menu"
              title="Alternar menu"
            >
              ☰
            </button>
            <div className="page-title">
              <h1 className="truncate">{meta.title}</h1>
              <span className="truncate">{meta.subtitle}</span>
            </div>
          </div>

          <div className="row">
            <NavLink to="/pdv" className="btn sm no-print">
              🛒 Nova venda <span className="kbd" style={{ marginLeft: 2 }}>F2</span>
            </NavLink>

            <button
              type="button"
              className="icon-btn"
              onClick={toggleTheme}
              aria-label="Alternar tema"
              title={mode === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            >
              {mode === 'dark' ? '☀️' : '🌙'}
            </button>

            <div style={{ position: 'relative' }} ref={menuRef}>
              <button
                type="button"
                className="icon-btn"
                onClick={() => setMenuOpen((value) => !value)}
                aria-label="Menu do usuário"
              >
                <span className="avatar" style={{ width: 26, height: 26, fontSize: 10.5 }}>
                  {initials(user?.name ?? '?')}
                </span>
              </button>

              {menuOpen ? (
                <div
                  className="card"
                  style={{
                    position: 'absolute',
                    right: 0,
                    top: 'calc(100% + 8px)',
                    minWidth: 216,
                    boxShadow: 'var(--shadow-md)',
                    zIndex: 50,
                  }}
                >
                  <div style={{ padding: '11px 14px', borderBottom: '1px solid var(--border)' }}>
                    <div className="strong truncate">{user?.name}</div>
                    <div className="text-xs muted truncate">{user?.email}</div>
                  </div>
                  <div style={{ padding: 6 }}>
                    {can('admin', 'gerente') ? (
                      <NavLink to="/configuracoes" className="btn ghost sm w-full" style={{ justifyContent: 'flex-start' }}>
                        ⚙️ Configurações
                      </NavLink>
                    ) : null}
                    {can('admin') ? (
                      <NavLink to="/usuarios" className="btn ghost sm w-full" style={{ justifyContent: 'flex-start' }}>
                        👥 Usuários
                      </NavLink>
                    ) : null}
                    <button
                      type="button"
                      className="btn ghost sm w-full"
                      style={{ justifyContent: 'flex-start', color: 'var(--danger-text)' }}
                      onClick={logout}
                    >
                      ⏻ Sair
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
