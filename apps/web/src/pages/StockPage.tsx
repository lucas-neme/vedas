import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  EmptyState,
  ErrorBox,
  ExpiryBadge,
  Field,
  Loading,
  Modal,
  MOVEMENT_LABELS,
  Pagination,
  TableSkeleton,
} from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { api, type Paginated } from '@/lib/api';
import { currency, date, dateTime, decimal, today } from '@/lib/format';
import type { Product, ProductBatch, StockAlerts, StockMovement, Supplier } from '@/types';

type Tab = 'alertas' | 'movimentacoes' | 'lotes';

export function StockPage() {
  const [tab, setTab] = useState<Tab>('alertas');
  const [action, setAction] = useState<'entrada' | 'ajuste' | 'perda' | null>(null);

  return (
    <div className="stack">
      <div className="row between wrap">
        <div className="tabs" style={{ marginBottom: 0, border: 'none' }}>
          <button type="button" className={tab === 'alertas' ? 'active' : ''} onClick={() => setTab('alertas')}>
            Alertas
          </button>
          <button
            type="button"
            className={tab === 'movimentacoes' ? 'active' : ''}
            onClick={() => setTab('movimentacoes')}
          >
            Movimentações
          </button>
          <button type="button" className={tab === 'lotes' ? 'active' : ''} onClick={() => setTab('lotes')}>
            Lotes e validades
          </button>
        </div>
        <div className="row">
          <button type="button" className="btn" onClick={() => setAction('entrada')}>
            + Entrada de mercadoria
          </button>
          <button type="button" className="btn secondary" onClick={() => setAction('ajuste')}>
            Ajuste de inventário
          </button>
          <button type="button" className="btn secondary" onClick={() => setAction('perda')}>
            Registrar perda
          </button>
        </div>
      </div>

      {tab === 'alertas' ? <AlertsTab /> : null}
      {tab === 'movimentacoes' ? <MovementsTab /> : null}
      {tab === 'lotes' ? <BatchesTab /> : null}

      {action ? <StockActionModal action={action} onClose={() => setAction(null)} /> : null}
    </div>
  );
}

function AlertsTab() {
  const alerts = useQuery({ queryKey: ['stock-alerts'], queryFn: () => api<StockAlerts>('/stock/alerts') });

  if (alerts.isLoading) return <Loading />;
  if (alerts.error) return <ErrorBox error={alerts.error} />;
  if (!alerts.data) return null;

  return (
    <div className="stack">
      {alerts.data.expired.length > 0 ? (
        <div className="alert error">
          <strong>{alerts.data.expired.length} lote(s) vencido(s)</strong> ainda com saldo em estoque.
          Registre a perda para regularizar o inventário.
        </div>
      ) : null}

      <div className="grid cols-2">
        <div className="card">
          <div className="card-header">
            <h2>Reposição necessária</h2>
            <span className="badge amber">{alerts.data.lowStock.length}</span>
          </div>
          <div className="card-body tight table-wrap">
            {alerts.data.lowStock.length === 0 ? (
              <EmptyState icon="✅" title="Estoque saudável" />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="num">Saldo</th>
                    <th className="num">Mínimo</th>
                    <th className="num">Sugestão</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.data.lowStock.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="strong">{row.name}</div>
                        <div className="text-xs muted mono">
                          {row.sku}
                          {row.brand_name ? ` · ${row.brand_name}` : ''}
                        </div>
                      </td>
                      <td className="num" style={{ color: 'var(--danger-700)', fontWeight: 600 }}>
                        {decimal(row.stock_qty)}
                      </td>
                      <td className="num muted">{decimal(row.min_stock)}</td>
                      <td className="num strong">
                        {decimal(Math.max(row.min_stock * 2 - row.stock_qty, 1))} {row.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Validades críticas</h2>
            <span className="text-sm muted">alerta em {alerts.data.alertDays} dias</span>
          </div>
          <div className="card-body tight table-wrap">
            {alerts.data.expiring.length === 0 && alerts.data.expired.length === 0 ? (
              <EmptyState icon="✅" title="Nenhum lote próximo do vencimento" />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Lote</th>
                    <th>Validade</th>
                    <th className="num">Saldo</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {alerts.data.expired.map((row) => (
                    <tr key={`expired-${row.id}`}>
                      <td className="strong">{row.product_name}</td>
                      <td className="mono text-sm">{row.batch_code}</td>
                      <td className="text-sm">{date(row.expires_at)}</td>
                      <td className="num">{decimal(row.qty)}</td>
                      <td>
                        <span className="badge red">Vencido</span>
                      </td>
                    </tr>
                  ))}
                  {alerts.data.expiring.map((row) => (
                    <tr key={`expiring-${row.id}`}>
                      <td className="strong">{row.product_name}</td>
                      <td className="mono text-sm">{row.batch_code}</td>
                      <td className="text-sm">{date(row.expires_at)}</td>
                      <td className="num">{decimal(row.qty)}</td>
                      <td>
                        <ExpiryBadge days={row.days_to_expire} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MovementsTab() {
  const [page, setPage] = useState(1);
  const [type, setType] = useState('');

  const movements = useQuery({
    queryKey: ['stock-movements', page, type],
    queryFn: () =>
      api<Paginated<StockMovement>>('/stock/movements', {
        query: { page, perPage: 25, type: type || undefined },
      }),
  });

  return (
    <div className="stack">
      <div className="toolbar">
        <select value={type} onChange={(event) => setType(event.target.value)} style={{ width: 180 }}>
          <option value="">Todos os tipos</option>
          {Object.entries(MOVEMENT_LABELS).map(([key, meta]) => (
            <option key={key} value={key}>
              {meta.label}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="card-body tight table-wrap">
          {movements.isLoading ? (
            <TableSkeleton cols={6} />
          ) : !movements.data?.data.length ? (
            <EmptyState icon="📋" title="Nenhuma movimentação registrada" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Produto</th>
                  <th>Tipo</th>
                  <th>Lote</th>
                  <th className="num">Qtd.</th>
                  <th className="num">Saldo após</th>
                  <th>Motivo</th>
                  <th>Usuário</th>
                </tr>
              </thead>
              <tbody>
                {movements.data.data.map((movement) => {
                  const meta = MOVEMENT_LABELS[movement.type] ?? { label: movement.type, tone: 'gray' };
                  return (
                    <tr key={movement.id}>
                      <td className="text-sm nowrap">{dateTime(movement.created_at)}</td>
                      <td>
                        <div className="strong">{movement.product_name}</div>
                        <div className="text-xs muted mono">{movement.product_sku}</div>
                      </td>
                      <td>
                        <span className={`badge ${meta.tone}`}>{meta.label}</span>
                      </td>
                      <td className="mono text-sm">{movement.batch_code ?? '—'}</td>
                      <td
                        className="num strong"
                        style={{ color: movement.qty >= 0 ? 'var(--brand-700)' : 'var(--danger-700)' }}
                      >
                        {movement.qty > 0 ? '+' : ''}
                        {decimal(movement.qty)}
                      </td>
                      <td className="num">{decimal(movement.balance_after)}</td>
                      <td className="text-sm muted">{movement.reason || '—'}</td>
                      <td className="text-sm muted">{movement.user_name ?? 'sistema'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {movements.data ? (
          <Pagination
            page={movements.data.meta.page}
            totalPages={movements.data.meta.totalPages}
            total={movements.data.meta.total}
            onChange={setPage}
          />
        ) : null}
      </div>
    </div>
  );
}

function BatchesTab() {
  const [expiringDays, setExpiringDays] = useState('');

  const batches = useQuery({
    queryKey: ['batches', expiringDays],
    queryFn: () =>
      api<ProductBatch[]>('/stock/batches', {
        query: { onlyWithStock: 'true', expiringDays: expiringDays || undefined },
      }),
  });

  return (
    <div className="stack">
      <div className="toolbar">
        <select
          value={expiringDays}
          onChange={(event) => setExpiringDays(event.target.value)}
          style={{ width: 220 }}
        >
          <option value="">Todos os lotes com saldo</option>
          <option value="30">Vencendo em até 30 dias</option>
          <option value="60">Vencendo em até 60 dias</option>
          <option value="90">Vencendo em até 90 dias</option>
        </select>
      </div>

      <div className="card">
        <div className="card-body tight table-wrap">
          {batches.isLoading ? (
            <TableSkeleton cols={6} />
          ) : !batches.data?.length ? (
            <EmptyState icon="🏷️" title="Nenhum lote encontrado" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Lote</th>
                  <th>Recebimento</th>
                  <th>Validade</th>
                  <th className="num">Saldo</th>
                  <th className="num">Custo</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {batches.data.map((batch) => (
                  <tr key={batch.id}>
                    <td>
                      <div className="strong">{batch.product_name}</div>
                      <div className="text-xs muted mono">{batch.product_sku}</div>
                    </td>
                    <td className="mono">{batch.batch_code}</td>
                    <td className="text-sm">{date(batch.received_at)}</td>
                    <td className="text-sm">{batch.expires_at ? date(batch.expires_at) : '—'}</td>
                    <td className="num strong">
                      {decimal(batch.qty)} {batch.product_unit}
                    </td>
                    <td className="num text-sm">{currency(batch.cost_price)}</td>
                    <td>
                      <ExpiryBadge days={batch.days_to_expire} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StockActionModal({
  action,
  onClose,
}: {
  action: 'entrada' | 'ajuste' | 'perda';
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState<number | ''>('');
  const [qty, setQty] = useState(0);
  const [unitCost, setUnitCost] = useState(0);
  const [batchCode, setBatchCode] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [supplierId, setSupplierId] = useState<number | ''>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [reason, setReason] = useState('');
  const [updateCost, setUpdateCost] = useState(true);
  const [batchId, setBatchId] = useState<number | ''>('');

  const products = useQuery({
    queryKey: ['products-stock', search],
    queryFn: () =>
      api<Paginated<Product>>('/products', {
        query: { perPage: 50, search: search || undefined, active: 'true' },
      }),
  });

  const suppliers = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api<Supplier[]>('/suppliers'),
    enabled: action === 'entrada',
  });

  const batches = useQuery({
    queryKey: ['batches-of', productId],
    queryFn: () => api<ProductBatch[]>('/stock/batches', { query: { productId: Number(productId) } }),
    enabled: action === 'perda' && productId !== '',
  });

  const selected = products.data?.data.find((product) => product.id === productId);

  const submit = useMutation({
    mutationFn: () => {
      if (action === 'entrada') {
        return api('/stock/entries', {
          method: 'POST',
          body: {
            product_id: productId,
            qty,
            unit_cost: unitCost,
            batch_code: batchCode,
            expires_at: expiresAt || null,
            supplier_id: supplierId === '' ? null : supplierId,
            invoice_number: invoiceNumber,
            update_cost_price: updateCost,
            reason,
          },
        });
      }
      if (action === 'ajuste') {
        return api('/stock/adjustments', {
          method: 'POST',
          body: { product_id: productId, counted_qty: qty, reason },
        });
      }
      return api('/stock/losses', {
        method: 'POST',
        body: {
          product_id: productId,
          batch_id: batchId === '' ? null : batchId,
          qty,
          reason,
        },
      });
    },
    onSuccess: () => {
      toast.success('Movimentação registrada.');
      queryClient.invalidateQueries({ queryKey: ['stock-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const titles = {
    entrada: 'Entrada de mercadoria',
    ajuste: 'Ajuste de inventário',
    perda: 'Registrar perda / vencimento',
  };

  return (
    <Modal
      title={titles[action]}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => submit.mutate()}
            disabled={submit.isPending || productId === '' || (action !== 'ajuste' && qty <= 0)}
          >
            {submit.isPending ? <span className="spinner" /> : 'Confirmar'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Buscar produto" className="col-12">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome, SKU ou código de barras..."
          />
        </Field>
        <Field label="Produto" className="col-12">
          <select
            value={productId}
            onChange={(event) => {
              const value = event.target.value === '' ? '' : Number(event.target.value);
              setProductId(value);
              const product = products.data?.data.find((item) => item.id === value);
              if (product && action === 'entrada') setUnitCost(product.cost_price);
              if (product && action === 'ajuste') setQty(product.stock_qty);
            }}
          >
            <option value="">Selecione...</option>
            {products.data?.data.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} · saldo {decimal(product.stock_qty)} {product.unit}
              </option>
            ))}
          </select>
        </Field>

        {action === 'entrada' ? (
          <>
            <Field label="Quantidade recebida" className="col-4">
              <input type="number" step="0.001" min="0" value={qty} onChange={(event) => setQty(Number(event.target.value))} />
            </Field>
            <Field label="Custo unitário (R$)" className="col-4">
              <input
                type="number"
                step="0.01"
                min="0"
                value={unitCost}
                onChange={(event) => setUnitCost(Number(event.target.value))}
              />
            </Field>
            <Field label="Nº da NF de compra" className="col-4">
              <input value={invoiceNumber} onChange={(event) => setInvoiceNumber(event.target.value)} />
            </Field>
            {selected?.requires_batch ? (
              <>
                <Field label="Lote" className="col-6" help="Deixe em branco para não rastrear este recebimento">
                  <input value={batchCode} onChange={(event) => setBatchCode(event.target.value)} />
                </Field>
                <Field label="Validade" className="col-6">
                  <input
                    type="date"
                    min={today()}
                    value={expiresAt}
                    onChange={(event) => setExpiresAt(event.target.value)}
                  />
                </Field>
              </>
            ) : null}
            <Field label="Fornecedor" className="col-8">
              <select
                value={supplierId}
                onChange={(event) =>
                  setSupplierId(event.target.value === '' ? '' : Number(event.target.value))
                }
              >
                <option value="">Não informado</option>
                {suppliers.data?.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Atualizar custo" className="col-4">
              <label className="checkbox" style={{ paddingTop: 8 }}>
                <input
                  type="checkbox"
                  checked={updateCost}
                  onChange={(event) => setUpdateCost(event.target.checked)}
                />
                Custo médio
              </label>
            </Field>
          </>
        ) : null}

        {action === 'ajuste' ? (
          <Field
            label="Saldo real contado"
            className="col-6"
            help={selected ? `Saldo do sistema: ${decimal(selected.stock_qty)} ${selected.unit}` : undefined}
          >
            <input type="number" step="0.001" min="0" value={qty} onChange={(event) => setQty(Number(event.target.value))} />
          </Field>
        ) : null}

        {action === 'perda' ? (
          <>
            <Field label="Quantidade perdida" className="col-6">
              <input type="number" step="0.001" min="0" value={qty} onChange={(event) => setQty(Number(event.target.value))} />
            </Field>
            <Field label="Lote (opcional)" className="col-6">
              <select
                value={batchId}
                onChange={(event) => setBatchId(event.target.value === '' ? '' : Number(event.target.value))}
              >
                <option value="">Sem lote específico</option>
                {batches.data?.map((batch) => (
                  <option key={batch.id} value={batch.id}>
                    {batch.batch_code} · saldo {decimal(batch.qty)}
                    {batch.expires_at ? ` · venc. ${date(batch.expires_at)}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          </>
        ) : null}

        <Field
          label={action === 'entrada' ? 'Observação' : 'Motivo'}
          className="col-12"
          help={action !== 'entrada' ? 'Obrigatório — fica registrado no histórico' : undefined}
        >
          <input value={reason} onChange={(event) => setReason(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
