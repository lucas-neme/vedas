import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CustomerFormModal } from '@/components/CustomerForm';
import {
  EmptyState,
  ErrorBox,
  Field,
  Loading,
  Modal,
  SaleStatusBadge,
  SPECIES_ICONS,
  SPECIES_LABELS,
} from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { api, type Paginated } from '@/lib/api';
import { currency, date, dateTime, formatDocument, formatPhone, formatZip, whatsappLink } from '@/lib/format';
import type { CustomerDetail, Pet, PetSpecies, Product } from '@/types';

const EMPTY_PET: Omit<Pet, 'id' | 'customer_id'> = {
  name: '',
  species: 'cachorro',
  breed: '',
  size: 'medio',
  birth_date: null,
  weight_kg: null,
  neutered: false,
  food_product_id: null,
  daily_food_grams: null,
  notes: '',
  active: true,
};

export function CustomerDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);
  const [petForm, setPetForm] = useState<(Omit<Pet, 'id' | 'customer_id'> & { id?: number }) | null>(
    null,
  );

  const customer = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api<CustomerDetail>(`/customers/${id}`),
    enabled: Boolean(id),
  });

  const products = useQuery({
    queryKey: ['products-for-pets'],
    queryFn: () => api<Paginated<Product>>('/products', { query: { perPage: 200, active: 'true' } }),
  });

  const savePet = useMutation({
    mutationFn: (payload: Omit<Pet, 'id' | 'customer_id'> & { id?: number }) => {
      const { id: petId, ...body } = payload;
      return petId
        ? api(`/customers/${id}/pets/${petId}`, { method: 'PUT', body })
        : api(`/customers/${id}/pets`, { method: 'POST', body });
    },
    onSuccess: () => {
      toast.success('Pet salvo.');
      setPetForm(null);
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removePet = useMutation({
    mutationFn: (petId: number) => api(`/customers/${id}/pets/${petId}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Pet removido.');
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (customer.isLoading) return <Loading />;
  if (customer.error) return <ErrorBox error={customer.error} />;
  if (!customer.data) return null;

  const data = customer.data;

  return (
    <div className="stack">
      <div className="row between wrap">
        <div className="row">
          <Link to="/clientes" className="btn ghost sm">
            ← Clientes
          </Link>
          <h1>{data.name}</h1>
          {!data.active ? <span className="badge red">Inativo</span> : null}
        </div>
        <div className="row">
          {data.phone ? (
            <a
              className="btn secondary"
              href={whatsappLink(data.phone, `Olá ${data.name.split(' ')[0]}! Aqui é da loja 🐾`)}
              target="_blank"
              rel="noreferrer"
            >
              💬 WhatsApp
            </a>
          ) : null}
          <button type="button" className="btn secondary" onClick={() => setEditOpen(true)}>
            Editar cadastro
          </button>
          <Link to="/pdv" className="btn">
            + Nova venda
          </Link>
        </div>
      </div>

      <div className="grid cols-4">
        <div className="stat accent">
          <div className="label">Total comprado</div>
          <div className="value">{currency(data.stats.totalSpent)}</div>
          <div className="hint">{data.stats.salesCount} compra(s)</div>
        </div>
        <div className="stat">
          <div className="label">Ticket médio</div>
          <div className="value">
            {currency(
              data.stats.salesCount > 0 ? data.stats.totalSpent / data.stats.salesCount : 0,
            )}
          </div>
        </div>
        <div className="stat">
          <div className="label">Última compra</div>
          <div className="value" style={{ fontSize: 17 }}>
            {data.stats.lastPurchaseAt ? date(data.stats.lastPurchaseAt) : '—'}
          </div>
        </div>
        <div className="stat">
          <div className="label">Limite de crediário</div>
          <div className="value" style={{ fontSize: 20 }}>
            {currency(data.credit_limit)}
          </div>
        </div>
      </div>

      <div className="grid cols-3">
        <div className="card">
          <div className="card-header">
            <h2>Cadastro</h2>
          </div>
          <div className="card-body stack sm text-sm">
            <Info label="Tipo" value={data.person_type === 'PJ' ? 'Pessoa jurídica' : 'Pessoa física'} />
            <Info label="Documento" value={formatDocument(data.document) || '—'} />
            {data.person_type === 'PJ' ? (
              <>
                <Info label="Nome fantasia" value={data.trade_name || '—'} />
                <Info label="Inscrição estadual" value={data.state_registration || '—'} />
              </>
            ) : null}
            <Info label="Telefone" value={formatPhone(data.phone) || '—'} />
            <Info label="E-mail" value={data.email || '—'} />
            <Info label="Nascimento" value={data.birth_date ? date(data.birth_date) : '—'} />
            <Info
              label="Endereço"
              value={
                data.street
                  ? `${data.street}, ${data.number} · ${data.district} · ${data.city}/${data.state} · ${formatZip(data.zip_code)}`
                  : '—'
              }
            />
            {data.notes ? <Info label="Observações" value={data.notes} /> : null}
          </div>
        </div>

        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="card-header">
            <h2>Pets</h2>
            <button type="button" className="btn secondary sm" onClick={() => setPetForm({ ...EMPTY_PET })}>
              + Adicionar pet
            </button>
          </div>
          <div className="card-body tight table-wrap">
            {data.pets.length === 0 ? (
              <EmptyState
                icon="🐕"
                title="Nenhum pet cadastrado"
                description="Registre os pets para prever a recompra de ração e personalizar o atendimento."
              />
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Pet</th>
                    <th>Raça / porte</th>
                    <th>Idade</th>
                    <th>Ração habitual</th>
                    <th className="num">Consumo</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.pets.map((pet) => (
                    <tr key={pet.id}>
                      <td>
                        <span className="strong">
                          {SPECIES_ICONS[pet.species] ?? '🐾'} {pet.name}
                        </span>
                        <div className="text-xs muted">{SPECIES_LABELS[pet.species] ?? pet.species}</div>
                      </td>
                      <td className="text-sm">
                        {pet.breed || '—'}
                        <div className="text-xs muted" style={{ textTransform: 'capitalize' }}>
                          {pet.size}
                          {pet.weight_kg ? ` · ${pet.weight_kg} kg` : ''}
                        </div>
                      </td>
                      <td className="text-sm">{petAge(pet.birth_date)}</td>
                      <td className="text-sm">{pet.food_product_name ?? <span className="muted">—</span>}</td>
                      <td className="num text-sm">
                        {pet.daily_food_grams ? `${pet.daily_food_grams} g/dia` : '—'}
                      </td>
                      <td className="nowrap">
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => setPetForm({ ...pet })}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => {
                            if (confirm(`Remover o pet ${pet.name}?`)) removePet.mutate(pet.id);
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
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>Últimas compras</h2>
        </div>
        <div className="card-body tight table-wrap">
          {data.recentSales.length === 0 ? (
            <EmptyState icon="🧾" title="Nenhuma compra registrada" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nº</th>
                  <th>Data</th>
                  <th className="num">Total</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.recentSales.map((sale) => (
                  <tr key={sale.id}>
                    <td className="mono">#{sale.number}</td>
                    <td className="text-sm">{dateTime(sale.sold_at)}</td>
                    <td className="num strong">{currency(sale.total)}</td>
                    <td>
                      <SaleStatusBadge status={sale.status} />
                    </td>
                    <td>
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
      </div>

      {editOpen ? <CustomerFormModal customer={data} onClose={() => setEditOpen(false)} /> : null}

      {petForm ? (
        <Modal
          title={petForm.id ? `Editar ${petForm.name}` : 'Novo pet'}
          onClose={() => setPetForm(null)}
          footer={
            <>
              <button type="button" className="btn secondary" onClick={() => setPetForm(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => savePet.mutate(petForm)}
                disabled={savePet.isPending || !petForm.name.trim()}
              >
                Salvar pet
              </button>
            </>
          }
        >
          <div className="form-grid">
            <Field label="Nome" className="col-6">
              <input
                value={petForm.name}
                onChange={(event) => setPetForm({ ...petForm, name: event.target.value })}
              />
            </Field>
            <Field label="Espécie" className="col-3">
              <select
                value={petForm.species}
                onChange={(event) =>
                  setPetForm({ ...petForm, species: event.target.value as PetSpecies })
                }
              >
                {['cachorro', 'gato', 'ave', 'peixe', 'roedor', 'reptil', 'outro'].map((species) => (
                  <option key={species} value={species}>
                    {SPECIES_LABELS[species]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Porte" className="col-3">
              <select
                value={petForm.size}
                onChange={(event) =>
                  setPetForm({ ...petForm, size: event.target.value as Pet['size'] })
                }
              >
                <option value="mini">Mini</option>
                <option value="pequeno">Pequeno</option>
                <option value="medio">Médio</option>
                <option value="grande">Grande</option>
                <option value="gigante">Gigante</option>
              </select>
            </Field>
            <Field label="Raça" className="col-6">
              <input
                value={petForm.breed}
                onChange={(event) => setPetForm({ ...petForm, breed: event.target.value })}
              />
            </Field>
            <Field label="Nascimento" className="col-3">
              <input
                type="date"
                value={petForm.birth_date ?? ''}
                onChange={(event) =>
                  setPetForm({ ...petForm, birth_date: event.target.value || null })
                }
              />
            </Field>
            <Field label="Peso (kg)" className="col-3">
              <input
                type="number"
                step="0.1"
                min="0"
                value={petForm.weight_kg ?? ''}
                onChange={(event) =>
                  setPetForm({
                    ...petForm,
                    weight_kg: event.target.value === '' ? null : Number(event.target.value),
                  })
                }
              />
            </Field>

            <Field
              label="Ração habitual"
              className="col-8"
              help="Base para a previsão de recompra no relatório de fidelização"
            >
              <select
                value={petForm.food_product_id ?? ''}
                onChange={(event) =>
                  setPetForm({
                    ...petForm,
                    food_product_id: event.target.value === '' ? null : Number(event.target.value),
                  })
                }
              >
                <option value="">Não informado</option>
                {products.data?.data
                  .filter((product) => product.package_weight_kg)
                  .map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Consumo diário (g)" className="col-4">
              <input
                type="number"
                step="1"
                min="0"
                value={petForm.daily_food_grams ?? ''}
                onChange={(event) =>
                  setPetForm({
                    ...petForm,
                    daily_food_grams: event.target.value === '' ? null : Number(event.target.value),
                  })
                }
              />
            </Field>

            <Field label="Castrado" className="col-4">
              <label className="checkbox" style={{ paddingTop: 8 }}>
                <input
                  type="checkbox"
                  checked={petForm.neutered}
                  onChange={(event) => setPetForm({ ...petForm, neutered: event.target.checked })}
                />
                Sim
              </label>
            </Field>
            <Field label="Observações (alergias, medicações...)" className="col-12">
              <textarea
                value={petForm.notes}
                onChange={(event) => setPetForm({ ...petForm, notes: event.target.value })}
              />
            </Field>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs muted" style={{ fontWeight: 600 }}>
        {label}
      </div>
      <div>{value}</div>
    </div>
  );
}

function petAge(birthDate: string | null): string {
  if (!birthDate) return '—';
  const birth = new Date(`${birthDate}T12:00:00`);
  const months = Math.max(
    0,
    (new Date().getFullYear() - birth.getFullYear()) * 12 + new Date().getMonth() - birth.getMonth(),
  );
  if (months < 12) return `${months} meses`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest === 0 ? `${years} ano(s)` : `${years}a ${rest}m`;
}
