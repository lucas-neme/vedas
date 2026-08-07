import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db';
import { notFound } from '../lib/errors';
import { paginated, paginationSchema } from '../lib/pagination';
import { authenticate, type AuthUser } from '../plugins/auth';
import { cancelSale, createSale } from '../services/sales.service';

const saleSchema = z.object({
  customer_id: z.coerce.number().int().nullish().transform((v) => v ?? null),
  channel: z.enum(['balcao', 'whatsapp', 'delivery', 'marketplace']).default('balcao'),
  status: z.enum(['rascunho', 'confirmada']).default('confirmada'),
  discount: z.coerce.number().min(0).default(0),
  freight: z.coerce.number().min(0).default(0),
  notes: z.string().trim().default(''),
  items: z
    .array(
      z.object({
        product_id: z.coerce.number().int().positive(),
        qty: z.coerce.number().positive(),
        unit_price: z.coerce.number().min(0).optional(),
        discount: z.coerce.number().min(0).optional(),
      }),
    )
    .min(1, 'Adicione ao menos um item.'),
  payments: z
    .array(
      z.object({
        method: z.enum([
          'dinheiro',
          'pix',
          'debito',
          'credito',
          'boleto',
          'crediario',
          'transferencia',
        ]),
        amount: z.coerce.number().positive(),
        installments: z.coerce.number().int().min(1).default(1),
        due_date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullish()
          .transform((v) => v ?? null),
        paid: z.boolean().optional(),
      }),
    )
    .default([]),
});

export async function salesRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', authenticate);

  app.get('/', async (request) => {
    const query = paginationSchema
      .extend({
        search: z.string().trim().optional(),
        customerId: z.coerce.number().optional(),
        status: z.string().optional(),
        from: z.string().optional(),
        to: z.string().optional(),
      })
      .parse(request.query);

    let base = db.selectFrom('sales');
    if (query.customerId) base = base.where('sales.customer_id', '=', query.customerId);
    if (query.status) base = base.where('sales.status', '=', query.status as never);
    if (query.from) base = base.where('sales.sold_at', '>=', new Date(query.from));
    if (query.to) {
      const to = new Date(query.to);
      to.setHours(23, 59, 59, 999);
      base = base.where('sales.sold_at', '<=', to);
    }
    if (query.search) {
      const numeric = Number(query.search.replace(/\D+/g, ''));
      if (Number.isSafeInteger(numeric) && numeric > 0 && numeric <= 2_147_483_647) {
        base = base.where('sales.number', '=', numeric);
      }
    }

    const [rows, count] = await Promise.all([
      base
        .leftJoin('customers', 'customers.id', 'sales.customer_id')
        .leftJoin('users', 'users.id', 'sales.user_id')
        .leftJoin('invoices', (join) =>
          join.onRef('invoices.sale_id', '=', 'sales.id').on('invoices.status', '!=', 'cancelada'),
        )
        .select([
          'sales.id',
          'sales.number',
          'sales.status',
          'sales.channel',
          'sales.items_total',
          'sales.discount',
          'sales.freight',
          'sales.total',
          'sales.sold_at',
          'customers.name as customer_name',
          'users.name as user_name',
          'invoices.id as invoice_id',
          'invoices.number as invoice_number',
          'invoices.status as invoice_status',
          'invoices.model as invoice_model',
        ])
        .orderBy('sales.sold_at', 'desc')
        .limit(query.perPage)
        .offset((query.page - 1) * query.perPage)
        .execute(),
      base.select(({ fn }) => fn.countAll<number>().as('count')).executeTakeFirst(),
    ]);

    const totals = await base
      .select(({ fn }) => [
        fn.sum<number>('sales.total').as('sum_total'),
        fn.count<number>('sales.id').as('sales_count'),
      ])
      .where('sales.status', '=', 'confirmada')
      .executeTakeFirst();

    return {
      ...paginated(rows, Number(count?.count ?? 0), query),
      summary: {
        total: Number(totals?.sum_total ?? 0),
        count: Number(totals?.sales_count ?? 0),
      },
    };
  });

  app.get('/:id', async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);

    const sale = await db
      .selectFrom('sales')
      .leftJoin('customers', 'customers.id', 'sales.customer_id')
      .leftJoin('users', 'users.id', 'sales.user_id')
      .select([
        'sales.id',
        'sales.number',
        'sales.customer_id',
        'sales.user_id',
        'sales.status',
        'sales.channel',
        'sales.items_total',
        'sales.discount',
        'sales.freight',
        'sales.total',
        'sales.cost_total',
        'sales.notes',
        'sales.sold_at',
        'sales.cancelled_at',
        'sales.cancel_reason',
        'customers.name as customer_name',
        'customers.document as customer_document',
        'customers.phone as customer_phone',
        'customers.email as customer_email',
        'users.name as user_name',
      ])
      .where('sales.id', '=', id)
      .executeTakeFirst();

    if (!sale) throw notFound('Venda');

    const [items, payments, invoices] = await Promise.all([
      db
        .selectFrom('sale_items')
        .leftJoin('products', 'products.id', 'sale_items.product_id')
        .leftJoin('product_batches', 'product_batches.id', 'sale_items.batch_id')
        .select([
          'sale_items.id',
          'sale_items.product_id',
          'sale_items.description',
          'sale_items.qty',
          'sale_items.unit_price',
          'sale_items.discount',
          'sale_items.unit_cost',
          'sale_items.total',
          'products.sku',
          'products.unit',
          'product_batches.batch_code',
          'product_batches.expires_at',
        ])
        .where('sale_items.sale_id', '=', id)
        .orderBy('sale_items.id')
        .execute(),
      db
        .selectFrom('sale_payments')
        .selectAll()
        .where('sale_id', '=', id)
        .orderBy('id')
        .execute(),
      db
        .selectFrom('invoices')
        .select(['id', 'model', 'series', 'number', 'access_key', 'status', 'total', 'issued_at'])
        .where('sale_id', '=', id)
        .orderBy('issued_at', 'desc')
        .execute(),
    ]);

    const margin = Number(sale.total) - Number(sale.cost_total);

    return {
      ...sale,
      items,
      payments,
      invoices,
      margin,
      marginPercent: Number(sale.total) > 0 ? (margin / Number(sale.total)) * 100 : 0,
    };
  });

  app.post('/', async (request, reply) => {
    const body = saleSchema.parse(request.body);
    const auth = request.user as AuthUser;
    const sale = await createSale(body, auth.id);
    return reply.code(201).send(sale);
  });

  app.post('/:id/cancel', async (request) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);
    const { reason } = z
      .object({ reason: z.string().trim().min(3, 'Informe o motivo do cancelamento.') })
      .parse(request.body);
    const auth = request.user as AuthUser;
    return cancelSale(id, reason, auth.id);
  });

  app.post('/:id/payments/:paymentId/settle', async (request) => {
    const params = z
      .object({ id: z.coerce.number(), paymentId: z.coerce.number() })
      .parse(request.params);

    const updated = await db
      .updateTable('sale_payments')
      .set({ paid: true, paid_at: new Date() })
      .where('id', '=', params.paymentId)
      .where('sale_id', '=', params.id)
      .returningAll()
      .executeTakeFirst();

    if (!updated) throw notFound('Pagamento');
    return updated;
  });

  /** Contas a receber: crediário e boletos em aberto. */
  app.get('/receivables/open', async () => {
    return db
      .selectFrom('sale_payments')
      .innerJoin('sales', 'sales.id', 'sale_payments.sale_id')
      .leftJoin('customers', 'customers.id', 'sales.customer_id')
      .select([
        'sale_payments.id',
        'sale_payments.method',
        'sale_payments.amount',
        'sale_payments.installments',
        'sale_payments.due_date',
        'sales.id as sale_id',
        'sales.number as sale_number',
        'sales.sold_at',
        'customers.name as customer_name',
        'customers.phone as customer_phone',
      ])
      .where('sale_payments.paid', '=', false)
      .where('sales.status', '=', 'confirmada')
      .orderBy('sale_payments.due_date')
      .limit(200)
      .execute();
  });
}
