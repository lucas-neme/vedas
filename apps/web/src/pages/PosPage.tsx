import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, PAYMENT_LABELS } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { api, type Paginated } from '@/lib/api';
import { currency, decimal, today } from '@/lib/format';
import type { Customer, PaymentMethod, SaleDetail } from '@/types';

type SearchResult = {
  id: number;
  sku: string;
  barcode: string | null;
  name: string;
  unit: string;
  sale_price: number;
  stock_qty: number;
  requires_batch: boolean;
  package_weight_kg: number | null;
  brand_name: string | null;
};

type CartItem = {
  product_id: number;
  name: string;
  sku: string;
  unit: string;
  qty: number;
  unit_price: number;
  discount: number;
  stock_qty: number;
};

type PaymentLine = {
  key: number;
  method: PaymentMethod;
  amount: number;
  installments: number;
  due_date: string | null;
};

const METHODS: PaymentMethod[] = [
  'dinheiro',
  'pix',
  'debito',
  'credito',
  'boleto',
  'crediario',
  'transferencia',
];

let paymentKey = 1;

export function PosPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [highlight, setHighlight] = useState(0);
  const [showResults, setShowResults] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState<number | ''>('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [channel, setChannel] = useState('balcao');
  const [discount, setDiscount] = useState(0);
  const [freight, setFreight] = useState(0);
  const [notes, setNotes] = useState('');
  const [payments, setPayments] = useState<PaymentLine[]>([
    { key: paymentKey++, method: 'dinheiro', amount: 0, installments: 1, due_date: null },
  ]);

  const searchRef = useRef<HTMLInputElement>(null);
  const debounced = useDebounce(search, 200);

  const results = useQuery({
    queryKey: ['product-search', debounced],
    queryFn: () => api<SearchResult[]>('/products/search', { query: { q: debounced } }),
    enabled: debounced.trim().length >= 2,
  });

  const customers = useQuery({
    queryKey: ['customers-pos', customerSearch],
    queryFn: () =>
      api<Paginated<Customer>>('/customers', {
        query: { search: customerSearch || undefined, perPage: 20 },
      }),
  });

  const itemsTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.qty * item.unit_price - item.discount, 0),
    [items],
  );
  const total = Math.max(0, itemsTotal - discount + freight);
  const paid = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  const remaining = Number((total - paid).toFixed(2));

  // Mantém a primeira forma de pagamento sincronizada com o total enquanto
  // o operador não mexe manualmente nos valores.
  useEffect(() => {
    setPayments((current) => {
      if (current.length !== 1) return current;
      return [{ ...current[0], amount: Number(total.toFixed(2)) }];
    });
  }, [total]);

  const createSale = useMutation({
    mutationFn: (payload: unknown) => api<SaleDetail>('/sales', { method: 'POST', body: payload }),
    onSuccess: (sale) => {
      toast.success(`Venda #${sale.number} registrada com sucesso.`);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      navigate(`/vendas/${sale.id}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function addProduct(product: SearchResult) {
    setItems((current) => {
      const existing = current.find((item) => item.product_id === product.id);
      if (existing) {
        return current.map((item) =>
          item.product_id === product.id ? { ...item, qty: item.qty + 1 } : item,
        );
      }
      return [
        ...current,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          unit: product.unit,
          qty: 1,
          unit_price: Number(product.sale_price),
          discount: 0,
          stock_qty: Number(product.stock_qty),
        },
      ];
    });
    setSearch('');
    setShowResults(false);
    setHighlight(0);
    searchRef.current?.focus();
  }

  function updateItem(index: number, patch: Partial<CartItem>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, i) => i !== index));
  }

  function onSearchKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    const list = results.data ?? [];
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setHighlight((value) => Math.min(value + 1, list.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setHighlight((value) => Math.max(value - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const chosen = list[highlight];
      if (chosen) addProduct(chosen);
    } else if (event.key === 'Escape') {
      setShowResults(false);
    }
  }

  function submit() {
    if (!items.length) {
      toast.error('Adicione ao menos um produto.');
      return;
    }
    if (Math.abs(remaining) > 0.02) {
      toast.error(
        remaining > 0
          ? `Faltam ${currency(remaining)} para fechar o pagamento.`
          : `Pagamento excede o total em ${currency(Math.abs(remaining))}.`,
      );
      return;
    }

    createSale.mutate({
      customer_id: customerId === '' ? null : customerId,
      channel,
      status: 'confirmada',
      discount,
      freight,
      notes,
      items: items.map((item) => ({
        product_id: item.product_id,
        qty: item.qty,
        unit_price: item.unit_price,
        discount: item.discount,
      })),
      payments: payments
        .filter((payment) => Number(payment.amount) > 0)
        .map((payment) => ({
          method: payment.method,
          amount: Number(payment.amount),
          installments: payment.installments,
          due_date: payment.method === 'crediario' || payment.method === 'boleto' ? payment.due_date : null,
          paid: payment.method !== 'crediario' && payment.method !== 'boleto',
        })),
    });
  }

  return (
    <div className="pos-layout">
      <div className="stack">
        <div className="card">
          <div className="card-body">
            <div className="field" style={{ position: 'relative' }}>
              <label>Buscar produto (nome, SKU ou código de barras)</label>
              <input
                ref={searchRef}
                value={search}
                placeholder="Digite ou bipe o código de barras..."
                autoFocus
                onChange={(event) => {
                  setSearch(event.target.value);
                  setShowResults(true);
                  setHighlight(0);
                }}
                onFocus={() => setShowResults(true)}
                onKeyDown={onSearchKeyDown}
              />
              {showResults && (results.data?.length ?? 0) > 0 ? (
                <div className="pos-search-results">
                  {results.data!.map((product, index) => (
                    <button
                      key={product.id}
                      type="button"
                      className={index === highlight ? 'highlighted' : ''}
                      onMouseEnter={() => setHighlight(index)}
                      onClick={() => addProduct(product)}
                    >
                      <span style={{ minWidth: 0 }}>
                        <span className="strong">{product.name}</span>
                        <br />
                        <span className="text-xs muted mono">
                          {product.sku}
                          {product.brand_name ? ` · ${product.brand_name}` : ''}
                        </span>
                      </span>
                      <span className="nowrap" style={{ textAlign: 'right' }}>
                        <span className="strong">{currency(product.sale_price)}</span>
                        <br />
                        <span
                          className="text-xs"
                          style={{
                            color: product.stock_qty > 0 ? 'var(--gray-500)' : 'var(--danger-700)',
                          }}
                        >
                          {decimal(product.stock_qty)} {product.unit}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Itens da venda</h2>
            <span className="text-sm muted">{items.length} item(ns)</span>
          </div>
          <div className="card-body tight table-wrap">
            {items.length === 0 ? (
              <EmptyState
                icon="🛒"
                title="Carrinho vazio"
                description="Busque um produto acima ou bipe o código de barras."
              />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Produto</th>
                    <th className="num">Qtd.</th>
                    <th className="num">Preço</th>
                    <th className="num">Desc.</th>
                    <th className="num">Total</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const lineTotal = item.qty * item.unit_price - item.discount;
                    const insufficient = item.qty > item.stock_qty;
                    return (
                      <tr key={item.product_id}>
                        <td>
                          <div className="strong">{item.name}</div>
                          <div className="text-xs muted mono">
                            {item.sku} · saldo {decimal(item.stock_qty)} {item.unit}
                          </div>
                          {insufficient ? (
                            <div className="text-xs" style={{ color: 'var(--danger-700)' }}>
                              Quantidade acima do estoque disponível
                            </div>
                          ) : null}
                        </td>
                        <td className="num">
                          <input
                            className="qty-input"
                            type="number"
                            min="0.001"
                            step="0.001"
                            value={item.qty}
                            onChange={(event) =>
                              updateItem(index, { qty: Number(event.target.value) })
                            }
                          />
                        </td>
                        <td className="num">
                          <input
                            className="price-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price}
                            onChange={(event) =>
                              updateItem(index, { unit_price: Number(event.target.value) })
                            }
                          />
                        </td>
                        <td className="num">
                          <input
                            className="qty-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.discount}
                            onChange={(event) =>
                              updateItem(index, { discount: Number(event.target.value) })
                            }
                          />
                        </td>
                        <td className="num strong">{currency(lineTotal)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn ghost sm"
                            onClick={() => removeItem(index)}
                            aria-label="Remover item"
                          >
                            ✕
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

      <div className="stack">
        <div className="card">
          <div className="card-header">
            <h2>Cliente</h2>
          </div>
          <div className="card-body stack sm">
            <input
              placeholder="Buscar cliente por nome, CPF ou telefone..."
              value={customerSearch}
              onChange={(event) => setCustomerSearch(event.target.value)}
            />
            <select
              value={customerId}
              onChange={(event) =>
                setCustomerId(event.target.value === '' ? '' : Number(event.target.value))
              }
            >
              <option value="">Consumidor não identificado</option>
              {customers.data?.data.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                  {customer.pets?.length ? ` · ${customer.pets.map((pet) => pet.name).join(', ')}` : ''}
                </option>
              ))}
            </select>
            <select value={channel} onChange={(event) => setChannel(event.target.value)}>
              <option value="balcao">Balcão</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="delivery">Delivery</option>
              <option value="marketplace">Marketplace</option>
            </select>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Resumo</h2>
          </div>
          <div className="card-body">
            <div className="pos-total">
              <span className="muted">Subtotal</span>
              <span className="strong">{currency(itemsTotal)}</span>
            </div>
            <div className="pos-total">
              <span className="muted">Desconto</span>
              <input
                className="price-input"
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(event) => setDiscount(Number(event.target.value))}
              />
            </div>
            <div className="pos-total">
              <span className="muted">Frete / entrega</span>
              <input
                className="price-input"
                type="number"
                min="0"
                step="0.01"
                value={freight}
                onChange={(event) => setFreight(Number(event.target.value))}
              />
            </div>
            <div className="pos-total grand">
              <span>Total</span>
              <span>{currency(total)}</span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h2>Pagamento</h2>
            <button
              type="button"
              className="btn secondary sm"
              onClick={() =>
                setPayments((current) => [
                  ...current,
                  {
                    key: paymentKey++,
                    method: 'pix',
                    amount: Math.max(remaining, 0),
                    installments: 1,
                    due_date: null,
                  },
                ])
              }
            >
              + Forma
            </button>
          </div>
          <div className="card-body stack sm">
            {payments.map((payment, index) => (
              <div key={payment.key} className="stack sm">
                <div className="row">
                  <select
                    value={payment.method}
                    onChange={(event) =>
                      setPayments((current) =>
                        current.map((line, i) =>
                          i === index
                            ? { ...line, method: event.target.value as PaymentMethod }
                            : line,
                        ),
                      )
                    }
                  >
                    {METHODS.map((method) => (
                      <option key={method} value={method}>
                        {PAYMENT_LABELS[method]}
                      </option>
                    ))}
                  </select>
                  <input
                    className="price-input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={payment.amount}
                    onChange={(event) =>
                      setPayments((current) =>
                        current.map((line, i) =>
                          i === index ? { ...line, amount: Number(event.target.value) } : line,
                        ),
                      )
                    }
                  />
                  {payments.length > 1 ? (
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() =>
                        setPayments((current) => current.filter((_, i) => i !== index))
                      }
                    >
                      ✕
                    </button>
                  ) : null}
                </div>
                {payment.method === 'credito' ? (
                  <select
                    value={payment.installments}
                    onChange={(event) =>
                      setPayments((current) =>
                        current.map((line, i) =>
                          i === index ? { ...line, installments: Number(event.target.value) } : line,
                        ),
                      )
                    }
                  >
                    {[1, 2, 3, 4, 5, 6, 10, 12].map((n) => (
                      <option key={n} value={n}>
                        {n}x de {currency(payment.amount / n)}
                      </option>
                    ))}
                  </select>
                ) : null}
                {payment.method === 'crediario' || payment.method === 'boleto' ? (
                  <div className="field">
                    <label className="text-xs">Vencimento</label>
                    <input
                      type="date"
                      value={payment.due_date ?? today()}
                      onChange={(event) =>
                        setPayments((current) =>
                          current.map((line, i) =>
                            i === index ? { ...line, due_date: event.target.value } : line,
                          ),
                        )
                      }
                    />
                  </div>
                ) : null}
              </div>
            ))}

            <div
              className="row between text-sm"
              style={{
                paddingTop: 8,
                borderTop: '1px solid var(--gray-200)',
                color: Math.abs(remaining) < 0.02 ? 'var(--brand-700)' : 'var(--danger-700)',
                fontWeight: 600,
              }}
            >
              <span>{remaining > 0 ? 'Falta' : remaining < 0 ? 'Troco / excedente' : 'Pagamento fechado'}</span>
              <span>{currency(Math.abs(remaining))}</span>
            </div>

            <textarea
              placeholder="Observações da venda (opcional)"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              style={{ minHeight: 56 }}
            />

            <button
              type="button"
              className="btn lg block"
              onClick={submit}
              disabled={createSale.isPending || items.length === 0}
            >
              {createSale.isPending ? <span className="spinner" /> : `Finalizar venda · ${currency(total)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
