import { db } from '../db';
import { badRequest, conflict, notFound } from '../lib/errors';
import { round2, round3 } from '../lib/money';
import { allocateFefo, applyStockMovement } from './stock.service';

export type SaleItemInput = {
  product_id: number;
  qty: number;
  unit_price?: number;
  discount?: number;
};

export type SalePaymentInput = {
  method:
    | 'dinheiro'
    | 'pix'
    | 'debito'
    | 'credito'
    | 'boleto'
    | 'crediario'
    | 'transferencia';
  amount: number;
  installments?: number;
  due_date?: string | null;
  paid?: boolean;
};

export type CreateSaleInput = {
  customer_id?: number | null;
  channel?: 'balcao' | 'whatsapp' | 'delivery' | 'marketplace';
  status?: 'rascunho' | 'confirmada';
  discount?: number;
  freight?: number;
  notes?: string;
  items: SaleItemInput[];
  payments?: SalePaymentInput[];
};

export async function createSale(input: CreateSaleInput, userId: number) {
  if (!input.items.length) throw badRequest('Adicione ao menos um item à venda.');

  const status = input.status ?? 'confirmada';
  const discount = round2(input.discount ?? 0);
  const freight = round2(input.freight ?? 0);

  return db.transaction().execute(async (trx) => {
    const productIds = [...new Set(input.items.map((item) => item.product_id))];
    const products = await trx
      .selectFrom('products')
      .select(['id', 'name', 'sale_price', 'cost_price', 'unit', 'active', 'stock_qty'])
      .where('id', 'in', productIds)
      .execute();

    const productMap = new Map(products.map((product) => [product.id, product]));

    const resolvedItems = input.items.map((item) => {
      const product = productMap.get(item.product_id);
      if (!product) throw notFound(`Produto #${item.product_id}`);
      if (!product.active) throw badRequest(`O produto "${product.name}" está inativo.`);

      const qty = round3(item.qty);
      if (qty <= 0) throw badRequest(`Quantidade inválida para "${product.name}".`);

      const unitPrice = round2(item.unit_price ?? Number(product.sale_price));
      const itemDiscount = round2(item.discount ?? 0);
      const total = round2(qty * unitPrice - itemDiscount);
      if (total < 0) throw badRequest(`Desconto maior que o valor do item "${product.name}".`);

      return {
        product,
        qty,
        unitPrice,
        itemDiscount,
        total,
        unitCost: Number(product.cost_price),
      };
    });

    const itemsTotal = round2(resolvedItems.reduce((sum, item) => sum + item.total, 0));
    const total = round2(itemsTotal - discount + freight);
    if (total < 0) throw badRequest('O desconto informado é maior que o total da venda.');

    const costTotal = round2(
      resolvedItems.reduce((sum, item) => sum + item.qty * item.unitCost, 0),
    );

    const payments = input.payments ?? [];
    if (status === 'confirmada') {
      if (!payments.length) throw badRequest('Informe ao menos uma forma de pagamento.');
      const paid = round2(payments.reduce((sum, payment) => sum + Number(payment.amount), 0));
      if (Math.abs(paid - total) > 0.02) {
        throw badRequest(
          `A soma dos pagamentos (R$ ${paid.toFixed(2)}) não confere com o total da venda (R$ ${total.toFixed(2)}).`,
        );
      }
    }

    const sale = await trx
      .insertInto('sales')
      .values({
        customer_id: input.customer_id ?? null,
        user_id: userId,
        status,
        channel: input.channel ?? 'balcao',
        items_total: itemsTotal,
        discount,
        freight,
        total,
        cost_total: costTotal,
        notes: input.notes ?? '',
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    for (const item of resolvedItems) {
      if (status !== 'confirmada') {
        await trx
          .insertInto('sale_items')
          .values({
            sale_id: sale.id,
            product_id: item.product.id,
            batch_id: null,
            description: item.product.name,
            qty: item.qty,
            unit_price: item.unitPrice,
            discount: item.itemDiscount,
            unit_cost: item.unitCost,
            total: item.total,
          })
          .execute();
        continue;
      }

      // Venda confirmada: baixa o estoque por lote (FEFO) e gera um registro
      // de item por lote consumido, preservando a rastreabilidade.
      const allocations = await allocateFefo(trx, item.product.id, item.qty);
      let remainingDiscount = item.itemDiscount;

      for (let index = 0; index < allocations.length; index += 1) {
        const allocation = allocations[index];
        const isLast = index === allocations.length - 1;
        const share = isLast
          ? remainingDiscount
          : round2((item.itemDiscount * allocation.qty) / item.qty);
        remainingDiscount = round2(remainingDiscount - share);

        await trx
          .insertInto('sale_items')
          .values({
            sale_id: sale.id,
            product_id: item.product.id,
            batch_id: allocation.batchId,
            description: item.product.name,
            qty: allocation.qty,
            unit_price: item.unitPrice,
            discount: share,
            unit_cost: item.unitCost,
            total: round2(allocation.qty * item.unitPrice - share),
          })
          .execute();

        await applyStockMovement(trx, {
          productId: item.product.id,
          batchId: allocation.batchId,
          type: 'saida',
          qty: -allocation.qty,
          unitCost: item.unitCost,
          reason: `Venda #${sale.number}`,
          referenceType: 'venda',
          referenceId: sale.id,
          userId,
        });
      }
    }

    for (const payment of payments) {
      await trx
        .insertInto('sale_payments')
        .values({
          sale_id: sale.id,
          method: payment.method,
          amount: round2(payment.amount),
          installments: payment.installments ?? 1,
          due_date: payment.due_date ?? null,
          paid: payment.paid ?? payment.method !== 'crediario',
          paid_at: (payment.paid ?? payment.method !== 'crediario') ? new Date() : null,
        })
        .execute();
    }

    return sale;
  });
}

export async function cancelSale(saleId: number, reason: string, userId: number) {
  return db.transaction().execute(async (trx) => {
    const sale = await trx
      .selectFrom('sales')
      .selectAll()
      .where('id', '=', saleId)
      .forUpdate()
      .executeTakeFirst();

    if (!sale) throw notFound('Venda');
    if (sale.status === 'cancelada') throw conflict('Esta venda já está cancelada.');

    const invoice = await trx
      .selectFrom('invoices')
      .select(['id', 'number', 'status'])
      .where('sale_id', '=', saleId)
      .where('status', '!=', 'cancelada')
      .executeTakeFirst();

    if (invoice) {
      throw conflict(
        `Cancele antes a nota fiscal nº ${invoice.number} vinculada a esta venda.`,
      );
    }

    if (sale.status === 'confirmada') {
      const items = await trx
        .selectFrom('sale_items')
        .selectAll()
        .where('sale_id', '=', saleId)
        .execute();

      for (const item of items) {
        if (!item.product_id) continue;
        await applyStockMovement(trx, {
          productId: item.product_id,
          batchId: item.batch_id,
          type: 'devolucao',
          qty: Number(item.qty),
          unitCost: Number(item.unit_cost),
          reason: `Cancelamento da venda #${sale.number}`,
          referenceType: 'venda',
          referenceId: sale.id,
          userId,
        });
      }
    }

    const updated = await trx
      .updateTable('sales')
      .set({
        status: 'cancelada',
        cancelled_at: new Date(),
        cancel_reason: reason,
      })
      .where('id', '=', saleId)
      .returningAll()
      .executeTakeFirstOrThrow();

    return updated;
  });
}
