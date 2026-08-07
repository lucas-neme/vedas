import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import {
  EmptyState,
  ErrorBox,
  Field,
  FieldsetTitle,
  Modal,
  Pagination,
  SPECIES_LABELS,
  StockBadge,
  TableSkeleton,
} from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { api, type Paginated } from '@/lib/api';
import { currency, decimal, percent } from '@/lib/format';
import type { Brand, Category, Product, Supplier } from '@/types';

const EMPTY: Omit<Product, 'id' | 'stock_qty'> = {
  sku: '',
  barcode: '',
  name: '',
  description: '',
  category_id: null,
  brand_id: null,
  supplier_id: null,
  species: 'geral',
  life_stage: 'todos',
  package_weight_kg: null,
  unit: 'UN',
  requires_batch: true,
  cost_price: 0,
  sale_price: 0,
  min_stock: 0,
  max_stock: 0,
  ncm: '23091000',
  cest: '',
  cfop: '5102',
  origin: '0',
  csosn: '102',
  cst_icms: '',
  icms_rate: 0,
  active: true,
};

export function ProductsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [species, setSpecies] = useState('');
  const [lowStock, setLowStock] = useState('false');
  const [active, setActive] = useState('true');
  const [editing, setEditing] = useState<(typeof EMPTY & { id?: number }) | null>(null);

  const products = useQuery({
    queryKey: ['products', page, search, categoryId, species, lowStock, active],
    queryFn: () =>
      api<Paginated<Product>>('/products', {
        query: {
          page,
          perPage: 20,
          search: search || undefined,
          categoryId: categoryId || undefined,
          species: species || undefined,
          lowStock,
          active,
        },
      }),
  });

  const categories = useQuery({
    queryKey: ['categories'],
    queryFn: () => api<Category[]>('/categories'),
  });

  return (
    <div className="stack">
      <div className="toolbar">
        <input
          className="search"
          placeholder="Buscar por nome, SKU ou código de barras..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} style={{ width: 180 }}>
          <option value="">Todas as categorias</option>
          {categories.data?.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select value={species} onChange={(event) => setSpecies(event.target.value)} style={{ width: 150 }}>
          <option value="">Todas as espécies</option>
          {Object.entries(SPECIES_LABELS)
            .filter(([key]) => key !== 'outro')
            .map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
        </select>
        <select value={lowStock} onChange={(event) => setLowStock(event.target.value)} style={{ width: 160 }}>
          <option value="false">Todo o estoque</option>
          <option value="true">Só estoque baixo</option>
        </select>
        <select value={active} onChange={(event) => setActive(event.target.value)} style={{ width: 130 }}>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
          <option value="all">Todos</option>
        </select>
        <div className="spacer" />
        <button type="button" className="btn" onClick={() => setEditing({ ...EMPTY })}>
          + Novo produto
        </button>
      </div>

      <div className="card">
        <div className="card-body tight table-wrap">
          <ErrorBox error={products.error} />
          {products.isLoading ? (
            <TableSkeleton cols={7} />
          ) : !products.data?.data.length ? (
            <EmptyState icon="📦" title="Nenhum produto encontrado" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Categoria</th>
                  <th>Espécie</th>
                  <th className="num">Custo</th>
                  <th className="num">Venda</th>
                  <th className="num">Margem</th>
                  <th className="num">Estoque</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {products.data.data.map((product) => {
                  const margin =
                    product.sale_price > 0
                      ? ((product.sale_price - product.cost_price) / product.sale_price) * 100
                      : 0;
                  return (
                    <tr key={product.id}>
                      <td>
                        <div className="strong">{product.name}</div>
                        <div className="text-xs muted mono">
                          {product.sku}
                          {product.brand_name ? ` · ${product.brand_name}` : ''}
                          {product.package_weight_kg ? ` · ${product.package_weight_kg} kg` : ''}
                        </div>
                      </td>
                      <td className="text-sm">{product.category_name ?? '—'}</td>
                      <td className="text-sm">{SPECIES_LABELS[product.species] ?? product.species}</td>
                      <td className="num text-sm">{currency(product.cost_price)}</td>
                      <td className="num strong">{currency(product.sale_price)}</td>
                      <td className="num text-sm" style={{ color: margin < 15 ? 'var(--danger-700)' : undefined }}>
                        {percent(margin, 0)}
                      </td>
                      <td className="num">
                        {decimal(product.stock_qty)} {product.unit}
                        <div className="text-xs muted">mín. {decimal(product.min_stock)}</div>
                      </td>
                      <td>
                        <StockBadge qty={product.stock_qty} min={product.min_stock} />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn secondary sm"
                          onClick={() => setEditing({ ...EMPTY, ...product })}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {products.data ? (
          <Pagination
            page={products.data.meta.page}
            totalPages={products.data.meta.totalPages}
            total={products.data.meta.total}
            onChange={setPage}
          />
        ) : null}
      </div>

      {editing ? <ProductModal product={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function ProductModal({
  product,
  onClose,
}: {
  product: typeof EMPTY & { id?: number };
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(product);

  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories') });
  const brands = useQuery({ queryKey: ['brands'], queryFn: () => api<Brand[]>('/brands') });
  const suppliers = useQuery({ queryKey: ['suppliers'], queryFn: () => api<Supplier[]>('/suppliers') });

  const save = useMutation({
    mutationFn: (payload: typeof form) => {
      const { id, ...body } = payload;
      return id
        ? api(`/products/${id}`, { method: 'PUT', body })
        : api('/products', { method: 'POST', body });
    },
    onSuccess: () => {
      toast.success(form.id ? 'Produto atualizado.' : 'Produto cadastrado.');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  const margin =
    form.sale_price > 0 ? ((form.sale_price - form.cost_price) / form.sale_price) * 100 : 0;
  const markup = form.cost_price > 0 ? ((form.sale_price - form.cost_price) / form.cost_price) * 100 : 0;

  return (
    <Modal
      title={form.id ? `Editar ${form.name}` : 'Novo produto'}
      size="wide"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => save.mutate(form)}
            disabled={save.isPending || !form.name.trim() || !form.sku.trim()}
          >
            {save.isPending ? <span className="spinner" /> : 'Salvar produto'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="SKU / código interno" className="col-3">
          <input value={form.sku} onChange={(event) => set('sku', event.target.value)} />
        </Field>
        <Field label="Código de barras (EAN)" className="col-3">
          <input
            value={form.barcode ?? ''}
            onChange={(event) => set('barcode', event.target.value)}
            placeholder="7891234567890"
          />
        </Field>
        <Field label="Nome do produto" className="col-6">
          <input value={form.name} onChange={(event) => set('name', event.target.value)} />
        </Field>

        <Field label="Categoria" className="col-4">
          <select
            value={form.category_id ?? ''}
            onChange={(event) =>
              set('category_id', event.target.value === '' ? null : Number(event.target.value))
            }
          >
            <option value="">Sem categoria</option>
            {categories.data?.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Marca" className="col-4">
          <select
            value={form.brand_id ?? ''}
            onChange={(event) =>
              set('brand_id', event.target.value === '' ? null : Number(event.target.value))
            }
          >
            <option value="">Sem marca</option>
            {brands.data?.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fornecedor" className="col-4">
          <select
            value={form.supplier_id ?? ''}
            onChange={(event) =>
              set('supplier_id', event.target.value === '' ? null : Number(event.target.value))
            }
          >
            <option value="">Sem fornecedor</option>
            {suppliers.data?.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Espécie" className="col-3">
          <select value={form.species} onChange={(event) => set('species', event.target.value as Product['species'])}>
            {Object.entries(SPECIES_LABELS)
              .filter(([key]) => key !== 'outro')
              .map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Fase da vida" className="col-3">
          <select
            value={form.life_stage}
            onChange={(event) => set('life_stage', event.target.value as Product['life_stage'])}
          >
            <option value="todos">Todas</option>
            <option value="filhote">Filhote</option>
            <option value="adulto">Adulto</option>
            <option value="senior">Sênior</option>
          </select>
        </Field>
        <Field label="Peso da embalagem (kg)" className="col-3" help="Usado na previsão de recompra">
          <input
            type="number"
            step="0.001"
            min="0"
            value={form.package_weight_kg ?? ''}
            onChange={(event) =>
              set('package_weight_kg', event.target.value === '' ? null : Number(event.target.value))
            }
          />
        </Field>
        <Field label="Unidade" className="col-3">
          <select value={form.unit} onChange={(event) => set('unit', event.target.value)}>
            <option value="UN">UN — unidade</option>
            <option value="KG">KG — quilo (granel)</option>
            <option value="CX">CX — caixa</option>
            <option value="PC">PC — pacote</option>
            <option value="LT">LT — litro</option>
          </select>
        </Field>

        <FieldsetTitle>Preços e estoque</FieldsetTitle>

        <Field label="Preço de custo (R$)" className="col-3">
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.cost_price}
            onChange={(event) => set('cost_price', Number(event.target.value))}
          />
        </Field>
        <Field
          label="Preço de venda (R$)"
          className="col-3"
          help={`Margem ${percent(margin, 1)} · markup ${percent(markup, 0)}`}
        >
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.sale_price}
            onChange={(event) => set('sale_price', Number(event.target.value))}
          />
        </Field>
        <Field label="Estoque mínimo" className="col-3">
          <input
            type="number"
            step="0.001"
            min="0"
            value={form.min_stock}
            onChange={(event) => set('min_stock', Number(event.target.value))}
          />
        </Field>
        <Field label="Estoque máximo" className="col-3">
          <input
            type="number"
            step="0.001"
            min="0"
            value={form.max_stock}
            onChange={(event) => set('max_stock', Number(event.target.value))}
          />
        </Field>
        <Field label="Controle de lote e validade" className="col-6">
          <label className="checkbox" style={{ paddingTop: 8 }}>
            <input
              type="checkbox"
              checked={form.requires_batch}
              onChange={(event) => set('requires_batch', event.target.checked)}
            />
            Controlar lote e data de validade (recomendado para rações e medicamentos)
          </label>
        </Field>
        <Field label="Situação" className="col-6">
          <label className="checkbox" style={{ paddingTop: 8 }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => set('active', event.target.checked)}
            />
            Produto ativo (aparece no PDV)
          </label>
        </Field>

        <FieldsetTitle>Dados fiscais</FieldsetTitle>

        <Field label="NCM" className="col-3" help="23091000 = alimentos para cães e gatos">
          <input value={form.ncm} onChange={(event) => set('ncm', event.target.value)} />
        </Field>
        <Field label="CFOP" className="col-2">
          <input value={form.cfop} onChange={(event) => set('cfop', event.target.value)} />
        </Field>
        <Field label="CEST" className="col-2">
          <input value={form.cest} onChange={(event) => set('cest', event.target.value)} />
        </Field>
        <Field label="Origem" className="col-2">
          <select value={form.origin} onChange={(event) => set('origin', event.target.value)}>
            <option value="0">0 - Nacional</option>
            <option value="1">1 - Estrangeira (importação direta)</option>
            <option value="2">2 - Estrangeira (mercado interno)</option>
          </select>
        </Field>
        <Field label="CSOSN" className="col-3" help="Simples Nacional">
          <input value={form.csosn} onChange={(event) => set('csosn', event.target.value)} />
        </Field>
        <Field label="CST ICMS" className="col-3" help="Regime normal">
          <input value={form.cst_icms} onChange={(event) => set('cst_icms', event.target.value)} />
        </Field>
        <Field label="Alíquota ICMS (%)" className="col-3">
          <input
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={form.icms_rate}
            onChange={(event) => set('icms_rate', Number(event.target.value))}
          />
        </Field>

        <Field label="Descrição" className="col-12">
          <textarea
            value={form.description}
            onChange={(event) => set('description', event.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}
