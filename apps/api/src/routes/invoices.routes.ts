import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { notFound } from '../lib/errors';
import { paginated, paginationSchema } from '../lib/pagination';
import { authenticate, requireRole, type AuthUser } from '../plugins/auth';
import { buildNfceQrCode, cancelInvoice, issueInvoice } from '../services/nfe.service';

const NFCE_QR_BASE: Record<string, string> = {
  '1': 'https://www.nfce.fazenda.sp.gov.br/qrcode',
  '2': 'https://www.homologacao.nfce.fazenda.sp.gov.br/qrcode',
};

export async function invoicesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request) => {
    const query = paginationSchema
      .extend({
        status: z.string().optional(),
        model: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
        search: z.string().trim().optional(),
      })
      .parse(request.query);

    let base = db.selectFrom('invoices');
    if (query.status) base = base.where('invoices.status', '=', query.status as never);
    if (query.model) base = base.where('invoices.model', '=', query.model as never);
    if (query.from) base = base.where('invoices.issued_at', '>=', new Date(query.from));
    if (query.to) {
      const to = new Date(query.to);
      to.setHours(23, 59, 59, 999);
      base = base.where('invoices.issued_at', '<=', to);
    }
    if (query.search) {
      const digits = query.search.replace(/\D+/g, '');
      if (digits) {
        const asNumber = Number(digits);
        const isValidNumber = Number.isSafeInteger(asNumber) && asNumber <= 2_147_483_647;
        base = base.where((eb) =>
          eb.or([
            eb('invoices.access_key', 'like', `%${digits}%`),
            ...(isValidNumber ? [eb('invoices.number', '=', asNumber)] : []),
          ]),
        );
      }
    }

    const [rows, count] = await Promise.all([
      base
        .leftJoin('sales', 'sales.id', 'invoices.sale_id')
        .leftJoin('customers', 'customers.id', 'sales.customer_id')
        .select([
          'invoices.id',
          'invoices.model',
          'invoices.series',
          'invoices.number',
          'invoices.access_key',
          'invoices.status',
          'invoices.environment',
          'invoices.total',
          'invoices.issued_at',
          'invoices.message',
          'sales.id as sale_id',
          'sales.number as sale_number',
          'customers.name as customer_name',
        ])
        .orderBy('invoices.issued_at', 'desc')
        .limit(query.perPage)
        .offset((query.page - 1) * query.perPage)
        .execute(),
      base.select(({ fn }) => fn.countAll<number>().as('count')).executeTakeFirst(),
    ]);

    return paginated(rows, Number(count?.count ?? 0), query);
  });

  /** Dados completos para renderizar o DANFE / cupom. */
  app.get('/:id', async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);

    const invoice = await db
      .selectFrom('invoices')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();
    if (!invoice) throw notFound('Nota fiscal');

    const settings = await db
      .selectFrom('company_settings')
      .selectAll()
      .where('id', '=', 1)
      .executeTakeFirstOrThrow();

    const sale = invoice.sale_id
      ? await db
          .selectFrom('sales')
          .leftJoin('customers', 'customers.id', 'sales.customer_id')
          .select([
            'sales.id',
            'sales.number',
            'sales.total',
            'sales.discount',
            'sales.freight',
            'sales.items_total',
            'sales.notes',
            'sales.sold_at',
            'customers.id as customer_id',
            'customers.name as customer_name',
            'customers.trade_name as customer_trade_name',
            'customers.document as customer_document',
            'customers.state_registration as customer_ie',
            'customers.street as customer_street',
            'customers.number as customer_number',
            'customers.district as customer_district',
            'customers.city as customer_city',
            'customers.state as customer_state',
            'customers.zip_code as customer_zip',
            'customers.phone as customer_phone',
          ])
          .where('sales.id', '=', invoice.sale_id)
          .executeTakeFirst()
      : null;

    const items = invoice.sale_id
      ? await db
          .selectFrom('sale_items')
          .leftJoin('products', 'products.id', 'sale_items.product_id')
          .select([
            'sale_items.id',
            'sale_items.description',
            'sale_items.qty',
            'sale_items.unit_price',
            'sale_items.discount',
            'sale_items.total',
            'products.sku',
            'products.unit',
            'products.ncm',
            'products.cfop',
          ])
          .where('sale_items.sale_id', '=', invoice.sale_id)
          .orderBy('sale_items.id')
          .execute()
      : [];

    const payments = invoice.sale_id
      ? await db
          .selectFrom('sale_payments')
          .selectAll()
          .where('sale_id', '=', invoice.sale_id)
          .execute()
      : [];

    const qrCode =
      invoice.model === '65'
        ? buildNfceQrCode({
            accessKey: invoice.access_key,
            environment: invoice.environment,
            cscId: settings.nfce_csc_id,
            cscToken: settings.nfce_csc_token,
            baseUrl: NFCE_QR_BASE[invoice.environment],
          })
        : null;

    return { invoice, company: settings, sale, items, payments, qrCode };
  });

  app.get('/:id/xml', async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const invoice = await db
      .selectFrom('invoices')
      .select(['access_key', 'xml'])
      .where('id', '=', id)
      .executeTakeFirst();
    if (!invoice) throw notFound('Nota fiscal');

    return reply
      .header('Content-Type', 'application/xml; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${invoice.access_key}-nfe.xml"`)
      .send(invoice.xml);
  });

  app.post('/', async (request, reply) => {
    const body = z
      .object({
        sale_id: z.coerce.number().int().positive(),
        model: z.enum(['55', '65']).default('55'),
        operation: z.string().trim().optional(),
        additional_info: z.string().trim().optional(),
      })
      .parse(request.body);

    const auth = request.user as AuthUser;
    const { invoice } = await issueInvoice(
      {
        saleId: body.sale_id,
        model: body.model,
        operation: body.operation,
        additionalInfo: body.additional_info,
      },
      auth.id,
    );

    return reply.code(201).send(invoice);
  });

  /**
   * Registra o retorno da SEFAZ (protocolo de autorização ou rejeição).
   * Usado pela integração de transmissão — veja docs/fiscal.md.
   */
  app.post('/:id/status', { preHandler: requireRole('admin', 'gerente') }, async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const body = z
      .object({
        status: z.enum(['gerada', 'assinada', 'autorizada', 'rejeitada']),
        protocol: z.string().trim().default(''),
        message: z.string().trim().default(''),
        xml: z.string().optional(),
      })
      .parse(request.body);

    const updated = await db
      .updateTable('invoices')
      .set({
        status: body.status,
        protocol: body.protocol,
        message: body.message,
        ...(body.xml ? { xml: body.xml } : {}),
      })
      .where('id', '=', id)
      .returningAll()
      .executeTakeFirst();

    if (!updated) throw notFound('Nota fiscal');
    return updated;
  });

  app.post('/:id/cancel', { preHandler: requireRole('admin', 'gerente') }, async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const { reason } = z.object({ reason: z.string().trim() }).parse(request.body);
    return cancelInvoice(id, reason);
  });
}
