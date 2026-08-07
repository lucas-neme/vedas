-- ─────────────────────────────────────────────────────────────────────────────
-- Identidade visual do sistema e dados do responsável pela loja.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE company_settings
  -- Identidade do CRM
  ADD COLUMN app_name        text NOT NULL DEFAULT 'Vedas',
  ADD COLUMN app_tagline     text NOT NULL DEFAULT 'CRM Pet Shop',
  ADD COLUMN logo_url        text NOT NULL DEFAULT '',   -- data URI ou URL externa
  ADD COLUMN logo_emoji      text NOT NULL DEFAULT '🐾', -- usado quando não há logo
  ADD COLUMN primary_color   text NOT NULL DEFAULT '#0f766e',
  ADD COLUMN accent_color    text NOT NULL DEFAULT '#f59e0b',
  ADD COLUMN sidebar_style   text NOT NULL DEFAULT 'dark'
                             CHECK (sidebar_style IN ('dark', 'light', 'brand')),
  ADD COLUMN default_theme   text NOT NULL DEFAULT 'light'
                             CHECK (default_theme IN ('light', 'dark', 'system')),

  -- Dados pessoais do responsável / proprietário
  ADD COLUMN owner_name      text NOT NULL DEFAULT '',
  ADD COLUMN owner_document  text NOT NULL DEFAULT '',   -- CPF
  ADD COLUMN owner_role      text NOT NULL DEFAULT 'Proprietário(a)',
  ADD COLUMN owner_phone     text NOT NULL DEFAULT '',
  ADD COLUMN owner_email     text NOT NULL DEFAULT '',
  ADD COLUMN owner_birth_date date,

  -- Contato público da loja
  ADD COLUMN whatsapp        text NOT NULL DEFAULT '',
  ADD COLUMN instagram       text NOT NULL DEFAULT '',
  ADD COLUMN website         text NOT NULL DEFAULT '',
  ADD COLUMN business_hours  text NOT NULL DEFAULT '',
  ADD COLUMN receipt_footer  text NOT NULL DEFAULT 'Obrigado pela preferência! 🐾';
