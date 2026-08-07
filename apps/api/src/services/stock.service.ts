import { sql, type Transaction } from 'kysely';
import type { Database } from '../db/types';
import { badRequest, notFound } from '../lib/errors';
import { round3 } from '../lib/money';

export type MovementType = 'entrada' | 'saida' | 'ajuste' | 'perda' | 'devolucao';

export type MovementInput = {
  productId: number;
  batchId?: number | null;
  type: MovementType;
  /** Positivo entra, negativo sai. */
  qty: number;
  unitCost?: number;
  reason?: string;
  referenceType?: string;
  referenceId?: number | null;
  userId?: number | null;
  /** Permite estoque negativo (usado em ajustes de inventário). */
  allowNegative?: boolean;
};

export type Allocation = { batchId: number | null; qty: number };

/**
 * Aplica uma movimentação de estoque: atualiza o saldo do produto, o saldo do
 * lote (quando informado) e registra a movimentação no histórico.
 */
export async function applyStockMovement(
  trx: Transaction<Database>,
  input: MovementInput,
): Promise<{ balance: number }> {
  const qty = round3(input.qty);
  if (qty === 0) throw badRequest('A quantidade da movimentação não pode ser zero.');

  const product = await trx
    .selectFrom('products')
    .select(['id', 'name', 'stock_qty', 'cost_price'])
    .where('id', '=', input.productId)
    .forUpdate()
    .executeTakeFirst();

  if (!product) throw notFound('Produto');

  const balance = round3(Number(product.stock_qty) + qty);
  if (balance < 0 && !input.allowNegative) {
    throw badRequest(
      `Estoque insuficiente para "${product.name}". Saldo atual: ${product.stock_qty}.`,
    );
  }

  await trx
    .updateTable('products')
    .set({ stock_qty: balance })
    .where('id', '=', input.productId)
    .execute();

  if (input.batchId) {
    const batch = await trx
      .selectFrom('product_batches')
      .select(['id', 'qty', 'batch_code'])
      .where('id', '=', input.batchId)
      .where('product_id', '=', input.productId)
      .forUpdate()
      .executeTakeFirst();

    if (!batch) throw notFound('Lote');

    const batchBalance = round3(Number(batch.qty) + qty);
    if (batchBalance < 0 && !input.allowNegative) {
      throw badRequest(`Saldo insuficiente no lote ${batch.batch_code}.`);
    }

    await trx
      .updateTable('product_batches')
      .set({ qty: Math.max(batchBalance, 0) })
      .where('id', '=', input.batchId)
      .execute();
  }

  await trx
    .insertInto('stock_movements')
    .values({
      product_id: input.productId,
      batch_id: input.batchId ?? null,
      type: input.type,
      qty,
      unit_cost: input.unitCost ?? Number(product.cost_price),
      balance_after: balance,
      reason: input.reason ?? '',
      reference_type: input.referenceType ?? 'manual',
      reference_id: input.referenceId ?? null,
      user_id: input.userId ?? null,
    })
    .execute();

  return { balance };
}

/**
 * Distribui uma saída entre os lotes disponíveis usando FEFO
 * (First Expired, First Out) — essencial em ração e medicamentos.
 */
export async function allocateFefo(
  trx: Transaction<Database>,
  productId: number,
  qty: number,
): Promise<Allocation[]> {
  const product = await trx
    .selectFrom('products')
    .select(['id', 'requires_batch'])
    .where('id', '=', productId)
    .executeTakeFirst();

  if (!product) throw notFound('Produto');
  if (!product.requires_batch) return [{ batchId: null, qty: round3(qty) }];

  const batches = await trx
    .selectFrom('product_batches')
    .select(['id', 'qty', 'expires_at'])
    .where('product_id', '=', productId)
    .where('qty', '>', 0)
    .orderBy('expires_at', sql`asc nulls last`)
    .orderBy('received_at', 'asc')
    .forUpdate()
    .execute();

  const allocations: Allocation[] = [];
  let remaining = round3(qty);

  for (const batch of batches) {
    if (remaining <= 0) break;
    const take = Math.min(Number(batch.qty), remaining);
    if (take <= 0) continue;
    allocations.push({ batchId: batch.id, qty: round3(take) });
    remaining = round3(remaining - take);
  }

  // Saldo do produto que não está vinculado a nenhum lote (entradas antigas).
  if (remaining > 0) allocations.push({ batchId: null, qty: remaining });

  return allocations;
}

/** Cria ou reaproveita um lote na entrada de mercadoria. */
export async function upsertBatch(
  trx: Transaction<Database>,
  params: {
    productId: number;
    batchCode: string;
    expiresAt: string | null;
    costPrice: number;
  },
): Promise<number> {
  const existing = await trx
    .selectFrom('product_batches')
    .select(['id'])
    .where('product_id', '=', params.productId)
    .where('batch_code', '=', params.batchCode)
    .executeTakeFirst();

  if (existing) {
    await trx
      .updateTable('product_batches')
      .set({ expires_at: params.expiresAt, cost_price: params.costPrice })
      .where('id', '=', existing.id)
      .execute();
    return existing.id;
  }

  const created = await trx
    .insertInto('product_batches')
    .values({
      product_id: params.productId,
      batch_code: params.batchCode,
      expires_at: params.expiresAt,
      qty: 0,
      cost_price: params.costPrice,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  return created.id;
}

/** Custo médio ponderado após uma entrada. */
export function weightedAverageCost(
  currentQty: number,
  currentCost: number,
  incomingQty: number,
  incomingCost: number,
): number {
  const totalQty = currentQty + incomingQty;
  if (totalQty <= 0) return incomingCost;
  const value = currentQty * currentCost + incomingQty * incomingCost;
  return Math.round((value / totalQty) * 100) / 100;
}
