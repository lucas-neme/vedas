import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ErrorBox,
  InvoiceStatusBadge,
  Loading,
  Modal,
  PAYMENT_LABELS,
  SaleStatusBadge,
} from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';
import { currency, date, dateTime, decimal, formatDocument, percent } from '@/lib/format';
import type { Invoice, SaleDetail } from '@/types';

export function SaleDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceModel, setInvoiceModel] = useState<'55' | '65'>('55');

  const sale = useQuery({
    queryKey: ['sale', id],
    queryFn: () => api<SaleDetail>(`/sales/${id}`),
    enabled: Boolean(id),
  });

  const cancel = useMutation({
    mutationFn: () => api(`/sales/${id}/cancel`, { method: 'POST', body: { reason: cancelReason } }),
    onSuccess: () => {
      toast.success('Venda cancelada e estoque devolvido.');
      setCancelOpen(false);
      queryClient.invalidateQueries({ queryKey: ['sale', id] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const issue = useMutation({
    mutationFn: () =>
      api<Invoice>('/invoices', {
        method: 'POST',
        body: { sale_id: Number(id), model: invoiceModel },
      }),
    onSuccess: (invoice) => {
      toast.success(`Nota fiscal nº ${invoice.number} gerada.`);
      setInvoiceOpen(false);
      navigate(`/notas-fiscais/${invoice.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const settle = useMutation({
    mutationFn: (paymentId: number) =>
      api(`/sales/${id}/payments/${paymentId}/settle`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Pagamento baixado.');
      queryClient.invalidateQueries({ queryKey: ['sale', id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (sale.isLoading) return <Loading />;
  if (sale.error) return <ErrorBox error={sale.error} />;
  if (!sale.data) return null;

  const data = sale.data;
  const activeInvoice = data.invoices.find((invoice) => invoice.status !== 'cancelada');

  return (
    <div className="stack">
      <div className="row between wrap">
        <div className="row">
          <Link to="/vendas" className="btn ghost sm">
            ← Vendas
          </Link>
          <h1>Venda #{data.number}</h1>
          <SaleStatusBadge status={data.status} />
        </div>
        <div className="row">
          {data.status === 'confirmada' && !activeInvoice ? (
            <button type="button" className="btn" onClick={() => setInvoiceOpen(true)}>
              📄 Emitir nota fiscal
            </button>
          ) : null}
          {activeInvoice ? (
            <Link to={`/notas-fiscais/${activeInvoice.id}`} className="btn secondary">
              Ver NF nº {activeInvoice.number}
            </Link>
          ) : null}
          {data.status !== 'cancelada' ? (
            <button type="button" className="btn danger" onClick={() => setCancelOpen(true)}>
              Cancelar venda
            </button>
          ) : null}
        </div>
      </div>

      {data.status === 'cancelada' ? (
        <div className="alert error">
          Venda cancelada em {dateTime(data.cancelled_at)} · {data.cancel_reason}
        </div>
      ) : null}

      <div className="grid cols-4">
        <div className="stat">
          <div className="label">Total</div>
          <div className="value">{currency(data.total)}</div>
        </div>
        <div className="stat">
          <div className="label">Margem estimada</div>
          <div className="value">{currency(data.margin)}</div>
          <div className="hint">{percent(data.marginPercent)} sobre a venda</div>
        </div>
        <div className="stat">
          <div className="label">Data</div>
          <div className="value" style={{ fontSize: 17 }}>
            {dateTime(data.sold_at)}
          </div>
          <div className="hint">Vendedor: {data.user_name ?? '—'}</div>
        </div>
        <div className="stat">
          <div className="label">Cliente</div>
          <div className="value" style={{ fontSize: 17 }}>
            {data.customer_name ?? 'Consumidor'}
          </div>
          <div className="hint">
            {data.customer_document ? formatDocument(data.customer_document) : 'Não identificado'}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Itens</h2>
        </div>
        <div className="card-body tight table-wrap">
          <table>
            <thead>
              <tr>
                <th>Produto</th>
                <th>Lote</th>
                <th className="num">Qtd.</th>
                <th className="num">Preço</th>
                <th className="num">Desc.</th>
                <th className="num">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className="strong">{item.description}</div>
                    <div className="text-xs muted mono">{item.sku ?? '—'}</div>
                  </td>
                  <td className="text-sm">
                    {item.batch_code ? (
                      <>
                        <span className="mono">{item.batch_code}</span>
                        {item.expires_at ? (
                          <div className="text-xs muted">venc. {date(item.expires_at)}</div>
                        ) : null}
                      </>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td className="num">
                    {decimal(item.qty)} {item.unit ?? ''}
                  </td>
                  <td className="num">{currency(item.unit_price)}</td>
                  <td className="num">{item.discount > 0 ? currency(item.discount) : '—'}</td>
                  <td className="num strong">{currency(item.total)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={5} className="num muted">
                  Subtotal
                </td>
                <td className="num">{currency(data.items_total)}</td>
              </tr>
              {data.discount > 0 ? (
                <tr>
                  <td colSpan={5} className="num muted">
                    Desconto
                  </td>
                  <td className="num">- {currency(data.discount)}</td>
                </tr>
              ) : null}
              {data.freight > 0 ? (
                <tr>
                  <td colSpan={5} className="num muted">
                    Frete
                  </td>
                  <td className="num">{currency(data.freight)}</td>
                </tr>
              ) : null}
              <tr>
                <td colSpan={5} className="num strong">
                  Total
                </td>
                <td className="num strong" style={{ fontSize: 15 }}>
                  {currency(data.total)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-header">
            <h2>Pagamentos</h2>
          </div>
          <div className="card-body tight table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Forma</th>
                  <th className="num">Valor</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>
                      {PAYMENT_LABELS[payment.method] ?? payment.method}
                      {payment.installments > 1 ? (
                        <span className="muted"> · {payment.installments}x</span>
                      ) : null}
                    </td>
                    <td className="num strong">{currency(payment.amount)}</td>
                    <td className="text-sm">{payment.due_date ? date(payment.due_date) : '—'}</td>
                    <td>
                      {payment.paid ? (
                        <span className="badge green">Pago</span>
                      ) : (
                        <span className="badge amber">Em aberto</span>
                      )}
                    </td>
                    <td>
                      {!payment.paid ? (
                        <button
                          type="button"
                          className="btn secondary sm"
                          onClick={() => settle.mutate(payment.id)}
                          disabled={settle.isPending}
                        >
                          Dar baixa
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Documentos fiscais</h2>
          </div>
          <div className="card-body tight table-wrap">
            {data.invoices.length === 0 ? (
              <div className="empty">
                <span className="icon">📄</span>
                <p className="text-sm">Nenhuma nota emitida para esta venda.</p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Modelo</th>
                    <th>Nº / Série</th>
                    <th>Emissão</th>
                    <th className="num">Valor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {data.invoices.map((invoice) => (
                    <tr key={invoice.id}>
                      <td>{invoice.model === '55' ? 'NF-e' : 'NFC-e'}</td>
                      <td className="mono">
                        <Link to={`/notas-fiscais/${invoice.id}`}>
                          {invoice.number}/{invoice.series}
                        </Link>
                      </td>
                      <td className="text-sm">{dateTime(invoice.issued_at)}</td>
                      <td className="num">{currency(invoice.total)}</td>
                      <td>
                        <InvoiceStatusBadge status={invoice.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {data.notes ? (
        <div className="card">
          <div className="card-body">
            <div className="text-xs muted" style={{ fontWeight: 700, textTransform: 'uppercase' }}>
              Observações
            </div>
            <p style={{ margin: '4px 0 0' }}>{data.notes}</p>
          </div>
        </div>
      ) : null}

      {cancelOpen ? (
        <Modal
          title={`Cancelar venda #${data.number}`}
          size="narrow"
          onClose={() => setCancelOpen(false)}
          footer={
            <>
              <button type="button" className="btn secondary" onClick={() => setCancelOpen(false)}>
                Voltar
              </button>
              <button
                type="button"
                className="btn danger"
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending || cancelReason.trim().length < 3}
              >
                Confirmar cancelamento
              </button>
            </>
          }
        >
          <div className="stack">
            <div className="alert warn">
              Os produtos serão devolvidos ao estoque nos mesmos lotes de origem.
            </div>
            <div className="field">
              <label>Motivo do cancelamento</label>
              <textarea
                value={cancelReason}
                onChange={(event) => setCancelReason(event.target.value)}
                placeholder="Ex.: cliente desistiu da compra"
              />
            </div>
          </div>
        </Modal>
      ) : null}

      {invoiceOpen ? (
        <Modal
          title="Emitir documento fiscal"
          size="narrow"
          onClose={() => setInvoiceOpen(false)}
          footer={
            <>
              <button type="button" className="btn secondary" onClick={() => setInvoiceOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => issue.mutate()}
                disabled={issue.isPending}
              >
                {issue.isPending ? <span className="spinner" /> : 'Gerar documento'}
              </button>
            </>
          }
        >
          <div className="stack">
            <div className="field">
              <label>Modelo</label>
              <select
                value={invoiceModel}
                onChange={(event) => setInvoiceModel(event.target.value as '55' | '65')}
              >
                <option value="55">NF-e modelo 55 (exige destinatário identificado)</option>
                <option value="65">NFC-e modelo 65 (consumidor no varejo)</option>
              </select>
            </div>
            <div className="alert info">
              O sistema gera a chave de acesso e o XML no layout NF-e 4.00. A assinatura com
              certificado A1 e a transmissão à SEFAZ são feitas pelo integrador configurado —
              veja <code>docs/fiscal.md</code>.
            </div>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
