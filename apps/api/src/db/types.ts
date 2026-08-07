import type { ColumnType, Generated, Insertable, Selectable, Updateable } from 'kysely';

type Timestamp = Date;
type NullableTimestamp = Generated<Date | null>;
type DateOnly = ColumnType<string | null, string | null | undefined, string | null>;

export interface UsersTable {
  id: Generated<number>;
  name: string;
  email: string;
  password_hash: string;
  role: 'admin' | 'gerente' | 'operador';
  active: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface CompanySettingsTable {
  id: Generated<number>;
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
  state_ibge_code: string;
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
  // identidade visual
  app_name: Generated<string>;
  app_tagline: Generated<string>;
  logo_url: Generated<string>;
  logo_emoji: Generated<string>;
  primary_color: Generated<string>;
  accent_color: Generated<string>;
  sidebar_style: Generated<'dark' | 'light' | 'brand'>;
  default_theme: Generated<'light' | 'dark' | 'system'>;
  // responsável pela loja
  owner_name: Generated<string>;
  owner_document: Generated<string>;
  owner_role: Generated<string>;
  owner_phone: Generated<string>;
  owner_email: Generated<string>;
  owner_birth_date: DateOnly;
  // contato público
  whatsapp: Generated<string>;
  instagram: Generated<string>;
  website: Generated<string>;
  business_hours: Generated<string>;
  receipt_footer: Generated<string>;
  updated_at: Generated<Timestamp>;
}

export interface CategoriesTable {
  id: Generated<number>;
  name: string;
  description: Generated<string>;
  active: Generated<boolean>;
  created_at: Generated<Timestamp>;
}

export interface BrandsTable {
  id: Generated<number>;
  name: string;
  active: Generated<boolean>;
  created_at: Generated<Timestamp>;
}

export interface SuppliersTable {
  id: Generated<number>;
  name: string;
  document: Generated<string>;
  contact_name: Generated<string>;
  email: Generated<string>;
  phone: Generated<string>;
  zip_code: Generated<string>;
  street: Generated<string>;
  number: Generated<string>;
  district: Generated<string>;
  city: Generated<string>;
  state: Generated<string>;
  notes: Generated<string>;
  active: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export type Species = 'cachorro' | 'gato' | 'ave' | 'peixe' | 'roedor' | 'reptil' | 'geral';

export interface ProductsTable {
  id: Generated<number>;
  sku: string;
  barcode: string | null;
  name: string;
  description: Generated<string>;
  category_id: number | null;
  brand_id: number | null;
  supplier_id: number | null;
  species: Generated<Species>;
  life_stage: Generated<'filhote' | 'adulto' | 'senior' | 'todos'>;
  package_weight_kg: number | null;
  unit: Generated<string>;
  requires_batch: Generated<boolean>;
  cost_price: Generated<number>;
  sale_price: Generated<number>;
  stock_qty: Generated<number>;
  min_stock: Generated<number>;
  max_stock: Generated<number>;
  ncm: Generated<string>;
  cest: Generated<string>;
  cfop: Generated<string>;
  origin: Generated<string>;
  csosn: Generated<string>;
  cst_icms: Generated<string>;
  icms_rate: Generated<number>;
  active: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface ProductBatchesTable {
  id: Generated<number>;
  product_id: number;
  batch_code: string;
  expires_at: DateOnly;
  qty: Generated<number>;
  cost_price: Generated<number>;
  received_at: Generated<string>;
  created_at: Generated<Timestamp>;
}

export interface StockMovementsTable {
  id: Generated<number>;
  product_id: number;
  batch_id: number | null;
  type: 'entrada' | 'saida' | 'ajuste' | 'perda' | 'devolucao';
  qty: number;
  unit_cost: Generated<number>;
  balance_after: Generated<number>;
  reason: Generated<string>;
  reference_type: Generated<string>;
  reference_id: number | null;
  user_id: number | null;
  created_at: Generated<Timestamp>;
}

export interface CustomersTable {
  id: Generated<number>;
  person_type: Generated<'PF' | 'PJ'>;
  name: string;
  trade_name: Generated<string>;
  document: Generated<string>;
  state_registration: Generated<string>;
  email: Generated<string>;
  phone: Generated<string>;
  birth_date: DateOnly;
  zip_code: Generated<string>;
  street: Generated<string>;
  number: Generated<string>;
  complement: Generated<string>;
  district: Generated<string>;
  city: Generated<string>;
  city_ibge_code: Generated<string>;
  state: Generated<string>;
  notes: Generated<string>;
  credit_limit: Generated<number>;
  active: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface PetsTable {
  id: Generated<number>;
  customer_id: number;
  name: string;
  species: Generated<'cachorro' | 'gato' | 'ave' | 'peixe' | 'roedor' | 'reptil' | 'outro'>;
  breed: Generated<string>;
  size: Generated<'mini' | 'pequeno' | 'medio' | 'grande' | 'gigante'>;
  birth_date: DateOnly;
  weight_kg: number | null;
  neutered: Generated<boolean>;
  food_product_id: number | null;
  daily_food_grams: number | null;
  notes: Generated<string>;
  active: Generated<boolean>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface SalesTable {
  id: Generated<number>;
  number: Generated<number>;
  customer_id: number | null;
  user_id: number | null;
  status: Generated<'rascunho' | 'confirmada' | 'cancelada'>;
  channel: Generated<'balcao' | 'whatsapp' | 'delivery' | 'marketplace'>;
  items_total: Generated<number>;
  discount: Generated<number>;
  freight: Generated<number>;
  total: Generated<number>;
  cost_total: Generated<number>;
  notes: Generated<string>;
  sold_at: Generated<Timestamp>;
  cancelled_at: NullableTimestamp;
  cancel_reason: Generated<string>;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface SaleItemsTable {
  id: Generated<number>;
  sale_id: number;
  product_id: number | null;
  batch_id: number | null;
  description: string;
  qty: number;
  unit_price: number;
  discount: Generated<number>;
  unit_cost: Generated<number>;
  total: number;
  created_at: Generated<Timestamp>;
}

export type PaymentMethod =
  | 'dinheiro'
  | 'pix'
  | 'debito'
  | 'credito'
  | 'boleto'
  | 'crediario'
  | 'transferencia';

export interface SalePaymentsTable {
  id: Generated<number>;
  sale_id: number;
  method: PaymentMethod;
  amount: number;
  installments: Generated<number>;
  due_date: DateOnly;
  paid: Generated<boolean>;
  paid_at: NullableTimestamp;
  created_at: Generated<Timestamp>;
}

export interface InvoicesTable {
  id: Generated<number>;
  sale_id: number | null;
  model: Generated<'55' | '65'>;
  series: number;
  number: number;
  access_key: string;
  environment: '1' | '2';
  status: Generated<'gerada' | 'assinada' | 'autorizada' | 'rejeitada' | 'cancelada'>;
  operation: Generated<string>;
  total: Generated<number>;
  protocol: Generated<string>;
  message: Generated<string>;
  xml: Generated<string>;
  issued_at: Generated<Timestamp>;
  cancelled_at: NullableTimestamp;
  created_at: Generated<Timestamp>;
  updated_at: Generated<Timestamp>;
}

export interface Database {
  users: UsersTable;
  company_settings: CompanySettingsTable;
  categories: CategoriesTable;
  brands: BrandsTable;
  suppliers: SuppliersTable;
  products: ProductsTable;
  product_batches: ProductBatchesTable;
  stock_movements: StockMovementsTable;
  customers: CustomersTable;
  pets: PetsTable;
  sales: SalesTable;
  sale_items: SaleItemsTable;
  sale_payments: SalePaymentsTable;
  invoices: InvoicesTable;
}

export type User = Selectable<UsersTable>;
export type NewUser = Insertable<UsersTable>;
export type Product = Selectable<ProductsTable>;
export type NewProduct = Insertable<ProductsTable>;
export type ProductUpdate = Updateable<ProductsTable>;
export type Customer = Selectable<CustomersTable>;
export type Sale = Selectable<SalesTable>;
export type Invoice = Selectable<InvoicesTable>;
export type CompanySettings = Selectable<CompanySettingsTable>;

