import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  EmptyState,
  ErrorBox,
  Loading,
  PAYMENT_LABELS,
  SPECIES_ICONS,
  TableSkeleton,
} from '@/components/ui';
import { api } from '@/lib/api';
import { currency, date, daysAgo, decimal, formatPhone, percent, today, whatsappLink } from '@/lib/format';
import type { RepurchaseRow } from '@/types';

type Tab = 'vendas' | 'produtos' | 'clientes' | 'recompra' | 'inativos';

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>('vendas');
  const [from, setFrom] = useState(daysAgo(30));
  const [to, setTo] = useState(today());

  return (
    <div className="stack">
      <div className="tabs">
        <button type="button" className={tab === 'vendas' ? 'active' : ''} onClick={() => setTab('vendas')}>
          Vendas
        </button>
        <button type="button" className={tab === 'produtos' ? 'active' : ''} onClick={() => setTab('produtos')}>
          Produtos e margem
        </button>
        <button type="button" className={tab === 'clientes' ? 'active' : ''} onClick={() => setTab('clientes')}>
          Melhores clientes
        </button>
        <button type="button" className={tab === 'recompra' ? 'active' : ''} onClick={() => setTab('recompra')}>
          🐾 Previsão de recompra
        </button>
        <button type="button" className={tab === 'inativos' ? 'active' : ''} onClick={() => setTab('inativos')}>
          Clientes inativos
        </button>
      </div>

      {tab !== 'recompra' && tab !== 'inativos' ? (
        <div className="toolbar">
          <label className="text-sm muted">Período</label>
          <input type="date" value={from} onChange={(event) => setFrom(event.target.value)} style={{ width: 160 }} />
          <span className="muted">até</span>
          <input type="date" value={to} onChange={(event) => setTo(event.target.value)} style={{ width: 160 }} />
        </div>
      ) : null}

      {tab === 'vendas' ? <SalesReport from={from} to={to} /> : null}
      {tab === 'produtos' ? <ProductsReport from={from} to={to} /> : null}
      {tab === 'clientes' ? <CustomersReport from={from} to={to} /> : null}
      {tab === 'recompra' ? <RepurchaseReport /> : null}
      {tab === 'inativos' ? <InactiveReport /> : null}
    </div>
  );
}

function SalesReport({ from, to }: { from: string; to: string }) {
  const report = useQuery({
    queryKey: ['report-sales', from, to],
    queryFn: () =>
      api<{
        periods: Array<{
          period: string;
          count: number;
          total: number;
          cost: number;
          margin: number;
          discount: number;
        }>;
        byPayment: Array<{ method: string; total: number; count: number }>;
      }>('/reports/sales', { query: { from, to, groupBy: 'day' } }),
  });

  if (report.isLoading) return <Loading />;
  if (report.error) return <ErrorBox error={report.error} />;
  if (!report.data) return null;

  const totals = report.data.periods.reduce(
    (acc, row) => ({
      count: acc.count + row.count,
      total: acc.total + row.total,
      margin: acc.margin + row.margin,
      discount: acc.discount + row.discount,
    }),
    { count: 0, total: 0, margin: 0, discount: 0 },
  );

  return (
    <div className="stack">
      <div className="grid cols-4">
        <div className="stat accent">
          <div className="label">Faturamento</div>
          <div className="value">{currency(totals.total)}</div>
        </div>
        <div className="stat">
          <div className="label">Margem bruta</div>
          <div className="value">{currency(totals.margin)}</div>
          <div className="hint">
            {percent(totals.total > 0 ? (totals.margin / totals.total) * 100 : 0)}
          </div>
        </div>
        <div className="stat">
          <div className="label">Vendas</div>
          <div className="value">{totals.count}</div>
          <div className="hint">
            Ticket médio {currency(totals.count > 0 ? totals.total / totals.count : 0)}
          </div>
        </div>
        <div className="stat warn">
          <div className="label">Descontos concedidos</div>
          <div className="value">{currency(totals.discount)}</div>
        </div>
      </div>

      <div className="grid cols-3">
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <h2>Faturamento por dia</h2>
          </div>
          <div className="card-body">
            <BarChart
              data={report.data.periods.map((row) => ({ label: date(row.period), value: row.total }))}
              formatValue={currency}
            />
          </div>
        </div>
        <div className="card">
          <div className="card-header">
            <h2>Por forma de pagamento</h2>
          </div>
          <div className="card-body tight table-wrap">
            {report.data.byPayment.length === 0 ? (
              <EmptyState icon="💳" title="Sem pagamentos no período" />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Forma</th>
                    <th className="num">Qtd.</th>
                    <th className="num">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.data.byPayment.map((row) => (
                    <tr key={row.method}>
                      <td>{PAYMENT_LABELS[row.method] ?? row.method}</td>
                      <td className="num">{row.count}</td>
                      <td className="num strong">{currency(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Detalhamento diário</h2>
        </div>
        <div className="card-body tight table-wrap">
          <table>
            <thead>
              <tr>
                <th>Dia</th>
                <th className="num">Vendas</th>
                <th className="num">Faturamento</th>
                <th className="num">Custo</th>
                <th className="num">Margem</th>
                <th className="num">%</th>
              </tr>
            </thead>
            <tbody>
              {report.data.periods.map((row) => (
                <tr key={row.period}>
                  <td>{date(row.period)}</td>
                  <td className="num">{row.count}</td>
                  <td className="num strong">{currency(row.total)}</td>
                  <td className="num muted">{currency(row.cost)}</td>
                  <td className="num">{currency(row.margin)}</td>
                  <td className="num">{percent(row.total > 0 ? (row.margin / row.total) * 100 : 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProductsReport({ from, to }: { from: string; to: string }) {
  const report = useQuery({
    queryKey: ['report-products', from, to],
    queryFn: () =>
      api<
        Array<{
          id: number;
          sku: string;
          name: string;
          unit: string;
          stock_qty: number;
          category_name: string | null;
          qty: number;
          revenue: number;
          cost: number;
          margin: number;
          marginPercent: number;
        }>
      >('/reports/products', { query: { from, to, limit: 100 } }),
  });

  if (report.isLoading) return <Loading />;
  if (report.error) return <ErrorBox error={report.error} />;

  return (
    <div className="card">
      <div className="card-header">
        <h2>Curva de produtos</h2>
        <span className="text-sm muted">ordenado por receita</span>
      </div>
      <div className="card-body tight table-wrap">
        {!report.data?.length ? (
          <EmptyState icon="📦" title="Nenhuma venda no período" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Produto</th>
                <th>Categoria</th>
                <th className="num">Qtd. vendida</th>
                <th className="num">Receita</th>
                <th className="num">Margem</th>
                <th className="num">%</th>
                <th className="num">Saldo atual</th>
              </tr>
            </thead>
            <tbody>
              {report.data.map((row, index) => (
                <tr key={row.id}>
                  <td className="muted">{index + 1}</td>
                  <td>
                    <div className="strong">{row.name}</div>
                    <div className="text-xs muted mono">{row.sku}</div>
                  </td>
                  <td className="text-sm">{row.category_name ?? '—'}</td>
                  <td className="num">
                    {decimal(row.qty)} {row.unit}
                  </td>
                  <td className="num strong">{currency(row.revenue)}</td>
                  <td className="num">{currency(row.margin)}</td>
                  <td
                    className="num"
                    style={{ color: row.marginPercent < 15 ? 'var(--danger-700)' : undefined }}
                  >
                    {percent(row.marginPercent, 0)}
                  </td>
                  <td className="num muted">{decimal(row.stock_qty)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function CustomersReport({ from, to }: { from: string; to: string }) {
  const report = useQuery({
    queryKey: ['report-customers', from, to],
    queryFn: () =>
      api<
        Array<{
          id: number;
          name: string;
          phone: string;
          email: string;
          sales_count: number;
          total: number;
          average_ticket: number;
          last_purchase: string;
        }>
      >('/reports/customers', { query: { from, to, limit: 50 } }),
  });

  if (report.isLoading) return <Loading />;
  if (report.error) return <ErrorBox error={report.error} />;

  return (
    <div className="card">
      <div className="card-header">
        <h2>Melhores clientes</h2>
      </div>
      <div className="card-body tight table-wrap">
        {!report.data?.length ? (
          <EmptyState icon="👤" title="Nenhuma venda identificada no período" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Cliente</th>
                <th>Contato</th>
                <th className="num">Compras</th>
                <th className="num">Total</th>
                <th className="num">Ticket médio</th>
                <th>Última compra</th>
              </tr>
            </thead>
            <tbody>
              {report.data.map((row, index) => (
                <tr key={row.id}>
                  <td className="muted">{index + 1}</td>
                  <td>
                    <Link to={`/clientes/${row.id}`} className="strong">
                      {row.name}
                    </Link>
                  </td>
                  <td className="text-sm">{formatPhone(row.phone) || row.email || '—'}</td>
                  <td className="num">{Number(row.sales_count)}</td>
                  <td className="num strong">{currency(row.total)}</td>
                  <td className="num">{currency(row.average_ticket)}</td>
                  <td className="text-sm">{date(row.last_purchase)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RepurchaseReport() {
  const [withinDays, setWithinDays] = useState(15);

  const report = useQuery({
    queryKey: ['report-repurchase', withinDays],
    queryFn: () =>
      api<{ withinDays: number; due: RepurchaseRow[]; all: RepurchaseRow[] }>('/reports/repurchase', {
        query: { withinDays },
      }),
  });

  if (report.isLoading) return <Loading />;
  if (report.error) return <ErrorBox error={report.error} />;

  return (
    <div className="stack">
      <div className="alert info">
        A previsão usa o <strong>consumo diário</strong> informado no cadastro do pet, o{' '}
        <strong>peso da embalagem</strong> da ração e a <strong>data da última compra</strong> daquele
        produto pelo tutor. Cadastre esses três dados para que o pet apareça aqui.
      </div>

      <div className="toolbar">
        <label className="text-sm muted">Mostrar quem precisa repor em até</label>
        <select
          value={withinDays}
          onChange={(event) => setWithinDays(Number(event.target.value))}
          style={{ width: 130 }}
        >
          <option value={7}>7 dias</option>
          <option value={15}>15 dias</option>
          <option value={30}>30 dias</option>
        </select>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Contatos prioritários</h2>
          <span className="badge amber">{report.data?.due.length ?? 0}</span>
        </div>
        <div className="card-body tight table-wrap">
          {!report.data?.due.length ? (
            <EmptyState
              icon="🐕"
              title="Ninguém precisa repor agora"
              description="Cadastre a ração habitual e o consumo diário dos pets para alimentar esta previsão."
            />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Pet</th>
                  <th>Tutor</th>
                  <th>Ração</th>
                  <th>Última compra</th>
                  <th className="num">Duração</th>
                  <th>Previsão</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {report.data.due.map((row) => (
                  <tr key={row.pet_id}>
                    <td className="strong">
                      {SPECIES_ICONS[row.species] ?? '🐾'} {row.pet_name}
                    </td>
                    <td>
                      <Link to={`/clientes/${row.customer_id}`}>{row.customer_name}</Link>
                      <div className="text-xs muted">{formatPhone(row.customer_phone)}</div>
                    </td>
                    <td className="text-sm">{row.product_name}</td>
                    <td className="text-sm">{row.last_purchase ? date(row.last_purchase) : '—'}</td>
                    <td className="num text-sm">{row.days_of_food ?? '—'} dias</td>
                    <td>
                      {row.daysRemaining !== null && row.daysRemaining <= 0 ? (
                        <span className="badge red">Acabou há {Math.abs(row.daysRemaining)} dias</span>
                      ) : (
                        <span className="badge amber">Em {row.daysRemaining} dias</span>
                      )}
                      <div className="text-xs muted">{row.expected_date ? date(row.expected_date) : ''}</div>
                    </td>
                    <td>
                      {row.customer_phone ? (
                        <a
                          className="btn secondary sm"
                          href={whatsappLink(
                            row.customer_phone,
                            `Olá! Notamos que a ração do ${row.pet_name} deve estar acabando. Quer que separemos um pacote de ${row.product_name}? 🐾`,
                          )}
                          target="_blank"
                          rel="noreferrer"
                        >
                          💬 Chamar
                        </a>
                      ) : null}
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

function InactiveReport() {
  const [days, setDays] = useState(90);

  const report = useQuery({
    queryKey: ['report-inactive', days],
    queryFn: () =>
      api<
        Array<{
          id: number;
          name: string;
          phone: string;
          email: string;
          last_purchase: string;
          days_since: number;
          total_spent: number;
        }>
      >('/reports/inactive-customers', { query: { days } }),
  });

  return (
    <div className="stack">
      <div className="toolbar">
        <label className="text-sm muted">Sem comprar há mais de</label>
        <select value={days} onChange={(event) => setDays(Number(event.target.value))} style={{ width: 130 }}>
          <option value={30}>30 dias</option>
          <option value={60}>60 dias</option>
          <option value={90}>90 dias</option>
          <option value={180}>180 dias</option>
        </select>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Clientes para reativar</h2>
          <span className="badge">{report.data?.length ?? 0}</span>
        </div>
        <div className="card-body tight table-wrap">
          {report.isLoading ? (
            <TableSkeleton cols={5} />
          ) : !report.data?.length ? (
            <EmptyState icon="🎉" title="Nenhum cliente inativo nesse intervalo" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contato</th>
                  <th>Última compra</th>
                  <th className="num">Dias sem comprar</th>
                  <th className="num">Total histórico</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {report.data.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link to={`/clientes/${row.id}`} className="strong">
                        {row.name}
                      </Link>
                    </td>
                    <td className="text-sm">{formatPhone(row.phone) || row.email || '—'}</td>
                    <td className="text-sm">{date(row.last_purchase)}</td>
                    <td className="num strong">{row.days_since}</td>
                    <td className="num">{currency(row.total_spent)}</td>
                    <td>
                      {row.phone ? (
                        <a
                          className="btn secondary sm"
                          href={whatsappLink(
                            row.phone,
                            `Olá ${row.name.split(' ')[0]}! Sentimos sua falta por aqui 🐾 Temos novidades e condições especiais para o seu pet.`,
                          )}
                          target="_blank"
                          rel="noreferrer"
                        >
                          💬 Chamar
                        </a>
                      ) : null}
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
