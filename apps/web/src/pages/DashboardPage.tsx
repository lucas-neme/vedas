import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  BarChart,
  EmptyState,
  ErrorBox,
  SaleStatusBadge,
  StatSkeleton,
  TableSkeleton,
} from '@/components/ui';
import { api } from '@/lib/api';
import { currency, date, dateTime, decimal } from '@/lib/format';
import type { Dashboard, StockAlerts } from '@/types';

export function DashboardPage() {
  const dashboard = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api<Dashboard>('/reports/dashboard'),
  });

  const alerts = useQuery({
    queryKey: ['stock-alerts'],
    queryFn: () => api<StockAlerts>('/stock/alerts'),
  });

  if (dashboard.isLoading) {
    return (
      <div className="stack">
        <StatSkeleton />
        <div className="grid cols-3">
          <div className="card span-2">
            <div className="card-body">
              <TableSkeleton rows={5} cols={3} />
            </div>
          </div>
          <div className="card">
            <div className="card-body">
              <TableSkeleton rows={5} cols={2} />
            </div>
          </div>
        </div>
      </div>
    );
  }
  if (dashboard.error) return <ErrorBox error={dashboard.error} />;
  if (!dashboard.data) return null;

  const data = dashboard.data;

  return (
    <div className="stack">
      <div className="grid cols-4">
        <div className="stat accent">
          <div className="label">Vendas hoje</div>
          <div className="value">{currency(data.today.total)}</div>
          <div className="hint">
            {data.today.count} venda{data.today.count === 1 ? '' : 's'} · ticket médio{' '}
            {currency(data.today.averageTicket)}
          </div>
        </div>
        <div className="stat">
          <div className="label">Vendas no mês</div>
          <div className="value">{currency(data.month.total)}</div>
          <div className="hint">
            Margem estimada {currency(data.month.margin)} · {data.month.count} vendas
          </div>
        </div>
        <div className="stat warn">
          <div className="label">Estoque</div>
          <div className="value">{currency(data.stock.stockValue)}</div>
          <div className="hint">
            {data.stock.products} produtos ativos · {data.stock.lowStock} abaixo do mínimo
          </div>
        </div>
        <div className="stat danger">
          <div className="label">A receber</div>
          <div className="value">{currency(data.receivables.total)}</div>
          <div className="hint">
            {data.receivables.count} título(s) · {currency(data.receivables.overdue)} vencido
          </div>
        </div>
      </div>

      <div className="grid cols-3">
        <div className="card span-2">
          <div className="card-header">
            <h2>Vendas dos últimos 30 dias</h2>
            <span className="text-sm muted">
              Total {currency(data.salesByDay.reduce((sum, point) => sum + point.total, 0))}
            </span>
          </div>
          <div className="card-body">
            <BarChart
              data={data.salesByDay.map((point) => ({
                label: date(point.day),
                value: point.total,
              }))}
              formatValue={currency}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Por categoria</h2>
          </div>
          <div className="card-body stack sm">
            {data.byCategory.length === 0 ? (
              <EmptyState icon="🗂️" title="Sem vendas no período" />
            ) : (
              data.byCategory.map((row) => {
                const max = data.byCategory[0].total || 1;
                return (
                  <div key={row.category}>
                    <div className="row between text-sm">
                      <span>{row.category}</span>
                      <span className="strong">{currency(row.total)}</span>
                    </div>
                    <div className="progress" style={{ marginTop: 4 }}>
                      <span style={{ width: `${(row.total / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-header">
            <h2>Mais vendidos (30 dias)</h2>
            <Link to="/relatorios" className="text-sm">
              Ver relatório
            </Link>
          </div>
          <div className="card-body tight table-wrap">
            {data.topProducts.length === 0 ? (
              <EmptyState icon="📦" title="Nenhuma venda registrada ainda" />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="num">Qtd.</th>
                    <th className="num">Receita</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <div className="strong">{product.name}</div>
                        <div className="text-xs muted mono">{product.sku}</div>
                      </td>
                      <td className="num">
                        {decimal(product.qty)} {product.unit}
                      </td>
                      <td className="num strong">{currency(product.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Últimas vendas</h2>
            <Link to="/vendas" className="text-sm">
              Ver todas
            </Link>
          </div>
          <div className="card-body tight table-wrap">
            {data.recentSales.length === 0 ? (
              <EmptyState
                icon="🛒"
                title="Nenhuma venda ainda"
                description="Registre a primeira no PDV."
              />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Cliente</th>
                    <th>Data</th>
                    <th className="num">Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.recentSales.map((sale) => (
                    <tr key={sale.id}>
                      <td className="mono">#{sale.number}</td>
                      <td>{sale.customer_name ?? <span className="muted">Consumidor</span>}</td>
                      <td className="text-sm muted nowrap">{dateTime(sale.sold_at)}</td>
                      <td className="num strong">{currency(sale.total)}</td>
                      <td>
                        <SaleStatusBadge status={sale.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      <div className="grid cols-2">
        <div className="card">
          <div className="card-header">
            <h2>⚠️ Estoque abaixo do mínimo</h2>
            <Link to="/estoque" className="text-sm">
              Repor
            </Link>
          </div>
          <div className="card-body tight table-wrap">
            {alerts.isLoading ? (
              <TableSkeleton rows={4} cols={3} />
            ) : !alerts.data?.lowStock.length ? (
              <EmptyState icon="✅" title="Nenhum produto em falta" />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="num">Saldo</th>
                    <th className="num">Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.data.lowStock.slice(0, 8).map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="strong">{row.name}</div>
                        <div className="text-xs muted mono">{row.sku}</div>
                      </td>
                      <td className="num danger-text strong">{decimal(row.stock_qty)}</td>
                      <td className="num muted">{decimal(row.min_stock)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>📅 Lotes vencendo</h2>
            <span className="text-sm muted">próximos {alerts.data?.alertDays ?? 60} dias</span>
          </div>
          <div className="card-body tight table-wrap">
            {alerts.isLoading ? (
              <TableSkeleton rows={4} cols={4} />
            ) : !alerts.data?.expiring.length && !alerts.data?.expired.length ? (
              <EmptyState icon="✅" title="Nenhum lote próximo do vencimento" />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th>Lote</th>
                    <th>Validade</th>
                    <th className="num">Qtd.</th>
                  </tr>
                </thead>
                <tbody>
                  {[...(alerts.data?.expired ?? []), ...(alerts.data?.expiring ?? [])]
                    .slice(0, 8)
                    .map((row) => (
                      <tr key={row.id}>
                        <td>
                          <div className="strong">{row.product_name}</div>
                          <div className="text-xs muted mono">{row.product_sku}</div>
                        </td>
                        <td className="mono text-sm">{row.batch_code}</td>
                        <td className="text-sm nowrap">{date(row.expires_at)}</td>
                        <td className="num">{decimal(row.qty)}</td>
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
