import bcrypt from 'bcryptjs';
import { db } from './index';
import { env } from '../env';
import type { Species } from './types';

type SeedProduct = {
  sku: string;
  barcode: string;
  name: string;
  category: string;
  brand: string;
  species: Species;
  life_stage?: 'filhote' | 'adulto' | 'senior' | 'todos';
  package_weight_kg?: number;
  unit?: string;
  requires_batch?: boolean;
  cost_price: number;
  sale_price: number;
  stock_qty: number;
  min_stock: number;
  ncm: string;
};

const CATEGORIES: Array<[string, string]> = [
  ['Ração Seca', 'Rações secas para cães, gatos e demais espécies'],
  ['Ração Úmida', 'Sachês, patês e latas'],
  ['Petiscos e Snacks', 'Biscoitos, bifinhos e ossos'],
  ['Higiene e Limpeza', 'Tapetes, areia sanitária, eliminadores de odor'],
  ['Banho e Tosa', 'Shampoos, condicionadores e colônias'],
  ['Medicamentos e Antipulgas', 'Vermífugos, antipulgas e suplementos'],
  ['Acessórios', 'Coleiras, guias, comedouros e caminhas'],
  ['Brinquedos', 'Mordedores, bolinhas e cordas'],
  ['Aves e Roedores', 'Alimentos e acessórios para aves e roedores'],
  ['Aquarismo', 'Rações para peixes e itens de aquário'],
];

const BRANDS = [
  'Golden',
  'Premier',
  'Royal Canin',
  'Whiskas',
  'Pedigree',
  'Purina',
  'Hills',
  'Bayer',
  'Ceva',
  'Genérico',
];

const PRODUCTS: SeedProduct[] = [
  {
    sku: 'RAC-GOL-AD15',
    barcode: '7896283003011',
    name: 'Ração Golden Fórmula Cães Adultos Frango e Arroz 15kg',
    category: 'Ração Seca',
    brand: 'Golden',
    species: 'cachorro',
    life_stage: 'adulto',
    package_weight_kg: 15,
    cost_price: 148.9,
    sale_price: 219.9,
    stock_qty: 24,
    min_stock: 6,
    ncm: '23091000',
  },
  {
    sku: 'RAC-GOL-FI10',
    barcode: '7896283003028',
    name: 'Ração Golden Fórmula Cães Filhotes Frango e Aveia 10,1kg',
    category: 'Ração Seca',
    brand: 'Golden',
    species: 'cachorro',
    life_stage: 'filhote',
    package_weight_kg: 10.1,
    cost_price: 129.5,
    sale_price: 194.9,
    stock_qty: 15,
    min_stock: 5,
    ncm: '23091000',
  },
  {
    sku: 'RAC-PRE-GAT7',
    barcode: '7896588801234',
    name: 'Ração Premier Gatos Adultos Castrados Frango 7,5kg',
    category: 'Ração Seca',
    brand: 'Premier',
    species: 'gato',
    life_stage: 'adulto',
    package_weight_kg: 7.5,
    cost_price: 189.0,
    sale_price: 269.9,
    stock_qty: 11,
    min_stock: 4,
    ncm: '23091000',
  },
  {
    sku: 'RAC-RC-MINI3',
    barcode: '3182550793001',
    name: 'Ração Royal Canin Mini Adult 2,5kg',
    category: 'Ração Seca',
    brand: 'Royal Canin',
    species: 'cachorro',
    life_stage: 'adulto',
    package_weight_kg: 2.5,
    cost_price: 96.0,
    sale_price: 149.9,
    stock_qty: 8,
    min_stock: 4,
    ncm: '23091000',
  },
  {
    sku: 'RAC-PUR-SEN15',
    barcode: '7891000315002',
    name: 'Ração Purina Dog Chow Sênior 15kg',
    category: 'Ração Seca',
    brand: 'Purina',
    species: 'cachorro',
    life_stage: 'senior',
    package_weight_kg: 15,
    cost_price: 152.0,
    sale_price: 224.9,
    stock_qty: 5,
    min_stock: 6,
    ncm: '23091000',
  },
  {
    sku: 'SAC-WHI-85',
    barcode: '7896029005011',
    name: 'Sachê Whiskas Gatos Adultos Carne ao Molho 85g',
    category: 'Ração Úmida',
    brand: 'Whiskas',
    species: 'gato',
    package_weight_kg: 0.085,
    cost_price: 2.35,
    sale_price: 4.49,
    stock_qty: 180,
    min_stock: 60,
    ncm: '23091000',
  },
  {
    sku: 'SAC-PED-100',
    barcode: '7896029006018',
    name: 'Sachê Pedigree Cães Adultos Frango 100g',
    category: 'Ração Úmida',
    brand: 'Pedigree',
    species: 'cachorro',
    package_weight_kg: 0.1,
    cost_price: 2.9,
    sale_price: 5.29,
    stock_qty: 140,
    min_stock: 50,
    ncm: '23091000',
  },
  {
    sku: 'PET-BIF-500',
    barcode: '7891000440101',
    name: 'Bifinho Pedigree Carne 500g',
    category: 'Petiscos e Snacks',
    brand: 'Pedigree',
    species: 'cachorro',
    package_weight_kg: 0.5,
    cost_price: 16.9,
    sale_price: 29.9,
    stock_qty: 42,
    min_stock: 15,
    ncm: '23091000',
  },
  {
    sku: 'PET-OSSO-M',
    barcode: '7898945101011',
    name: 'Osso Natural Defumado Médio',
    category: 'Petiscos e Snacks',
    brand: 'Genérico',
    species: 'cachorro',
    cost_price: 5.2,
    sale_price: 12.9,
    stock_qty: 60,
    min_stock: 20,
    ncm: '23091000',
  },
  {
    sku: 'HIG-AREIA-4',
    barcode: '7898294201014',
    name: 'Areia Sanitária Higiênica para Gatos 4kg',
    category: 'Higiene e Limpeza',
    brand: 'Genérico',
    species: 'gato',
    package_weight_kg: 4,
    requires_batch: false,
    cost_price: 9.8,
    sale_price: 19.9,
    stock_qty: 70,
    min_stock: 20,
    ncm: '25081000',
  },
  {
    sku: 'HIG-TAP-30',
    barcode: '7898294202011',
    name: 'Tapete Higiênico para Cães 80x60 - 30 unidades',
    category: 'Higiene e Limpeza',
    brand: 'Genérico',
    species: 'cachorro',
    requires_batch: false,
    cost_price: 34.0,
    sale_price: 59.9,
    stock_qty: 28,
    min_stock: 10,
    ncm: '48181000',
  },
  {
    sku: 'BAT-SHP-500',
    barcode: '7898945300017',
    name: 'Shampoo Neutro Cães e Gatos 500ml',
    category: 'Banho e Tosa',
    brand: 'Genérico',
    species: 'geral',
    cost_price: 11.5,
    sale_price: 24.9,
    stock_qty: 35,
    min_stock: 10,
    ncm: '33051000',
  },
  {
    sku: 'MED-ANTIP-G',
    barcode: '7891106910019',
    name: 'Antipulgas Bravecto Cães 20 a 40kg',
    category: 'Medicamentos e Antipulgas',
    brand: 'Bayer',
    species: 'cachorro',
    cost_price: 132.0,
    sale_price: 199.9,
    stock_qty: 12,
    min_stock: 5,
    ncm: '30049099',
  },
  {
    sku: 'MED-VERM-10',
    barcode: '7891106910026',
    name: 'Vermífugo Vermivet 10 comprimidos',
    category: 'Medicamentos e Antipulgas',
    brand: 'Ceva',
    species: 'geral',
    cost_price: 24.0,
    sale_price: 44.9,
    stock_qty: 20,
    min_stock: 8,
    ncm: '30049099',
  },
  {
    sku: 'ACE-COM-DUP',
    barcode: '7898945400014',
    name: 'Comedouro Duplo Inox com Suporte',
    category: 'Acessórios',
    brand: 'Genérico',
    species: 'geral',
    requires_batch: false,
    cost_price: 22.0,
    sale_price: 49.9,
    stock_qty: 18,
    min_stock: 6,
    ncm: '73239900',
  },
  {
    sku: 'ACE-COL-M',
    barcode: '7898945400021',
    name: 'Coleira Peitoral Ajustável Média',
    category: 'Acessórios',
    brand: 'Genérico',
    species: 'cachorro',
    requires_batch: false,
    cost_price: 18.0,
    sale_price: 39.9,
    stock_qty: 25,
    min_stock: 8,
    ncm: '42010000',
  },
  {
    sku: 'BRI-MORD-C',
    barcode: '7898945500011',
    name: 'Mordedor de Corda Trançada',
    category: 'Brinquedos',
    brand: 'Genérico',
    species: 'cachorro',
    requires_batch: false,
    cost_price: 6.5,
    sale_price: 16.9,
    stock_qty: 45,
    min_stock: 15,
    ncm: '95030099',
  },
  {
    sku: 'AVE-ALP-500',
    barcode: '7898945600018',
    name: 'Mistura de Sementes para Calopsita 500g',
    category: 'Aves e Roedores',
    brand: 'Genérico',
    species: 'ave',
    package_weight_kg: 0.5,
    cost_price: 7.2,
    sale_price: 15.9,
    stock_qty: 32,
    min_stock: 12,
    ncm: '23099090',
  },
  {
    sku: 'AQU-PEI-100',
    barcode: '7898945700015',
    name: 'Ração em Flocos para Peixes Ornamentais 100g',
    category: 'Aquarismo',
    brand: 'Genérico',
    species: 'peixe',
    package_weight_kg: 0.1,
    cost_price: 9.0,
    sale_price: 21.9,
    stock_qty: 22,
    min_stock: 8,
    ncm: '23099090',
  },
  {
    sku: 'ROE-HAM-500',
    barcode: '7898945600025',
    name: 'Ração para Hamster e Roedores 500g',
    category: 'Aves e Roedores',
    brand: 'Genérico',
    species: 'roedor',
    package_weight_kg: 0.5,
    cost_price: 8.4,
    sale_price: 18.9,
    stock_qty: 19,
    min_stock: 8,
    ncm: '23099090',
  },
];

function daysFromNow(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function seedDatabase(): Promise<void> {
  await seedAdminUser();

  const productCount = await db
    .selectFrom('products')
    .select(({ fn }) => fn.countAll().as('count'))
    .executeTakeFirst();

  if (Number(productCount?.count ?? 0) > 0) {
    // eslint-disable-next-line no-console
    console.log('[seed] catálogo já populado, nada a fazer');
    return;
  }

  // eslint-disable-next-line no-console
  console.log('[seed] populando catálogo de exemplo (pet shop)...');

  const categoryIds = new Map<string, number>();
  for (const [name, description] of CATEGORIES) {
    const row = await db
      .insertInto('categories')
      .values({ name, description })
      .onConflict((oc) => oc.column('name').doUpdateSet({ description }))
      .returning('id')
      .executeTakeFirstOrThrow();
    categoryIds.set(name, row.id);
  }

  const brandIds = new Map<string, number>();
  for (const name of BRANDS) {
    const row = await db
      .insertInto('brands')
      .values({ name })
      .onConflict((oc) => oc.column('name').doUpdateSet({ name }))
      .returning('id')
      .executeTakeFirstOrThrow();
    brandIds.set(name, row.id);
  }

  const supplier = await db
    .insertInto('suppliers')
    .values({
      name: 'Distribuidora Pet Brasil LTDA',
      document: '12345678000190',
      contact_name: 'Marcos Ribeiro',
      email: 'comercial@petbrasil.com.br',
      phone: '(11) 4002-8922',
      city: 'São Paulo',
      state: 'SP',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  for (const item of PRODUCTS) {
    const product = await db
      .insertInto('products')
      .values({
        sku: item.sku,
        barcode: item.barcode,
        name: item.name,
        category_id: categoryIds.get(item.category) ?? null,
        brand_id: brandIds.get(item.brand) ?? null,
        supplier_id: supplier.id,
        species: item.species,
        life_stage: item.life_stage ?? 'todos',
        package_weight_kg: item.package_weight_kg ?? null,
        unit: item.unit ?? 'UN',
        requires_batch: item.requires_batch ?? true,
        cost_price: item.cost_price,
        sale_price: item.sale_price,
        stock_qty: item.stock_qty,
        min_stock: item.min_stock,
        max_stock: item.min_stock * 5,
        ncm: item.ncm,
      })
      .returning(['id', 'requires_batch'])
      .executeTakeFirstOrThrow();

    if (product.requires_batch) {
      // dois lotes: um com validade confortável, outro próximo do vencimento
      const nearExpiry = Math.round(item.stock_qty * 0.3);
      const normal = item.stock_qty - nearExpiry;
      if (normal > 0) {
        await db
          .insertInto('product_batches')
          .values({
            product_id: product.id,
            batch_code: `L${item.sku.slice(-4)}A`,
            expires_at: daysFromNow(300),
            qty: normal,
            cost_price: item.cost_price,
          })
          .execute();
      }
      if (nearExpiry > 0) {
        await db
          .insertInto('product_batches')
          .values({
            product_id: product.id,
            batch_code: `L${item.sku.slice(-4)}B`,
            expires_at: daysFromNow(35),
            qty: nearExpiry,
            cost_price: item.cost_price,
          })
          .execute();
      }
    }

    await db
      .insertInto('stock_movements')
      .values({
        product_id: product.id,
        type: 'entrada',
        qty: item.stock_qty,
        unit_cost: item.cost_price,
        balance_after: item.stock_qty,
        reason: 'Carga inicial de estoque',
        reference_type: 'seed',
        reference_id: null,
        user_id: null,
      })
      .execute();
  }

  const racaoGolden = await db
    .selectFrom('products')
    .select('id')
    .where('sku', '=', 'RAC-GOL-AD15')
    .executeTakeFirst();

  const clienteA = await db
    .insertInto('customers')
    .values({
      person_type: 'PF',
      name: 'Ana Beatriz Moraes',
      document: '39053344705',
      email: 'ana.moraes@example.com',
      phone: '(11) 98877-1122',
      zip_code: '01310100',
      street: 'Av. Paulista',
      number: '1000',
      district: 'Bela Vista',
      city: 'São Paulo',
      city_ibge_code: '3550308',
      state: 'SP',
      notes: 'Prefere retirar na loja aos sábados.',
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  const clienteB = await db
    .insertInto('customers')
    .values({
      person_type: 'PJ',
      name: 'Clínica Veterinária Amigo Fiel LTDA',
      trade_name: 'Amigo Fiel',
      document: '11222333000181',
      state_registration: '123456789012',
      email: 'compras@amigofiel.com.br',
      phone: '(11) 3555-9090',
      zip_code: '04532000',
      street: 'Rua Joaquim Floriano',
      number: '450',
      district: 'Itaim Bibi',
      city: 'São Paulo',
      city_ibge_code: '3550308',
      state: 'SP',
      credit_limit: 5000,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  await db
    .insertInto('pets')
    .values([
      {
        customer_id: clienteA.id,
        name: 'Thor',
        species: 'cachorro',
        breed: 'Golden Retriever',
        size: 'grande',
        birth_date: daysFromNow(-1300),
        weight_kg: 32.5,
        neutered: true,
        food_product_id: racaoGolden?.id ?? null,
        daily_food_grams: 420,
        notes: 'Alergia a corante artificial.',
      },
      {
        customer_id: clienteA.id,
        name: 'Mia',
        species: 'gato',
        breed: 'SRD',
        size: 'pequeno',
        birth_date: daysFromNow(-800),
        weight_kg: 4.2,
        neutered: true,
        daily_food_grams: 60,
      },
      {
        customer_id: clienteB.id,
        name: 'Pacientes da clínica',
        species: 'outro',
        breed: 'Diversos',
        size: 'medio',
        notes: 'Compra em volume para revenda interna.',
      },
    ])
    .execute();

  // eslint-disable-next-line no-console
  console.log('[seed] catálogo, clientes e pets de exemplo criados');
}

async function seedAdminUser(): Promise<void> {
  const existing = await db
    .selectFrom('users')
    .select('id')
    .where('email', '=', env.adminEmail)
    .executeTakeFirst();

  // Usuário já existe: a senha do banco é a fonte da verdade e nunca é
  // sobrescrita pela variável de ambiente.
  if (existing) return;

  const anyUser = await db.selectFrom('users').select('id').executeTakeFirst();
  if (anyUser) {
    // Já há equipe cadastrada, só não com este e-mail. Não criamos um segundo
    // administrador silenciosamente.
    return;
  }

  if (!env.adminPassword) {
    throw new Error(
      'Nenhum usuário cadastrado e ADMIN_PASSWORD não foi definida.\n' +
        `Defina ADMIN_PASSWORD (e, se quiser, ADMIN_EMAIL — padrão ${env.adminEmail}) ` +
        'para que o primeiro administrador seja criado.',
    );
  }

  if (env.adminPassword.length < 6) {
    throw new Error('ADMIN_PASSWORD deve ter ao menos 6 caracteres.');
  }

  await db
    .insertInto('users')
    .values({
      name: 'Administrador',
      email: env.adminEmail,
      password_hash: bcrypt.hashSync(env.adminPassword, 10),
      role: 'admin',
    })
    .execute();

  // eslint-disable-next-line no-console
  console.log(`[seed] usuário administrador criado: ${env.adminEmail}`);
}
