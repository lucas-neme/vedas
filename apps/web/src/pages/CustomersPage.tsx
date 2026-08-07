import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CustomerFormModal } from '@/components/CustomerForm';
import { EmptyState, ErrorBox, Pagination, SPECIES_ICONS, TableSkeleton } from '@/components/ui';
import { api, type Paginated } from '@/lib/api';
import { currency, formatDocument, formatPhone } from '@/lib/format';
import type { Customer } from '@/types';

export function CustomersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [active, setActive] = useState('true');
  const [formOpen, setFormOpen] = useState(false);

  const customers = useQuery({
    queryKey: ['customers', page, search, active],
    queryFn: () =>
      api<Paginated<Customer>>('/customers', {
        query: { page, perPage: 20, search: search || undefined, active },
      }),
  });

  return (
    <div className="stack">
      <div className="toolbar">
        <input
          className="search"
          placeholder="Buscar por nome, CPF/CNPJ, e-mail ou telefone..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
        />
        <select value={active} onChange={(event) => setActive(event.target.value)} style={{ width: 150 }}>
          <option value="true">Ativos</option>
          <option value="false">Inativos</option>
          <option value="all">Todos</option>
        </select>
        <div className="spacer" />
        <button type="button" className="btn" onClick={() => setFormOpen(true)}>
          + Novo cliente
        </button>
      </div>

      <div className="card">
        <div className="card-body tight table-wrap">
          <ErrorBox error={customers.error} />
          {customers.isLoading ? (
            <TableSkeleton cols={5} />
          ) : !customers.data?.data.length ? (
            <EmptyState
              icon="🐾"
              title="Nenhum cliente encontrado"
              description="Cadastre os tutores e os pets para acompanhar a recompra de ração."
              action={
                <button type="button" className="btn" onClick={() => setFormOpen(true)}>
                  Cadastrar cliente
                </button>
              }
            />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Documento</th>
                  <th>Contato</th>
                  <th>Pets</th>
                  <th>Cidade</th>
                  <th className="num">Crediário</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {customers.data.data.map((customer) => (
                  <tr key={customer.id}>
                    <td>
                      <Link to={`/clientes/${customer.id}`} className="strong">
                        {customer.name}
                      </Link>
                      <div className="text-xs muted">
                        {customer.person_type === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'}
                        {customer.active ? '' : ' · inativo'}
                      </div>
                    </td>
                    <td className="mono text-sm">{formatDocument(customer.document) || '—'}</td>
                    <td className="text-sm">
                      {formatPhone(customer.phone) || '—'}
                      {customer.email ? <div className="text-xs muted">{customer.email}</div> : null}
                    </td>
                    <td>
                      {customer.pets?.length ? (
                        <div className="row wrap" style={{ gap: 4 }}>
                          {customer.pets.map((pet) => (
                            <span key={pet.id} className="badge">
                              {SPECIES_ICONS[pet.species] ?? '🐾'} {pet.name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="muted text-sm">—</span>
                      )}
                    </td>
                    <td className="text-sm">
                      {customer.city ? `${customer.city}/${customer.state}` : '—'}
                    </td>
                    <td className="num text-sm">
                      {customer.credit_limit > 0 ? currency(customer.credit_limit) : '—'}
                    </td>
                    <td>
                      <Link to={`/clientes/${customer.id}`} className="btn secondary sm">
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {customers.data ? (
          <Pagination
            page={customers.data.meta.page}
            totalPages={customers.data.meta.totalPages}
            total={customers.data.meta.total}
            onChange={setPage}
          />
        ) : null}
      </div>

      {formOpen ? <CustomerFormModal onClose={() => setFormOpen(false)} /> : null}
    </div>
  );
}
