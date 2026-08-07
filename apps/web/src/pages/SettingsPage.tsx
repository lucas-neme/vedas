import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { BrandMark } from '@/components/BrandMark';
import { ErrorBox, Field, FieldsetTitle, Loading } from '@/components/ui';
import { useBranding } from '@/contexts/BrandingContext';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';
import { onlyDigits } from '@/lib/format';
import { COLOR_PRESETS, isValidHex } from '@/lib/theme';
import type { Branding, CompanySettings } from '@/types';

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR',
  'RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];

const EMOJI_OPTIONS = ['🐾', '🐶', '🐱', '🦴', '🐕', '🐈', '🏪', '🛒', '🥩', '🦜', '🐹', '🐟'];

const LOGO_MAX_BYTES = 800 * 1024;

type Tab = 'aparencia' | 'loja' | 'responsavel' | 'fiscal' | 'operacao';

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'aparencia', label: 'Aparência', icon: '🎨' },
  { key: 'loja', label: 'Dados da loja', icon: '🏪' },
  { key: 'responsavel', label: 'Responsável', icon: '👤' },
  { key: 'fiscal', label: 'Fiscal', icon: '📄' },
  { key: 'operacao', label: 'Operação', icon: '⚙️' },
];

export function SettingsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const branding = useBranding();
  const [tab, setTab] = useState<Tab>('aparencia');
  const [form, setForm] = useState<CompanySettings | null>(null);

  const settings = useQuery({
    queryKey: ['settings'],
    queryFn: () => api<CompanySettings>('/settings'),
  });

  useEffect(() => {
    if (settings.data) setForm(settings.data);
  }, [settings.data]);

  // Pré-visualiza a identidade visual enquanto o usuário edita; ao sair da
  // tela sem salvar, o branding real é restaurado.
  useEffect(() => {
    if (!form) return;
    branding.preview({
      app_name: form.app_name,
      app_tagline: form.app_tagline,
      logo_url: form.logo_url,
      logo_emoji: form.logo_emoji,
      primary_color: isValidHex(form.primary_color) ? form.primary_color : '#0f766e',
      accent_color: isValidHex(form.accent_color) ? form.accent_color : '#f59e0b',
      sidebar_style: form.sidebar_style,
      default_theme: form.default_theme,
      trade_name: form.trade_name,
    } satisfies Branding);
  }, [form]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => branding.preview(null), []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = useMutation({
    mutationFn: (payload: CompanySettings) => api('/settings', { method: 'PUT', body: payload }),
    onSuccess: () => {
      toast.success('Configurações salvas.');
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      branding.preview(null);
      branding.refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (settings.isLoading || !form) return <Loading label="Carregando configurações..." />;
  if (settings.error) return <ErrorBox error={settings.error} />;

  function set<K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) {
    setForm((current) => (current ? { ...current, [key]: value } : current));
  }

  return (
    <div className="stack">
      <div className="tabs pill">
        {TABS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={tab === item.key ? 'active' : ''}
            onClick={() => setTab(item.key)}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      {tab === 'aparencia' ? <AppearanceTab form={form} set={set} /> : null}
      {tab === 'loja' ? <StoreTab form={form} set={set} setForm={setForm} /> : null}
      {tab === 'responsavel' ? <OwnerTab form={form} set={set} /> : null}
      {tab === 'fiscal' ? <FiscalTab form={form} set={set} /> : null}
      {tab === 'operacao' ? <OperationTab form={form} set={set} /> : null}

      <div
        className="row between wrap"
        style={{
          position: 'sticky',
          bottom: 0,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          padding: '11px 14px',
          boxShadow: 'var(--shadow-md)',
        }}
      >
        <span className="text-sm muted">
          As alterações de aparência já aparecem na tela — clique em salvar para valer para toda a equipe.
        </span>
        <div className="row">
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              if (settings.data) setForm(settings.data);
              toast.notify('Alterações descartadas.');
            }}
            disabled={save.isPending}
          >
            Descartar
          </button>
          <button type="button" className="btn" onClick={() => save.mutate(form)} disabled={save.isPending}>
            {save.isPending ? <span className="spinner" /> : 'Salvar configurações'}
          </button>
        </div>
      </div>
    </div>
  );
}

type SetFn = <K extends keyof CompanySettings>(key: K, value: CompanySettings[K]) => void;

/* ── Aparência ────────────────────────────────────────────────────────────── */

function AppearanceTab({ form, set }: { form: CompanySettings; set: SetFn }) {
  const toast = useToast();
  const { mode, preference, setPreference } = useBranding();
  const fileRef = useRef<HTMLInputElement>(null);

  function onLogoFile(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      toast.error('Use uma imagem PNG, JPG, WEBP ou SVG.');
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      toast.error('A imagem deve ter no máximo 800 KB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set('logo_url', String(reader.result));
    reader.onerror = () => toast.error('Não foi possível ler o arquivo.');
    reader.readAsDataURL(file);
  }

  return (
    <div className="stack">
      <div className="grid cols-3">
        <div className="card span-2">
          <div className="card-header">
            <h2>Identidade do sistema</h2>
          </div>
          <div className="card-body">
            <div className="form-grid">
              <Field label="Nome do CRM" className="col-6" help="Aparece no menu, na aba do navegador e no login">
                <input
                  value={form.app_name}
                  maxLength={40}
                  onChange={(event) => set('app_name', event.target.value)}
                />
              </Field>
              <Field label="Slogan / subtítulo" className="col-6">
                <input
                  value={form.app_tagline}
                  maxLength={60}
                  onChange={(event) => set('app_tagline', event.target.value)}
                  placeholder="CRM Pet Shop"
                />
              </Field>

              <div className="col-12">
                <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                  Logo
                </label>
                <div className="row start mt-16" style={{ gap: 16, marginTop: 6 }}>
                  <div className="logo-preview">
                    {form.logo_url ? <img src={form.logo_url} alt="Logo" /> : (form.logo_emoji || '🐾')}
                  </div>
                  <div className="stack sm flex-1">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={(event) => onLogoFile(event.target.files?.[0])}
                    />
                    <span className="help">
                      PNG, JPG, WEBP ou SVG de até 800 KB. A imagem fica guardada no banco da loja —
                      não depende de nenhum serviço externo.
                    </span>
                    {form.logo_url ? (
                      <div>
                        <button
                          type="button"
                          className="btn secondary sm"
                          onClick={() => {
                            set('logo_url', '');
                            if (fileRef.current) fileRef.current.value = '';
                          }}
                        >
                          Remover logo
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className="help">Sem logo, usamos um emoji como marca:</span>
                        <div className="row wrap" style={{ gap: 5 }}>
                          {EMOJI_OPTIONS.map((emoji) => (
                            <button
                              key={emoji}
                              type="button"
                              className={`preset${form.logo_emoji === emoji ? ' active' : ''}`}
                              style={{ padding: '6px 10px', fontSize: 17 }}
                              onClick={() => set('logo_emoji', emoji)}
                            >
                              {emoji}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Prévia</h2>
          </div>
          <div className="card-body">
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  background: 'var(--sidebar-bg)',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <BrandMark />
                <div style={{ minWidth: 0 }}>
                  <div style={{ color: 'var(--sidebar-fg-strong)', fontWeight: 700, fontSize: 14 }}>
                    {form.app_name || 'Nome do CRM'}
                  </div>
                  <div style={{ color: 'var(--sidebar-muted)', fontSize: 11 }}>
                    {form.app_tagline || 'Slogan'}
                  </div>
                </div>
              </div>
              <div style={{ background: 'var(--sidebar-bg)', padding: '0 10px 12px' }}>
                <div
                  style={{
                    background: 'var(--sidebar-active)',
                    color: 'var(--sidebar-active-fg)',
                    borderRadius: 7,
                    padding: '7px 10px',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  📊 Painel
                </div>
                <div style={{ color: 'var(--sidebar-fg)', padding: '7px 10px', fontSize: 13 }}>
                  🛒 PDV / Nova venda
                </div>
              </div>
              <div className="card-body" style={{ background: 'var(--bg)' }}>
                <div className="stat accent" style={{ marginBottom: 10 }}>
                  <div className="label">Vendas hoje</div>
                  <div className="value sm">R$ 1.284,90</div>
                </div>
                <div className="row wrap" style={{ gap: 6 }}>
                  <button type="button" className="btn sm">
                    Botão
                  </button>
                  <button type="button" className="btn secondary sm">
                    Secundário
                  </button>
                  <span className="badge brand">Marca</span>
                  <span className="badge green">Ok</span>
                  <span className="badge amber">Atenção</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-header">
            <h2>Cores</h2>
          </div>
          <div className="card-body stack">
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Paletas prontas
              </label>
              <div className="preset-grid" style={{ marginTop: 7 }}>
                {COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    className={`preset${
                      form.primary_color.toLowerCase() === preset.primary &&
                      form.accent_color.toLowerCase() === preset.accent
                        ? ' active'
                        : ''
                    }`}
                    onClick={() => {
                      set('primary_color', preset.primary);
                      set('accent_color', preset.accent);
                    }}
                  >
                    <span className="swatches">
                      <span style={{ background: preset.primary }} />
                      <span style={{ background: preset.accent }} />
                    </span>
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-grid">
              <Field label="Cor principal" className="col-6" help="Botões, menu ativo e destaques">
                <div className="row">
                  <input
                    type="color"
                    style={{ width: 52 }}
                    value={isValidHex(form.primary_color) ? form.primary_color : '#0f766e'}
                    onChange={(event) => set('primary_color', event.target.value)}
                  />
                  <input
                    value={form.primary_color}
                    onChange={(event) => set('primary_color', event.target.value)}
                    className="mono"
                  />
                </div>
              </Field>
              <Field label="Cor de destaque" className="col-6" help="Alertas e indicadores secundários">
                <div className="row">
                  <input
                    type="color"
                    style={{ width: 52 }}
                    value={isValidHex(form.accent_color) ? form.accent_color : '#f59e0b'}
                    onChange={(event) => set('accent_color', event.target.value)}
                  />
                  <input
                    value={form.accent_color}
                    onChange={(event) => set('accent_color', event.target.value)}
                    className="mono"
                  />
                </div>
              </Field>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Tema e menu</h2>
          </div>
          <div className="card-body stack">
            <div>
              <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)' }}>
                Tema padrão da loja
              </label>
              <div className="row mt-16" style={{ gap: 9, marginTop: 7 }}>
                {(
                  [
                    { value: 'light', label: 'Claro', bg: '#ffffff', fg: '#0f172a' },
                    { value: 'dark', label: 'Escuro', bg: '#111827', fg: '#e2e8f0' },
                    { value: 'system', label: 'Do sistema', bg: 'linear-gradient(90deg,#ffffff 50%,#111827 50%)', fg: '#64748b' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={`theme-choice${form.default_theme === option.value ? ' active' : ''}`}
                    onClick={() => set('default_theme', option.value)}
                  >
                    <span
                      className="swatch-preview"
                      style={{ background: option.bg, color: option.fg }}
                    />
                    {option.label}
                  </button>
                ))}
              </div>
              <span className="help" style={{ display: 'block', marginTop: 6 }}>
                Cada pessoa pode trocar o tema no botão 🌙 da barra superior; a escolha individual
                tem prioridade sobre este padrão.
              </span>
            </div>

            <Field label="Estilo da barra lateral" className="col-12">
              <select
                value={form.sidebar_style}
                onChange={(event) =>
                  set('sidebar_style', event.target.value as CompanySettings['sidebar_style'])
                }
              >
                <option value="dark">Escura (padrão)</option>
                <option value="brand">Na cor da marca</option>
                <option value="light">Clara</option>
              </select>
            </Field>

            <div className="alert info">
              Seu tema neste dispositivo:{' '}
              <strong>{mode === 'dark' ? 'escuro' : 'claro'}</strong>
              {preference === 'system' ? ' (seguindo o sistema)' : ''}.{' '}
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => setPreference('system')}
                style={{ padding: '0 4px' }}
              >
                Voltar ao padrão da loja
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Dados da loja ────────────────────────────────────────────────────────── */

function StoreTab({
  form,
  set,
  setForm,
}: {
  form: CompanySettings;
  set: SetFn;
  setForm: React.Dispatch<React.SetStateAction<CompanySettings | null>>;
}) {
  const toast = useToast();

  async function lookupZip() {
    const zip = onlyDigits(form.zip_code);
    if (zip.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${zip}/json/`);
      const data = await response.json();
      if (data.erro) {
        toast.error('CEP não encontrado.');
        return;
      }
      setForm((current) =>
        current
          ? {
              ...current,
              street: data.logradouro ?? current.street,
              district: data.bairro ?? current.district,
              city: data.localidade ?? current.city,
              state: data.uf ?? current.state,
              city_ibge_code: data.ibge ?? current.city_ibge_code,
            }
          : current,
      );
    } catch {
      toast.error('Não foi possível consultar o CEP.');
    }
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="card-header">
          <h2>Dados profissionais</h2>
          <span className="text-sm muted">usados nos documentos fiscais</span>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <Field label="Razão social" className="col-8">
              <input value={form.corporate_name} onChange={(event) => set('corporate_name', event.target.value)} />
            </Field>
            <Field label="Nome fantasia" className="col-4">
              <input value={form.trade_name} onChange={(event) => set('trade_name', event.target.value)} />
            </Field>
            <Field label="CNPJ" className="col-3">
              <input value={form.document} onChange={(event) => set('document', event.target.value)} placeholder="00.000.000/0000-00" />
            </Field>
            <Field label="Inscrição estadual" className="col-3">
              <input
                value={form.state_registration}
                onChange={(event) => set('state_registration', event.target.value)}
                placeholder="ISENTO"
              />
            </Field>
            <Field label="Inscrição municipal" className="col-3">
              <input
                value={form.city_registration}
                onChange={(event) => set('city_registration', event.target.value)}
              />
            </Field>
            <Field label="Regime tributário (CRT)" className="col-3">
              <select
                value={form.tax_regime}
                onChange={(event) => set('tax_regime', event.target.value as CompanySettings['tax_regime'])}
              >
                <option value="1">1 - Simples Nacional</option>
                <option value="2">2 - Simples (excesso de sublimite)</option>
                <option value="3">3 - Regime Normal</option>
              </select>
            </Field>

            <FieldsetTitle>Endereço do estabelecimento</FieldsetTitle>

            <Field label="CEP" className="col-3">
              <div className="row">
                <input value={form.zip_code} onChange={(event) => set('zip_code', event.target.value)} onBlur={lookupZip} />
                <button type="button" className="btn secondary sm" onClick={lookupZip}>
                  Buscar
                </button>
              </div>
            </Field>
            <Field label="Logradouro" className="col-6">
              <input value={form.street} onChange={(event) => set('street', event.target.value)} />
            </Field>
            <Field label="Número" className="col-3">
              <input value={form.number} onChange={(event) => set('number', event.target.value)} />
            </Field>
            <Field label="Complemento" className="col-3">
              <input value={form.complement} onChange={(event) => set('complement', event.target.value)} />
            </Field>
            <Field label="Bairro" className="col-3">
              <input value={form.district} onChange={(event) => set('district', event.target.value)} />
            </Field>
            <Field label="Cidade" className="col-3">
              <input value={form.city} onChange={(event) => set('city', event.target.value)} />
            </Field>
            <Field label="UF" className="col-1">
              <select value={form.state} onChange={(event) => set('state', event.target.value)}>
                {UFS.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Código IBGE" className="col-2" help="Obrigatório para NF-e">
              <input value={form.city_ibge_code} onChange={(event) => set('city_ibge_code', event.target.value)} />
            </Field>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Contato e presença</h2>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <Field label="Telefone fixo" className="col-4">
              <input value={form.phone} onChange={(event) => set('phone', event.target.value)} />
            </Field>
            <Field label="WhatsApp da loja" className="col-4">
              <input value={form.whatsapp} onChange={(event) => set('whatsapp', event.target.value)} placeholder="(11) 99999-9999" />
            </Field>
            <Field label="E-mail" className="col-4">
              <input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} />
            </Field>
            <Field label="Instagram" className="col-4">
              <input value={form.instagram} onChange={(event) => set('instagram', event.target.value)} placeholder="@sualoja" />
            </Field>
            <Field label="Site" className="col-4">
              <input value={form.website} onChange={(event) => set('website', event.target.value)} placeholder="https://" />
            </Field>
            <Field label="Horário de funcionamento" className="col-4">
              <input
                value={form.business_hours}
                onChange={(event) => set('business_hours', event.target.value)}
                placeholder="Seg a Sex 8h-19h · Sáb 8h-14h"
              />
            </Field>
            <Field label="Mensagem no rodapé do cupom" className="col-12">
              <input
                value={form.receipt_footer}
                onChange={(event) => set('receipt_footer', event.target.value)}
                placeholder="Obrigado pela preferência!"
              />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Responsável ──────────────────────────────────────────────────────────── */

function OwnerTab({ form, set }: { form: CompanySettings; set: SetFn }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2>Dados pessoais do responsável</h2>
        <span className="text-sm muted">quem responde legalmente pela loja</span>
      </div>
      <div className="card-body">
        <div className="alert info mb-16">
          Estes dados ficam apenas no banco da sua loja. São usados para identificar o responsável
          em relatórios e no contato com o contador — não vão para a nota fiscal.
        </div>
        <div className="form-grid">
          <Field label="Nome completo" className="col-6">
            <input value={form.owner_name} onChange={(event) => set('owner_name', event.target.value)} />
          </Field>
          <Field label="CPF" className="col-3">
            <input
              value={form.owner_document}
              onChange={(event) => set('owner_document', event.target.value)}
              placeholder="000.000.000-00"
            />
          </Field>
          <Field label="Cargo / função" className="col-3">
            <input
              value={form.owner_role}
              onChange={(event) => set('owner_role', event.target.value)}
              placeholder="Proprietário(a)"
            />
          </Field>
          <Field label="Telefone pessoal" className="col-4">
            <input value={form.owner_phone} onChange={(event) => set('owner_phone', event.target.value)} />
          </Field>
          <Field label="E-mail pessoal" className="col-5">
            <input
              type="email"
              value={form.owner_email}
              onChange={(event) => set('owner_email', event.target.value)}
            />
          </Field>
          <Field label="Data de nascimento" className="col-3">
            <input
              type="date"
              value={form.owner_birth_date ?? ''}
              onChange={(event) => set('owner_birth_date', event.target.value || null)}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

/* ── Fiscal ───────────────────────────────────────────────────────────────── */

function FiscalTab({ form, set }: { form: CompanySettings; set: SetFn }) {
  return (
    <div className="stack">
      {form.nfe_environment === '2' ? (
        <div className="alert warn">
          O sistema está em <strong>ambiente de homologação</strong>: os documentos gerados não têm
          valor fiscal. Troque para produção somente depois de configurar o certificado digital A1 e
          validar a emissão com seu contador.
        </div>
      ) : (
        <div className="alert error">
          <strong>Ambiente de produção ativo.</strong> Todo documento emitido a partir de agora tem
          valor fiscal e precisa ser transmitido à SEFAZ.
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h2>Emissão de documentos</h2>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <Field label="Ambiente" className="col-4">
              <select
                value={form.nfe_environment}
                onChange={(event) =>
                  set('nfe_environment', event.target.value as CompanySettings['nfe_environment'])
                }
              >
                <option value="2">2 - Homologação (testes)</option>
                <option value="1">1 - Produção</option>
              </select>
            </Field>
            <Field label="Série NF-e (55)" className="col-2">
              <input type="number" min="1" value={form.nfe_series} onChange={(event) => set('nfe_series', Number(event.target.value))} />
            </Field>
            <Field label="Próximo nº NF-e" className="col-2">
              <input
                type="number"
                min="1"
                value={form.nfe_next_number}
                onChange={(event) => set('nfe_next_number', Number(event.target.value))}
              />
            </Field>
            <Field label="Série NFC-e (65)" className="col-2">
              <input type="number" min="1" value={form.nfce_series} onChange={(event) => set('nfce_series', Number(event.target.value))} />
            </Field>
            <Field label="Próximo nº NFC-e" className="col-2">
              <input
                type="number"
                min="1"
                value={form.nfce_next_number}
                onChange={(event) => set('nfce_next_number', Number(event.target.value))}
              />
            </Field>
            <Field label="ID do CSC (NFC-e)" className="col-3" help="Fornecido pela SEFAZ do seu estado">
              <input value={form.nfce_csc_id} onChange={(event) => set('nfce_csc_id', event.target.value)} />
            </Field>
            <Field label="Token CSC (NFC-e)" className="col-9">
              <input value={form.nfce_csc_token} onChange={(event) => set('nfce_csc_token', event.target.value)} />
            </Field>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Padrões do catálogo</h2>
          <span className="text-sm muted">aplicados a novos produtos</span>
        </div>
        <div className="card-body">
          <div className="form-grid">
            <Field label="NCM padrão" className="col-4" help="23091000 = ração para cães e gatos">
              <input value={form.default_ncm} onChange={(event) => set('default_ncm', event.target.value)} />
            </Field>
            <Field label="CFOP padrão" className="col-4" help="5102 = venda dentro do estado">
              <input value={form.default_cfop} onChange={(event) => set('default_cfop', event.target.value)} />
            </Field>
            <Field label="CSOSN padrão" className="col-4" help="102 = Simples sem crédito">
              <input value={form.default_csosn} onChange={(event) => set('default_csosn', event.target.value)} />
            </Field>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Operação ─────────────────────────────────────────────────────────────── */

function OperationTab({ form, set }: { form: CompanySettings; set: SetFn }) {
  return (
    <div className="card">
      <div className="card-header">
        <h2>Alertas e operação</h2>
      </div>
      <div className="card-body">
        <div className="form-grid">
          <Field
            label="Alertar validade com antecedência de (dias)"
            className="col-4"
            help="Lotes que vencem dentro desse prazo aparecem no painel e na tela de estoque"
          >
            <input
              type="number"
              min="1"
              max="365"
              value={form.expiry_alert_days}
              onChange={(event) => set('expiry_alert_days', Number(event.target.value))}
            />
          </Field>
          <Field label="Alerta de estoque mínimo" className="col-8">
            <label className="checkbox" style={{ paddingTop: 8 }}>
              <input
                type="checkbox"
                checked={form.low_stock_alert}
                onChange={(event) => set('low_stock_alert', event.target.checked)}
              />
              Destacar no painel os produtos com saldo igual ou abaixo do mínimo
            </label>
          </Field>
        </div>
      </div>
    </div>
  );
}
