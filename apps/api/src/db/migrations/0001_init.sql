-- ─────────────────────────────────────────────────────────────────────────────
-- Vedas CRM · schema inicial
-- Loja de rações / pet shop: cadastros, estoque com lote e validade,
-- vendas e documentos fiscais.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Usuários ─────────────────────────────────────────────────────────────────
CREATE TABLE users (
  id            bigserial PRIMARY KEY,
  name          text NOT NULL,
  email         text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'operador'
                CHECK (role IN ('admin', 'gerente', 'operador')),
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Dados da empresa / parâmetros fiscais (linha única) ──────────────────────
CREATE TABLE company_settings (
  id                 integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  corporate_name     text NOT NULL DEFAULT 'Minha Loja de Rações LTDA',
  trade_name         text NOT NULL DEFAULT 'Vedas Pet',
  document           text NOT NULL DEFAULT '',            -- CNPJ
  state_registration text NOT NULL DEFAULT '',            -- IE
  city_registration  text NOT NULL DEFAULT '',            -- IM
  tax_regime         text NOT NULL DEFAULT '1'            -- CRT: 1 Simples, 2 Simples excesso, 3 Regime normal
                     CHECK (tax_regime IN ('1', '2', '3')),
  phone              text NOT NULL DEFAULT '',
  email              text NOT NULL DEFAULT '',
  zip_code           text NOT NULL DEFAULT '',
  street             text NOT NULL DEFAULT '',
  number             text NOT NULL DEFAULT '',
  complement         text NOT NULL DEFAULT '',
  district           text NOT NULL DEFAULT '',
  city               text NOT NULL DEFAULT '',
  city_ibge_code     text NOT NULL DEFAULT '',
  state              text NOT NULL DEFAULT 'SP',
  state_ibge_code    text NOT NULL DEFAULT '35',
  nfe_environment    text NOT NULL DEFAULT '2' CHECK (nfe_environment IN ('1', '2')),
  nfe_series         integer NOT NULL DEFAULT 1,
  nfe_next_number    integer NOT NULL DEFAULT 1,
  nfce_series        integer NOT NULL DEFAULT 1,
  nfce_next_number   integer NOT NULL DEFAULT 1,
  nfce_csc_id        text NOT NULL DEFAULT '',
  nfce_csc_token     text NOT NULL DEFAULT '',
  default_ncm        text NOT NULL DEFAULT '23091000',    -- alimentos para cães e gatos
  default_cfop       text NOT NULL DEFAULT '5102',
  default_csosn      text NOT NULL DEFAULT '102',
  low_stock_alert    boolean NOT NULL DEFAULT true,
  expiry_alert_days  integer NOT NULL DEFAULT 60,
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER company_settings_updated_at BEFORE UPDATE ON company_settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

INSERT INTO company_settings (id) VALUES (1);

-- ── Catálogo ─────────────────────────────────────────────────────────────────
CREATE TABLE categories (
  id          bigserial PRIMARY KEY,
  name        text NOT NULL UNIQUE,
  description text NOT NULL DEFAULT '',
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE brands (
  id         bigserial PRIMARY KEY,
  name       text NOT NULL UNIQUE,
  active     boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE suppliers (
  id           bigserial PRIMARY KEY,
  name         text NOT NULL,
  document     text NOT NULL DEFAULT '',
  contact_name text NOT NULL DEFAULT '',
  email        text NOT NULL DEFAULT '',
  phone        text NOT NULL DEFAULT '',
  zip_code     text NOT NULL DEFAULT '',
  street       text NOT NULL DEFAULT '',
  number       text NOT NULL DEFAULT '',
  district     text NOT NULL DEFAULT '',
  city         text NOT NULL DEFAULT '',
  state        text NOT NULL DEFAULT '',
  notes        text NOT NULL DEFAULT '',
  active       boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER suppliers_updated_at BEFORE UPDATE ON suppliers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE products (
  id                bigserial PRIMARY KEY,
  sku               text NOT NULL UNIQUE,
  barcode           text,
  name              text NOT NULL,
  description       text NOT NULL DEFAULT '',
  category_id       bigint REFERENCES categories(id) ON DELETE SET NULL,
  brand_id          bigint REFERENCES brands(id) ON DELETE SET NULL,
  supplier_id       bigint REFERENCES suppliers(id) ON DELETE SET NULL,
  -- específico de pet shop
  species           text NOT NULL DEFAULT 'geral'
                    CHECK (species IN ('cachorro','gato','ave','peixe','roedor','reptil','geral')),
  life_stage        text NOT NULL DEFAULT 'todos'
                    CHECK (life_stage IN ('filhote','adulto','senior','todos')),
  package_weight_kg numeric(10,3),                   -- peso do pacote (ração)
  unit              text NOT NULL DEFAULT 'UN',      -- UN, KG, CX, PC
  requires_batch    boolean NOT NULL DEFAULT true,   -- controla lote/validade
  cost_price        numeric(12,2) NOT NULL DEFAULT 0,
  sale_price        numeric(12,2) NOT NULL DEFAULT 0,
  stock_qty         numeric(12,3) NOT NULL DEFAULT 0,
  min_stock         numeric(12,3) NOT NULL DEFAULT 0,
  max_stock         numeric(12,3) NOT NULL DEFAULT 0,
  -- fiscal
  ncm               text NOT NULL DEFAULT '23091000',
  cest              text NOT NULL DEFAULT '',
  cfop              text NOT NULL DEFAULT '5102',
  origin            text NOT NULL DEFAULT '0',       -- 0 nacional
  csosn             text NOT NULL DEFAULT '102',
  cst_icms          text NOT NULL DEFAULT '',
  icms_rate         numeric(5,2) NOT NULL DEFAULT 0,
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX products_name_idx ON products (lower(name));
CREATE INDEX products_barcode_idx ON products (barcode);
CREATE INDEX products_category_idx ON products (category_id);

-- ── Lotes (validade é crítico em ração e medicamentos) ───────────────────────
CREATE TABLE product_batches (
  id          bigserial PRIMARY KEY,
  product_id  bigint NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_code  text NOT NULL,
  expires_at  date,
  qty         numeric(12,3) NOT NULL DEFAULT 0,
  cost_price  numeric(12,2) NOT NULL DEFAULT 0,
  received_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, batch_code)
);
CREATE INDEX product_batches_expiry_idx ON product_batches (expires_at)
  WHERE qty > 0;

-- ── Movimentações de estoque ─────────────────────────────────────────────────
CREATE TABLE stock_movements (
  id             bigserial PRIMARY KEY,
  product_id     bigint NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  batch_id       bigint REFERENCES product_batches(id) ON DELETE SET NULL,
  type           text NOT NULL
                 CHECK (type IN ('entrada','saida','ajuste','perda','devolucao')),
  qty            numeric(12,3) NOT NULL,   -- positivo entrada, negativo saída
  unit_cost      numeric(12,2) NOT NULL DEFAULT 0,
  balance_after  numeric(12,3) NOT NULL DEFAULT 0,
  reason         text NOT NULL DEFAULT '',
  reference_type text NOT NULL DEFAULT '', -- 'venda', 'compra', 'manual'
  reference_id   bigint,
  user_id        bigint REFERENCES users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX stock_movements_product_idx ON stock_movements (product_id, created_at DESC);
CREATE INDEX stock_movements_created_idx ON stock_movements (created_at DESC);

-- ── Clientes ─────────────────────────────────────────────────────────────────
CREATE TABLE customers (
  id                 bigserial PRIMARY KEY,
  person_type        text NOT NULL DEFAULT 'PF' CHECK (person_type IN ('PF','PJ')),
  name               text NOT NULL,
  trade_name         text NOT NULL DEFAULT '',
  document           text NOT NULL DEFAULT '',   -- CPF / CNPJ
  state_registration text NOT NULL DEFAULT '',
  email              text NOT NULL DEFAULT '',
  phone              text NOT NULL DEFAULT '',
  birth_date         date,
  zip_code           text NOT NULL DEFAULT '',
  street             text NOT NULL DEFAULT '',
  number             text NOT NULL DEFAULT '',
  complement         text NOT NULL DEFAULT '',
  district           text NOT NULL DEFAULT '',
  city               text NOT NULL DEFAULT '',
  city_ibge_code     text NOT NULL DEFAULT '',
  state              text NOT NULL DEFAULT '',
  notes              text NOT NULL DEFAULT '',
  credit_limit       numeric(12,2) NOT NULL DEFAULT 0,
  active             boolean NOT NULL DEFAULT true,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX customers_name_idx ON customers (lower(name));
CREATE UNIQUE INDEX customers_document_idx ON customers (document)
  WHERE document <> '';

-- ── Pets do cliente ──────────────────────────────────────────────────────────
CREATE TABLE pets (
  id                bigserial PRIMARY KEY,
  customer_id       bigint NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name              text NOT NULL,
  species           text NOT NULL DEFAULT 'cachorro'
                    CHECK (species IN ('cachorro','gato','ave','peixe','roedor','reptil','outro')),
  breed             text NOT NULL DEFAULT '',
  size              text NOT NULL DEFAULT 'medio'
                    CHECK (size IN ('mini','pequeno','medio','grande','gigante')),
  birth_date        date,
  weight_kg         numeric(6,2),
  neutered          boolean NOT NULL DEFAULT false,
  -- base para a previsão de recompra de ração
  food_product_id   bigint REFERENCES products(id) ON DELETE SET NULL,
  daily_food_grams  numeric(8,2),
  notes             text NOT NULL DEFAULT '',
  active            boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER pets_updated_at BEFORE UPDATE ON pets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX pets_customer_idx ON pets (customer_id);

-- ── Vendas ───────────────────────────────────────────────────────────────────
CREATE SEQUENCE sales_number_seq START 1;

CREATE TABLE sales (
  id             bigserial PRIMARY KEY,
  number         integer NOT NULL UNIQUE DEFAULT nextval('sales_number_seq'),
  customer_id    bigint REFERENCES customers(id) ON DELETE SET NULL,
  user_id        bigint REFERENCES users(id) ON DELETE SET NULL,
  status         text NOT NULL DEFAULT 'confirmada'
                 CHECK (status IN ('rascunho','confirmada','cancelada')),
  channel        text NOT NULL DEFAULT 'balcao'
                 CHECK (channel IN ('balcao','whatsapp','delivery','marketplace')),
  items_total    numeric(12,2) NOT NULL DEFAULT 0,
  discount       numeric(12,2) NOT NULL DEFAULT 0,
  freight        numeric(12,2) NOT NULL DEFAULT 0,
  total          numeric(12,2) NOT NULL DEFAULT 0,
  cost_total     numeric(12,2) NOT NULL DEFAULT 0,
  notes          text NOT NULL DEFAULT '',
  sold_at        timestamptz NOT NULL DEFAULT now(),
  cancelled_at   timestamptz,
  cancel_reason  text NOT NULL DEFAULT '',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER sales_updated_at BEFORE UPDATE ON sales
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX sales_sold_at_idx ON sales (sold_at DESC);
CREATE INDEX sales_customer_idx ON sales (customer_id);

CREATE TABLE sale_items (
  id          bigserial PRIMARY KEY,
  sale_id     bigint NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id  bigint REFERENCES products(id) ON DELETE SET NULL,
  batch_id    bigint REFERENCES product_batches(id) ON DELETE SET NULL,
  description text NOT NULL,
  qty         numeric(12,3) NOT NULL,
  unit_price  numeric(12,2) NOT NULL,
  discount    numeric(12,2) NOT NULL DEFAULT 0,
  unit_cost   numeric(12,2) NOT NULL DEFAULT 0,
  total       numeric(12,2) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sale_items_sale_idx ON sale_items (sale_id);
CREATE INDEX sale_items_product_idx ON sale_items (product_id);

CREATE TABLE sale_payments (
  id           bigserial PRIMARY KEY,
  sale_id      bigint NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  method       text NOT NULL
               CHECK (method IN ('dinheiro','pix','debito','credito','boleto','crediario','transferencia')),
  amount       numeric(12,2) NOT NULL,
  installments integer NOT NULL DEFAULT 1,
  due_date     date,
  paid         boolean NOT NULL DEFAULT true,
  paid_at      timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sale_payments_sale_idx ON sale_payments (sale_id);
CREATE INDEX sale_payments_due_idx ON sale_payments (due_date) WHERE paid = false;

-- ── Documentos fiscais ───────────────────────────────────────────────────────
CREATE TABLE invoices (
  id           bigserial PRIMARY KEY,
  sale_id      bigint REFERENCES sales(id) ON DELETE SET NULL,
  model        text NOT NULL DEFAULT '55' CHECK (model IN ('55','65')), -- 55 NF-e, 65 NFC-e
  series       integer NOT NULL,
  number       integer NOT NULL,
  access_key   text NOT NULL UNIQUE,
  environment  text NOT NULL CHECK (environment IN ('1','2')),
  status       text NOT NULL DEFAULT 'gerada'
               CHECK (status IN ('gerada','assinada','autorizada','rejeitada','cancelada')),
  operation    text NOT NULL DEFAULT 'Venda de mercadoria',
  total        numeric(12,2) NOT NULL DEFAULT 0,
  protocol     text NOT NULL DEFAULT '',
  message      text NOT NULL DEFAULT '',
  xml          text NOT NULL DEFAULT '',
  issued_at    timestamptz NOT NULL DEFAULT now(),
  cancelled_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (model, series, number)
);
CREATE TRIGGER invoices_updated_at BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX invoices_sale_idx ON invoices (sale_id);
CREATE INDEX invoices_issued_idx ON invoices (issued_at DESC);
