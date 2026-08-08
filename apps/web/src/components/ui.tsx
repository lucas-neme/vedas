import { useEffect, type ReactNode, type RefObject } from 'react';

/**
 * Copia o cabeçalho de cada tabela para os `data-label` das células.
 *
 * No celular o CSS transforma cada linha num cartão e usa esse atributo como
 * rótulo — sem isso, o usuário teria que rolar a tabela na horizontal para ver
 * o total ou alcançar o botão de ação.
 *
 * Fica em um único lugar, observando a área de conteúdo, para valer
 * automaticamente em toda tabela do sistema, inclusive as de modais.
 */
export function useResponsiveTableLabels(container: RefObject<HTMLElement>): void {
  useEffect(() => {
    const root = container.current;
    if (!root) return;

    const apply = () => {
      for (const table of root.querySelectorAll('table')) {
        if (table.closest('.danfe')) continue; // documento fiscal mantém o formato
        const headers = Array.from(table.querySelectorAll('thead th')).map((th) =>
          (th.textContent ?? '').trim(),
        );
        if (!headers.length) continue;
        for (const row of table.querySelectorAll('tbody tr')) {
          Array.from(row.children).forEach((cell, index) => {
            const label = headers[index];
            if (label) cell.setAttribute('data-label', label);
            else cell.removeAttribute('data-label');
          });
        }
      }
    };

    apply();
    // Só childList/subtree: escrever data-label não dispara o observer.
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  });
}

/* ── Estados de carregamento / vazio ─────────────────────────────────────── */

export function Loading({ label = 'Carregando...' }: { label?: string }) {
  return (
    <div className="loading-row">
      <span className="spinner" /> {label}
    </div>
  );
}

export function Skeleton({ width = '100%', height = 12 }: { width?: string | number; height?: number }) {
  return <span className="skeleton" style={{ display: 'block', width, height }} />;
}

/** Placeholder de tabela — evita o "pulo" de layout enquanto os dados chegam. */
export function TableSkeleton({ rows = 6, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="skeleton-table">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div
          key={rowIndex}
          className="skeleton-row"
          style={{ gridTemplateColumns: `2.4fr ${'1fr '.repeat(Math.max(cols - 1, 1)).trim()}` }}
        >
          {Array.from({ length: cols }).map((__, colIndex) => (
            <Skeleton key={colIndex} width={colIndex === 0 ? '78%' : '58%'} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function StatSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div className="stat" key={index}>
          <Skeleton width="45%" height={10} />
          <div style={{ marginTop: 10 }}>
            <Skeleton width="70%" height={22} />
          </div>
          <div style={{ marginTop: 8 }}>
            <Skeleton width="55%" height={10} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  icon = '📭',
  title,
  description,
  action,
}: {
  icon?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="icon">{icon}</span>
      <h3>{title}</h3>
      {description ? <p className="text-sm">{description}</p> : null}
      {action ? <div className="mt-16">{action}</div> : null}
    </div>
  );
}

export function ErrorBox({ error }: { error: unknown }) {
  if (!error) return null;
  const message = error instanceof Error ? error.message : String(error);
  return <div className="alert error">{message}</div>;
}

/* ── Campos de formulário ─────────────────────────────────────────────────── */

type FieldProps = {
  label: string;
  children: ReactNode;
  help?: string;
  error?: string;
  className?: string;
};

export function Field({ label, children, help, error, className = 'col-6' }: FieldProps) {
  return (
    <div className={`field ${className}`}>
      <label>{label}</label>
      {children}
      {help && !error ? <span className="help">{help}</span> : null}
      {error ? <span className="error">{error}</span> : null}
    </div>
  );
}

export function FieldsetTitle({ children }: { children: ReactNode }) {
  return <div className="fieldset-title">{children}</div>;
}

/* ── Modal ────────────────────────────────────────────────────────────────── */

export function Modal({
  title,
  onClose,
  children,
  footer,
  size = '',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: '' | 'wide' | 'narrow';
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`modal ${size}`} role="dialog" aria-modal="true">
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="btn ghost sm" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer ? <div className="modal-footer">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ── Paginação ────────────────────────────────────────────────────────────── */

export function Pagination({
  page,
  totalPages,
  total,
  onChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  onChange: (page: number) => void;
}) {
  if (total === 0) return null;
  return (
    <div className="pagination">
      <span>
        {total} registro{total === 1 ? '' : 's'} · página {page} de {totalPages}
      </span>
      <div className="pages">
        <button
          type="button"
          className="btn secondary sm"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          ← Anterior
        </button>
        <button
          type="button"
          className="btn secondary sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Próxima →
        </button>
      </div>
    </div>
  );
}

/* ── Badges de domínio ────────────────────────────────────────────────────── */

const SALE_STATUS: Record<string, { label: string; tone: string }> = {
  rascunho: { label: 'Rascunho', tone: 'gray' },
  confirmada: { label: 'Confirmada', tone: 'green' },
  cancelada: { label: 'Cancelada', tone: 'red' },
};

export function SaleStatusBadge({ status }: { status: string }) {
  const meta = SALE_STATUS[status] ?? { label: status, tone: 'gray' };
  return <span className={`badge ${meta.tone}`}>{meta.label}</span>;
}

const INVOICE_STATUS: Record<string, { label: string; tone: string }> = {
  gerada: { label: 'Gerada', tone: 'blue' },
  assinada: { label: 'Assinada', tone: 'blue' },
  autorizada: { label: 'Autorizada', tone: 'green' },
  rejeitada: { label: 'Rejeitada', tone: 'red' },
  cancelada: { label: 'Cancelada', tone: 'gray' },
};

export function InvoiceStatusBadge({ status }: { status: string }) {
  const meta = INVOICE_STATUS[status] ?? { label: status, tone: 'gray' };
  return <span className={`badge ${meta.tone}`}>{meta.label}</span>;
}

export const PAYMENT_LABELS: Record<string, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Cartão de débito',
  credito: 'Cartão de crédito',
  boleto: 'Boleto',
  crediario: 'Crediário',
  transferencia: 'Transferência',
};

export const SPECIES_LABELS: Record<string, string> = {
  cachorro: 'Cachorro',
  gato: 'Gato',
  ave: 'Ave',
  peixe: 'Peixe',
  roedor: 'Roedor',
  reptil: 'Réptil',
  outro: 'Outro',
  geral: 'Geral',
};

export const SPECIES_ICONS: Record<string, string> = {
  cachorro: '🐶',
  gato: '🐱',
  ave: '🦜',
  peixe: '🐠',
  roedor: '🐹',
  reptil: '🦎',
  outro: '🐾',
  geral: '🐾',
};

export const MOVEMENT_LABELS: Record<string, { label: string; tone: string }> = {
  entrada: { label: 'Entrada', tone: 'green' },
  saida: { label: 'Saída', tone: 'blue' },
  ajuste: { label: 'Ajuste', tone: 'amber' },
  perda: { label: 'Perda', tone: 'red' },
  devolucao: { label: 'Devolução', tone: 'gray' },
};

export function StockBadge({ qty, min }: { qty: number; min: number }) {
  if (qty <= 0) return <span className="badge red">Sem estoque</span>;
  if (min > 0 && qty <= min) return <span className="badge amber">Estoque baixo</span>;
  return <span className="badge green">Disponível</span>;
}

export function ExpiryBadge({ days }: { days: number | null | undefined }) {
  if (days === null || days === undefined) return <span className="badge gray">Sem validade</span>;
  if (days < 0) return <span className="badge red">Vencido</span>;
  if (days <= 30) return <span className="badge red">{days} dias</span>;
  if (days <= 90) return <span className="badge amber">{days} dias</span>;
  return <span className="badge green">{days} dias</span>;
}

/* ── Gráfico de barras ────────────────────────────────────────────────────── */

export function BarChart({
  data,
  formatValue,
}: {
  data: Array<{ label: string; value: number }>;
  formatValue: (value: number) => string;
}) {
  if (!data.length) return <EmptyState icon="📊" title="Sem dados no período" />;
  const max = Math.max(...data.map((point) => point.value), 1);

  return (
    <div>
      <div className="bars">
        {data.map((point) => (
          <div
            key={point.label}
            className="bar"
            style={{ height: `${Math.max((point.value / max) * 100, 1)}%` }}
            title={`${point.label}: ${formatValue(point.value)}`}
          />
        ))}
      </div>
      <div className="bar-axis">
        <span>{data[0]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  );
}
