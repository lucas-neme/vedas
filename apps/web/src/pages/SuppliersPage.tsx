import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { EmptyState, ErrorBox, Field, Modal, TableSkeleton } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';
import { formatDocument, formatPhone } from '@/lib/format';
import type { Supplier } from '@/types';

const EMPTY: Omit<Supplier, 'id'> = {
  name: '',
  document: '',
  contact_name: '',
  email: '',
  phone: '',
  zip_code: '',
  street: '',
  number: '',
  district: '',
  city: '',
  state: '',
  notes: '',
  active: true,
};

export function SuppliersPage() {
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<(Omit<Supplier, 'id'> & { id?: number }) | null>(null);

  const suppliers = useQuery({
    queryKey: ['suppliers', search],
    queryFn: () => api<Supplier[]>('/suppliers', { query: { search: search || undefined } }),
  });

  return (
    <div className="stack">
      <div className="toolbar">
        <input
          className="search"
          placeholder="Buscar fornecedor..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="spacer" />
        <button type="button" className="btn" onClick={() => setEditing({ ...EMPTY })}>
          + Novo fornecedor
        </button>
      </div>

      <div className="card">
        <div className="card-body tight table-wrap">
          <ErrorBox error={suppliers.error} />
          {suppliers.isLoading ? (
            <TableSkeleton cols={5} />
          ) : !suppliers.data?.length ? (
            <EmptyState icon="🚚" title="Nenhum fornecedor cadastrado" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Fornecedor</th>
                  <th>CNPJ</th>
                  <th>Contato</th>
                  <th>Cidade</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {suppliers.data.map((supplier) => (
                  <tr key={supplier.id}>
                    <td className="strong">{supplier.name}</td>
                    <td className="mono text-sm">{formatDocument(supplier.document) || '—'}</td>
                    <td className="text-sm">
                      {supplier.contact_name || '—'}
                      <div className="text-xs muted">
                        {formatPhone(supplier.phone)} {supplier.email ? `· ${supplier.email}` : ''}
                      </div>
                    </td>
                    <td className="text-sm">
                      {supplier.city ? `${supplier.city}/${supplier.state}` : '—'}
                    </td>
                    <td>
                      {supplier.active ? (
                        <span className="badge green">Ativo</span>
                      ) : (
                        <span className="badge gray">Inativo</span>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn secondary sm"
                        onClick={() => setEditing({ ...supplier })}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing ? <SupplierModal supplier={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}

function SupplierModal({
  supplier,
  onClose,
}: {
  supplier: Omit<Supplier, 'id'> & { id?: number };
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(supplier);

  const save = useMutation({
    mutationFn: (payload: typeof form) => {
      const { id, ...body } = payload;
      return id
        ? api(`/suppliers/${id}`, { method: 'PUT', body })
        : api('/suppliers', { method: 'POST', body });
    },
    onSuccess: () => {
      toast.success('Fornecedor salvo.');
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <Modal
      title={form.id ? `Editar ${form.name}` : 'Novo fornecedor'}
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
            disabled={save.isPending || form.name.trim().length < 2}
          >
            Salvar
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Razão social" className="col-8">
          <input value={form.name} onChange={(event) => set('name', event.target.value)} />
        </Field>
        <Field label="CNPJ" className="col-4">
          <input value={form.document} onChange={(event) => set('document', event.target.value)} />
        </Field>
        <Field label="Contato" className="col-4">
          <input value={form.contact_name} onChange={(event) => set('contact_name', event.target.value)} />
        </Field>
        <Field label="Telefone" className="col-4">
          <input value={form.phone} onChange={(event) => set('phone', event.target.value)} />
        </Field>
        <Field label="E-mail" className="col-4">
          <input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} />
        </Field>
        <Field label="CEP" className="col-3">
          <input value={form.zip_code} onChange={(event) => set('zip_code', event.target.value)} />
        </Field>
        <Field label="Logradouro" className="col-6">
          <input value={form.street} onChange={(event) => set('street', event.target.value)} />
        </Field>
        <Field label="Número" className="col-3">
          <input value={form.number} onChange={(event) => set('number', event.target.value)} />
        </Field>
        <Field label="Bairro" className="col-4">
          <input value={form.district} onChange={(event) => set('district', event.target.value)} />
        </Field>
        <Field label="Cidade" className="col-4">
          <input value={form.city} onChange={(event) => set('city', event.target.value)} />
        </Field>
        <Field label="UF" className="col-4">
          <input maxLength={2} value={form.state} onChange={(event) => set('state', event.target.value.toUpperCase())} />
        </Field>
        <Field label="Observações" className="col-12">
          <textarea value={form.notes} onChange={(event) => set('notes', event.target.value)} />
        </Field>
        <Field label="Situação" className="col-12">
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => set('active', event.target.checked)}
            />
            Fornecedor ativo
          </label>
        </Field>
      </div>
    </Modal>
  );
}
