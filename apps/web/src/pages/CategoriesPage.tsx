import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { EmptyState, Field, Loading, Modal } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';
import type { Brand, Category } from '@/types';

export function CategoriesPage() {
  return (
    <div className="grid cols-2">
      <CategoriesCard />
      <BrandsCard />
    </div>
  );
}

function CategoriesCard() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<Partial<Category> | null>(null);

  const categories = useQuery({ queryKey: ['categories'], queryFn: () => api<Category[]>('/categories') });

  const save = useMutation({
    mutationFn: (payload: Partial<Category>) =>
      payload.id
        ? api(`/categories/${payload.id}`, {
            method: 'PUT',
            body: {
              name: payload.name,
              description: payload.description ?? '',
              active: payload.active ?? true,
            },
          })
        : api('/categories', {
            method: 'POST',
            body: { name: payload.name, description: payload.description ?? '' },
          }),
    onSuccess: () => {
      toast.success('Categoria salva.');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      setEditing(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/categories/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Categoria removida.');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="card">
      <div className="card-header">
        <h2>Categorias</h2>
        <button type="button" className="btn secondary sm" onClick={() => setEditing({ name: '' })}>
          + Nova
        </button>
      </div>
      <div className="card-body tight table-wrap">
        {categories.isLoading ? (
          <Loading />
        ) : !categories.data?.length ? (
          <EmptyState icon="🗂️" title="Nenhuma categoria" />
        ) : (
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th className="num">Produtos</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {categories.data.map((category) => (
                <tr key={category.id}>
                  <td>
                    <div className="strong">{category.name}</div>
                    {category.description ? (
                      <div className="text-xs muted">{category.description}</div>
                    ) : null}
                  </td>
                  <td className="num">{category.products_count ?? 0}</td>
                  <td className="nowrap">
                    <button type="button" className="btn ghost sm" onClick={() => setEditing(category)}>
                      Editar
                    </button>
                    <button
                      type="button"
                      className="btn ghost sm"
                      onClick={() => {
                        if (confirm(`Excluir a categoria ${category.name}?`)) remove.mutate(category.id);
                      }}
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {editing ? (
        <Modal
          title={editing.id ? 'Editar categoria' : 'Nova categoria'}
          size="narrow"
          onClose={() => setEditing(null)}
          footer={
            <>
              <button type="button" className="btn secondary" onClick={() => setEditing(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => save.mutate(editing)}
                disabled={save.isPending || !(editing.name ?? '').trim()}
              >
                Salvar
              </button>
            </>
          }
        >
          <div className="form-grid">
            <Field label="Nome" className="col-12">
              <input
                value={editing.name ?? ''}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              />
            </Field>
            <Field label="Descrição" className="col-12">
              <textarea
                value={editing.description ?? ''}
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
              />
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function BrandsCard() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [name, setName] = useState('');

  const brands = useQuery({ queryKey: ['brands'], queryFn: () => api<Brand[]>('/brands') });

  const create = useMutation({
    mutationFn: () => api('/brands', { method: 'POST', body: { name } }),
    onSuccess: () => {
      toast.success('Marca cadastrada.');
      setName('');
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: number) => api(`/brands/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Marca removida.');
      queryClient.invalidateQueries({ queryKey: ['brands'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="card">
      <div className="card-header">
        <h2>Marcas</h2>
      </div>
      <div className="card-body">
        <div className="row mb-16">
          <input
            placeholder="Nome da marca"
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && name.trim()) create.mutate();
            }}
          />
          <button
            type="button"
            className="btn"
            onClick={() => create.mutate()}
            disabled={create.isPending || !name.trim()}
          >
            Adicionar
          </button>
        </div>

        {brands.isLoading ? (
          <Loading />
        ) : !brands.data?.length ? (
          <EmptyState icon="🏷️" title="Nenhuma marca" />
        ) : (
          <div className="row wrap">
            {brands.data.map((brand) => (
              <span key={brand.id} className="badge gray" style={{ padding: '5px 10px' }}>
                {brand.name}
                <span className="muted">({brand.products_count ?? 0})</span>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Excluir a marca ${brand.name}?`)) remove.mutate(brand.id);
                  }}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: 'inherit',
                  }}
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
