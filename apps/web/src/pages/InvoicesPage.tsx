import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorBox, InvoiceStatusBadge, Pagination, TableSkeleton } from '@/components/ui';
import { api, type Paginated } from '@/lib/api';
import { currency, dateTime, daysAgo, formatAccessKey, today } from '@/lib/format';
import type { Invoice } from '@/types';

export function InvoicesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [model, setModel] = useState('');
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());

  const invoices = useQuery({
    queryKey: ['invoices', page, search, status, model, from, to],
    queryFn: () =>
      api<Paginated<Invoice>>('/invoices', {
        query: {
          page,
          perPage: 20,
          search: search || undefined,
          status: status || undefined,
          model: model || undefined,
          from,
          to,
        },
      }),
  });

  return (
    <div className="stack">
      <div className="toolbar">
        <input
          className="search"
          placeholder="Buscar por número ou chave de acesso..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select value={model} onChange={(event) => setModel(event.target.value)} style={{ width: 150 }}>
          <option value="">Todos os modelos</option>
          <option value="55">NF-e (55)</option>
          <option value="65">NFC-e (65)</option>
        </select>
        <select value={status} onChange={(event) => setStatus(event.target.value)} style={{ width: 160 }}>
          <option value="">Todos os status</option>
          <option value="gerada">Gerada</option>
          <option value="assinada">Assinada</option>
          <option value="autorizada">Autorizada</option>
          <option value="rejeitada">Rejeitada</option>
          <option value="cancelada">Cancelada</option>
        </select>
        <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} style={{ width: 150 }} />
        <input type="date" value={to} onChange={(event) => setTo(event.target.value)} style={{ width: 150 }} />
      </div>

      <div className="card">
        <div className="card-body tight table-wrap">
          <ErrorBox error={invoices.error} />
          {invoices.isLoading ? (
            <TableSkeleton cols={6} />
          ) : !invoices.data?.data.length ? (
            <EmptyState
              icon="📄"
              title="Nenhuma nota fiscal no período"
              description="As notas são emitidas a partir da tela de detalhes de uma venda."
            />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Modelo</th>
                  <th>Nº / Série</th>
                  <th>Chave de acesso</th>
                  <th>Cliente</th>
                  <th>Emissão</th>
                  <th className="num">Valor</th>
                  <th>Ambiente</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invoices.data.data.map((invoice) => (
                  <tr key={invoice.id}>
                    <td>{invoice.model === '55' ? 'NF-e' : 'NFC-e'}</td>
                    <td className="mono strong">
                      {invoice.number}/{invoice.series}
                    </td>
                    <td className="mono text-xs">{formatAccessKey(invoice.access_key)}</td>
                    <td>{invoice.customer_name ?? <span className="muted">Consumidor</span>}</td>
                    <td className="text-sm nowrap">{dateTime(invoice.issued_at)}</td>
                    <td className="num strong">{currency(invoice.total)}</td>
                    <td>
                      {invoice.environment === '2' ? (
                        <span className="badge amber">Homologação</span>
                      ) : (
                        <span className="badge green">Produção</span>
                      )}
                    </td>
                    <td>
                      <InvoiceStatusBadge status={invoice.status} />
                    </td>
                    <td className="nowrap">
                      <Link to={`/notas-fiscais/${invoice.id}`} className="btn secondary sm">
                        DANFE
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {invoices.data ? (
          <Pagination
            page={invoices.data.meta.page}
            totalPages={invoices.data.meta.totalPages}
            total={invoices.data.meta.total}
            onChange={setPage}
          />
        ) : null}
      </div>
    </div>
  );
}
