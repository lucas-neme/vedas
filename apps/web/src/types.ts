export type Role = 'admin' | 'gerente' | 'operador';

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
};

export type User = AuthUser & { active: boolean; created_at?: string };

export type Species = 'cachorro' | 'gato' | 'ave' | 'peixe' | 'roedor' | 'reptil' | 'geral';
export type PetSpecies = Exclude<Species, 'geral'> | 'outro';

export type Category = {
  id: number;
  name: string;
  description: string;
  active: boolean;
  products_count?: number;
};

export type Brand = {
  id: number;
  name: string;
  active: boolean;
  products_count?: number;
};

export type Supplier = {
  id: number;
  name: string;
  document: string;
  contact_name: string;
  email: string;
  phone: string;
  zip_code: string;
  street: string;
  number: string;
  district: string;
  city: string;
  state: string;
  notes: string;
  active: boolean;
};

export type Product = {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  description: string;
  category_id: number | null;
  brand_id: number | null;
  supplier_id: number | null;
  species: Species;
  life_stage: 'filhote' | 'adulto' | 'senior' | 'todos';
  package_weight_kg: number | null;
  unit: string;
  requires_batch: boolean;
  cost_price: number;
  sale_price: number;
  stock_qty: number;
  min_stock: number;
  max_stock: number;
  ncm: string;
  cest: string;
  cfop: string;
  origin: string;
  csosn: string;
  cst_icms: string;
  icms_rate: number;
  active: boolean;
  category_name?: string | null;
  brand_name?: string | null;
  supplier_name?: string | null;
};

export type ProductBatch = {
  id: number;
  product_id: number;
  batch_code: string;
  expires_at: string | null;
  qty: number;
  cost_price: number;
  received_at: string;
  product_name?: string;
  product_sku?: string;
  product_unit?: string;
  days_to_expire?: number | null;
};

export type StockMovement = {
  id: number;
  type: 'entrada' | 'saida' | 'ajuste' | 'perda' | 'devolucao';
  qty: number;
  unit_cost: number;
  balance_after: number;
  reason: string;
  reference_type: string;
  reference_id: number | null;
  created_at: string;
  product_id?: number;
  product_name?: string;
  product_sku?: string;
  product_unit?: string;
  user_name?: string | null;
  batch_code?: string | null;
};

export type Pet = {
  id: number;
  customer_id: number;
  name: string;
  species: PetSpecies;
  breed: string;
  size: 'mini' | 'pequeno' | 'medio' | 'grande' | 'gigante';
  birth_date: string | null;
  weight_kg: number | null;
  neutered: boolean;
  food_product_id: number | null;
  daily_food_grams: number | null;
  notes: string;
  active: boolean;
  food_product_name?: string | null;
  food_package_weight_kg?: number | null;
};

export type Customer = {
  id: number;
  person_type: 'PF' | 'PJ';
  name: string;
  trade_name: string;
  document: string;
  state_registration: string;
  email: string;
  phone: string;
  birth_date: string | null;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  city_ibge_code: string;
  state: string;
  notes: string;
  credit_limit: number;
  active: boolean;
  pets?: Array<Pick<Pet, 'id' | 'name' | 'species'>>;
};

export type CustomerDetail = Omit<Customer, 'pets'> & {
  pets: Pet[];
  recentSales: Array<{ id: number; number: number; status: string; total: number; sold_at: string }>;
  stats: { salesCount: number; totalSpent: number; lastPurchaseAt: string | null };
};

export type PaymentMethod =
  | 'dinheiro'
  | 'pix'
  | 'debito'
  | 'credito'
  | 'boleto'
  | 'crediario'
  | 'transferencia';

export type SaleStatus = 'rascunho' | 'confirmada' | 'cancelada';

export type SaleListItem = {
  id: number;
  number: number;
  status: SaleStatus;
  channel: string;
  items_total: number;
  discount: number;
  freight: number;
  total: number;
  sold_at: string;
  customer_name: string | null;
  user_name: string | null;
  invoice_id: number | null;
  invoice_number: number | null;
  invoice_status: string | null;
  invoice_model: string | null;
};

export type SaleItem = {
  id: number;
  product_id: number | null;
  description: string;
  qty: number;
  unit_price: number;
  discount: number;
  unit_cost: number;
  total: number;
  sku?: string | null;
  unit?: string | null;
  batch_code?: string | null;
  expires_at?: string | null;
};

export type SalePayment = {
  id: number;
  sale_id: number;
  method: PaymentMethod;
  amount: number;
  installments: number;
  due_date: string | null;
  paid: boolean;
  paid_at: string | null;
};

export type SaleDetail = {
  id: number;
  number: number;
  customer_id: number | null;
  status: SaleStatus;
  channel: string;
  items_total: number;
  discount: number;
  freight: number;
  total: number;
  cost_total: number;
  notes: string;
  sold_at: string;
  cancelled_at: string | null;
  cancel_reason: string;
  customer_name: string | null;
  customer_document: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  user_name: string | null;
  items: SaleItem[];
  payments: SalePayment[];
  invoices: Array<{
    id: number;
    model: '55' | '65';
    series: number;
    number: number;
    access_key: string;
    status: string;
    total: number;
    issued_at: string;
  }>;
  margin: number;
  marginPercent: number;
};

export type Invoice = {
  id: number;
  sale_id: number | null;
  model: '55' | '65';
  series: number;
  number: number;
  access_key: string;
  environment: '1' | '2';
  status: 'gerada' | 'assinada' | 'autorizada' | 'rejeitada' | 'cancelada';
  operation: string;
  total: number;
  protocol: string;
  message: string;
  xml: string;
  issued_at: string;
  cancelled_at: string | null;
  sale_number?: number | null;
  customer_name?: string | null;
};

/** Identidade visual — servida publicamente para a tela de login. */
export type Branding = {
  app_name: string;
  app_tagline: string;
  logo_url: string;
  logo_emoji: string;
  primary_color: string;
  accent_color: string;
  sidebar_style: 'dark' | 'light' | 'brand';
  default_theme: 'light' | 'dark' | 'system';
  trade_name: string;
};

export type CompanySettings = Branding & {
  id: number;
  corporate_name: string;
  trade_name: string;
  document: string;
  state_registration: string;
  city_registration: string;
  tax_regime: '1' | '2' | '3';
  phone: string;
  email: string;
  zip_code: string;
  street: string;
  number: string;
  complement: string;
  district: string;
  city: string;
  city_ibge_code: string;
  state: string;
  nfe_environment: '1' | '2';
  nfe_series: number;
  nfe_next_number: number;
  nfce_series: number;
  nfce_next_number: number;
  nfce_csc_id: string;
  nfce_csc_token: string;
  default_ncm: string;
  default_cfop: string;
  default_csosn: string;
  low_stock_alert: boolean;
  expiry_alert_days: number;
  // contato público
  whatsapp: string;
  instagram: string;
  website: string;
  business_hours: string;
  receipt_footer: string;
  // responsável pela loja
  owner_name: string;
  owner_document: string;
  owner_role: string;
  owner_phone: string;
  owner_email: string;
  owner_birth_date: string | null;
};

export type Dashboard = {
  today: { total: number; count: number; averageTicket: number; margin: number };
  month: { total: number; count: number; averageTicket: number; margin: number };
  salesByDay: Array<{ day: string; total: number; count: number }>;
  topProducts: Array<{ id: number; name: string; sku: string; unit: string; qty: number; total: number }>;
  byCategory: Array<{ category: string; total: number }>;
  stock: { products: number; lowStock: number; stockValue: number; expiringBatches: number };
  receivables: { count: number; total: number; overdue: number };
  recentSales: Array<{
    id: number;
    number: number;
    total: number;
    status: SaleStatus;
    sold_at: string;
    customer_name: string | null;
  }>;
};

export type StockAlerts = {
  alertDays: number;
  lowStock: Array<{
    id: number;
    sku: string;
    name: string;
    unit: string;
    stock_qty: number;
    min_stock: number;
    sale_price: number;
    brand_name: string | null;
  }>;
  expiring: Array<{
    id: number;
    batch_code: string;
    expires_at: string;
    qty: number;
    product_id: number;
    product_name: string;
    product_sku: string;
    days_to_expire: number;
  }>;
  expired: Array<{
    id: number;
    batch_code: string;
    expires_at: string;
    qty: number;
    product_id: number;
    product_name: string;
    product_sku: string;
  }>;
};

export type RepurchaseRow = {
  pet_id: number;
  pet_name: string;
  species: string;
  customer_id: number;
  customer_name: string;
  customer_phone: string;
  product_id: number;
  product_name: string;
  package_weight_kg: number | null;
  daily_food_grams: number | null;
  last_purchase: string | null;
  days_of_food: number | null;
  expected_date: string | null;
  daysRemaining: number | null;
};
