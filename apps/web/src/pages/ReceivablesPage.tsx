import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorBox, PAYMENT_LABELS, TableSkeleton } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';
import { currency, date, formatPhone, whatsappLink } from '@/lib/format';

type Receivable = {
  id: number;
  method: string;
  amount: number;
  installments: number;
  due_date: string | null;
  sale_id: number;
  sale_number: number;
  sold_at: string;
  customer_name: string | null;
  customer_phone: string | null;
};

export function ReceivablesPage() {
  const toast = useToast();
  const queryClient = useQueryClient();

  const receivables = useQuery({
    queryKey: ['receivables'],
    queryFn: () => api<Receivable[]>('/sales/receivables/open'),
  });

  const settle = useMutation({
    mutationFn: (row: Receivable) =>
      api(`/sales/${row.sale_id}/payments/${row.id}/settle`, { method: 'POST' }),
    onSuccess: () => {
      toast.success('Pagamento baixado.');
      queryClient.invalidateQueries({ queryKey: ['receivables'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = receivables.data ?? [];
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const overdue = rows.filter((row) => row.due_date && row.due_date < new Date().toISOString().slice(0, 10));
  const overdueTotal = overdue.reduce((sum, row) => sum + row.amount, 0);

  return (
    <div className="stack">
      <div className="grid cols-3">
        <div className="stat accent">
          <div className="label">Total em aberto</div>
          <div className="value">{currency(total)}</div>
          <div className="hint">{rows.length} título(s)</div>
        </div>
        <div className="stat danger">
          <div className="label">Vencido</div>
          <div className="value">{currency(overdueTotal)}</div>
          <div className="hint">{overdue.length} título(s) em atraso</div>
        </div>
        <div className="stat">
          <div className="label">A vencer</div>
          <div className="value">{currency(total - overdueTotal)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Crediário e boletos em aberto</h2>
        </div>
        <div className="card-body tight table-wrap">
          <ErrorBox error={receivables.error} />
          {receivables.isLoading ? (
            <TableSkeleton cols={5} />
          ) : !rows.length ? (
            <EmptyState icon="✅" title="Nada a receber" description="Todos os pagamentos estão quitados." />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Venda</th>
                  <th>Forma</th>
                  <th>Vencimento</th>
                  <th className="num">Valor</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isOverdue =
                    row.due_date !== null && row.due_date < new Date().toISOString().slice(0, 10);
                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="strong">{row.customer_name ?? 'Consumidor'}</div>
                        {row.customer_phone ? (
                          <div className="text-xs muted">{formatPhone(row.customer_phone)}</div>
                        ) : null}
                      </td>
                      <td>
                        <Link to={`/vendas/${row.sale_id}`} className="mono">
                          #{row.sale_number}
                        </Link>
                        <div className="text-xs muted">{date(row.sold_at)}</div>
                      </td>
                      <td className="text-sm">
                        {PAYMENT_LABELS[row.method] ?? row.method}
                        {row.installments > 1 ? ` · ${row.installments}x` : ''}
                      </td>
                      <td className="text-sm">
                        {row.due_date ? date(row.due_date) : '—'}
                        {isOverdue ? <span className="badge red" style={{ marginLeft: 6 }}>Vencido</span> : null}
                      </td>
                      <td className="num strong">{currency(row.amount)}</td>
                      <td className="nowrap">
                        {row.customer_phone ? (
                          <a
                            className="btn ghost sm"
                            href={whatsappLink(
                              row.customer_phone,
                              `Olá! Passando para lembrar do pagamento de ${currency(row.amount)} referente à compra #${row.sale_number}. 🐾`,
                            )}
                            target="_blank"
                            rel="noreferrer"
                          >
                            💬
                          </a>
                        ) : null}
                        <button
                          type="button"
                          className="btn secondary sm"
                          onClick={() => settle.mutate(row)}
                          disabled={settle.isPending}
                        >
                          Dar baixa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
