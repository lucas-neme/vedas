import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  EmptyState,
  ErrorBox,
  InvoiceStatusBadge,
  Pagination,
  SaleStatusBadge,
  TableSkeleton,
} from '@/components/ui';
import { api, type Paginated } from '@/lib/api';
import { currency, dateTime, daysAgo, today } from '@/lib/format';
import type { SaleListItem } from '@/types';

type SalesResponse = Paginated<SaleListItem> & { summary: { total: number; count: number } };

export function SalesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());

  const sales = useQuery({
    queryKey: ['sales', page, search, status, from, to],
    queryFn: () =>
      api<SalesResponse>('/sales', {
        query: { page, perPage: 20, search: search || undefined, status: status || undefined, from, to },
      }),
  });

  return (
    <div className="stack">
      <div className="toolbar">
        <input
          className="search"
          placeholder="Buscar pelo número da venda..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select
          value={status}
          onChange={(event) => {
            setStatus(event.target.value);
            setPage(1);
          }}
          style={{ width: 160 }}
        >
          <option value="">Todos os status</option>
          <option value="confirmada">Confirmadas</option>
          <option value="cancelada">Canceladas</option>
          <option value="rascunho">Rascunhos</option>
        </select>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} style={{ width: 150 }} />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} style={{ width: 150 }} />
        <div className="spacer" />
        <Link to="/pdv" className="btn">
          + Nova venda
        </Link>
      </div>

      {sales.data ? (
        <div className="grid cols-3">
          <div className="stat accent">
            <div className="label">Faturamento no período</div>
            <div className="value">{currency(sales.data.summary.total)}</div>
          </div>
          <div className="stat">
            <div className="label">Vendas confirmadas</div>
            <div className="value">{sales.data.summary.count}</div>
          </div>
          <div className="stat">
            <div className="label">Ticket médio</div>
            <div className="value">
              {currency(
                sales.data.summary.count > 0
                  ? sales.data.summary.total / sales.data.summary.count
                  : 0,
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="card">
        <div className="card-body tight table-wrap">
          <ErrorBox error={sales.error} />
          {sales.isLoading ? (
            <TableSkeleton cols={6} />
          ) : !sales.data?.data.length ? (
            <EmptyState icon="🧾" title="Nenhuma venda encontrada" description="Ajuste os filtros ou registre uma venda no PDV." />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Data</th>
                  <th>Cliente</th>
                  <th>Vendedor</th>
                  <th>Canal</th>
                  <th className="num">Total</th>
                  <th>Status</th>
                  <th>NF</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sales.data.data.map((sale) => (
                  <tr key={sale.id}>
                    <td className="mono strong">#{sale.number}</td>
                    <td className="text-sm nowrap">{dateTime(sale.sold_at)}</td>
                    <td>{sale.customer_name ?? <span className="muted">Consumidor</span>}</td>
                    <td className="text-sm muted">{sale.user_name ?? '—'}</td>
                    <td className="text-sm" style={{ textTransform: 'capitalize' }}>{sale.channel}</td>
                    <td className="num strong">{currency(sale.total)}</td>
                    <td>
                      <SaleStatusBadge status={sale.status} />
                    </td>
                    <td>
                      {sale.invoice_id ? (
                        <Link to={`/notas-fiscais/${sale.invoice_id}`}>
                          <InvoiceStatusBadge status={sale.invoice_status ?? 'gerada'} />
                        </Link>
                      ) : (
                        <span className="muted text-sm">—</span>
                      )}
                    </td>
                    <td className="nowrap">
                      <Link to={`/vendas/${sale.id}`} className="btn secondary sm">
                        Detalhes
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {sales.data ? (
          <Pagination
            page={sales.data.meta.page}
            totalPages={sales.data.meta.totalPages}
            total={sales.data.meta.total}
            onChange={setPage}
          />
        ) : null}
      </div>
    </div>
  );
}
