import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { isValidCNPJ, isValidCPF, onlyDigits } from '../lib/br';
import { badRequest } from '../lib/errors';
import { authenticate, requireRole } from '../plugins/auth';

const optionalString = z.string().trim().default('');
const hexColor = z
  .string()
  .trim()
  .regex(/^#[0-9a-fA-F]{6}$/, 'Use uma cor no formato #RRGGBB.');

const LOGO_MAX_BYTES = 1_200_000;

const logoSchema = z
  .string()
  .trim()
  .default('')
  .refine((value) => value === '' || /^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(value) || /^https?:\/\//.test(value), {
    message: 'A logo deve ser uma imagem (PNG, JPG, WEBP ou SVG) ou uma URL http(s).',
  })
  .refine((value) => value.length <= LOGO_MAX_BYTES, {
    message: 'A logo é muito grande. Use uma imagem de até ~800 KB.',
  });

/** Campos de identidade visual — lidos publicamente pela tela de login. */
const brandingSchema = z.object({
  app_name: z.string().trim().min(1, 'Informe o nome do sistema.').max(40),
  app_tagline: z.string().trim().max(60).default(''),
  logo_url: logoSchema,
  logo_emoji: z.string().trim().max(8).default('🐾'),
  primary_color: hexColor,
  accent_color: hexColor,
  sidebar_style: z.enum(['dark', 'light', 'brand']).default('dark'),
  default_theme: z.enum(['light', 'dark', 'system']).default('light'),
});

const dateOrNull = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data inválida (use AAAA-MM-DD).')
  .nullish()
  .transform((value) => value || null);

const settingsSchema = brandingSchema.extend({
  // ── Dados profissionais da loja ────────────────────────────────────────────
  corporate_name: z.string().trim().min(2, 'Informe a razão social.'),
  trade_name: optionalString,
  document: optionalString,
  state_registration: optionalString,
  city_registration: optionalString,
  tax_regime: z.enum(['1', '2', '3']).default('1'),
  phone: optionalString,
  email: z.union([z.string().email('E-mail inválido.'), z.literal('')]).default(''),
  zip_code: optionalString,
  street: optionalString,
  number: optionalString,
  complement: optionalString,
  district: optionalString,
  city: optionalString,
  city_ibge_code: optionalString,
  state: z.string().trim().length(2, 'UF deve ter 2 letras.').default('SP'),

  // ── Contato público ────────────────────────────────────────────────────────
  whatsapp: optionalString,
  instagram: optionalString,
  website: optionalString,
  business_hours: optionalString,
  receipt_footer: optionalString,

  // ── Dados pessoais do responsável ──────────────────────────────────────────
  owner_name: optionalString,
  owner_document: optionalString,
  owner_role: optionalString,
  owner_phone: optionalString,
  owner_email: z.union([z.string().email('E-mail do responsável inválido.'), z.literal('')]).default(''),
  owner_birth_date: dateOrNull,

  // ── Fiscal ─────────────────────────────────────────────────────────────────
  nfe_environment: z.enum(['1', '2']).default('2'),
  nfe_series: z.coerce.number().int().min(1).default(1),
  nfe_next_number: z.coerce.number().int().min(1).default(1),
  nfce_series: z.coerce.number().int().min(1).default(1),
  nfce_next_number: z.coerce.number().int().min(1).default(1),
  nfce_csc_id: optionalString,
  nfce_csc_token: optionalString,
  default_ncm: optionalString,
  default_cfop: optionalString,
  default_csosn: optionalString,

  // ── Operação ───────────────────────────────────────────────────────────────
  low_stock_alert: z.boolean().default(true),
  expiry_alert_days: z.coerce.number().int().min(1).max(365).default(60),
});

const BRANDING_FIELDS = [
  'app_name',
  'app_tagline',
  'logo_url',
  'logo_emoji',
  'primary_color',
  'accent_color',
  'sidebar_style',
  'default_theme',
  'trade_name',
] as const;

/** Rotas sem autenticação — só expõem a identidade visual. */
export async function publicRoutes(app: FastifyInstance): Promise<void> {
  app.get('/branding', async () => {
    return db
      .selectFrom('company_settings')
      .select(BRANDING_FIELDS)
      .where('id', '=', 1)
      .executeTakeFirstOrThrow();
  });
}

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/', async () => {
    return db
      .selectFrom('company_settings')
      .selectAll()
      .where('id', '=', 1)
      .executeTakeFirstOrThrow();
  });

  app.put('/', { preHandler: requireRole('admin', 'gerente') }, async (request) => {
    const body = settingsSchema.parse(request.body);

    const document = onlyDigits(body.document);
    if (document && !isValidCNPJ(document)) throw badRequest('CNPJ inválido.');

    const ownerDocument = onlyDigits(body.owner_document);
    if (ownerDocument && !isValidCPF(ownerDocument)) throw badRequest('CPF do responsável inválido.');

    return db
      .updateTable('company_settings')
      .set({
        ...body,
        document,
        owner_document: ownerDocument,
        state: body.state.toUpperCase(),
      })
      .where('id', '=', 1)
      .returningAll()
      .executeTakeFirstOrThrow();
  });

  /** Salva só a identidade visual — usado pela aba Aparência. */
  app.put('/branding', { preHandler: requireRole('admin', 'gerente') }, async (request) => {
    const body = brandingSchema.parse(request.body);

    return db
      .updateTable('company_settings')
      .set(body)
      .where('id', '=', 1)
      .returningAll()
      .executeTakeFirstOrThrow();
  });
}
