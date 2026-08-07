import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Field, FieldsetTitle, Modal } from '@/components/ui';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';
import { onlyDigits } from '@/lib/format';
import type { Customer } from '@/types';

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR',
  'RJ','RN','RO','RR','RS','SC','SE','SP','TO',
];

const EMPTY: Omit<Customer, 'id' | 'pets'> = {
  person_type: 'PF',
  name: '',
  trade_name: '',
  document: '',
  state_registration: '',
  email: '',
  phone: '',
  birth_date: null,
  zip_code: '',
  street: '',
  number: '',
  complement: '',
  district: '',
  city: '',
  city_ibge_code: '',
  state: 'SP',
  notes: '',
  credit_limit: 0,
  active: true,
};

export function CustomerFormModal({
  customer,
  onClose,
}: {
  customer?: Customer | null;
  onClose: () => void;
}) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Omit<Customer, 'id' | 'pets'>>(
    customer ? { ...EMPTY, ...customer } : EMPTY,
  );

  const save = useMutation({
    mutationFn: (payload: typeof form) =>
      customer
        ? api<Customer>(`/customers/${customer.id}`, { method: 'PUT', body: payload })
        : api<Customer>('/customers', { method: 'POST', body: payload }),
    onSuccess: () => {
      toast.success(customer ? 'Cliente atualizado.' : 'Cliente cadastrado.');
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['customer'] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  /** Preenche o endereço a partir do CEP usando a API pública ViaCEP. */
  async function lookupZip() {
    const zip = onlyDigits(form.zip_code);
    if (zip.length !== 8) return;
    try {
      const response = await fetch(`https://viacep.com.br/ws/${zip}/json/`);
      const data = await response.json();
      if (data.erro) {
        toast.error('CEP não encontrado.');
        return;
      }
      setForm((current) => ({
        ...current,
        street: data.logradouro ?? current.street,
        district: data.bairro ?? current.district,
        city: data.localidade ?? current.city,
        state: data.uf ?? current.state,
        city_ibge_code: data.ibge ?? current.city_ibge_code,
      }));
    } catch {
      toast.error('Não foi possível consultar o CEP.');
    }
  }

  return (
    <Modal
      title={customer ? `Editar ${customer.name}` : 'Novo cliente'}
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
            disabled={save.isPending || form.name.trim().length < 2}
          >
            {save.isPending ? <span className="spinner" /> : 'Salvar cliente'}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Tipo de pessoa" className="col-3">
          <select
            value={form.person_type}
            onChange={(event) => set('person_type', event.target.value as 'PF' | 'PJ')}
          >
            <option value="PF">Pessoa física</option>
            <option value="PJ">Pessoa jurídica</option>
          </select>
        </Field>
        <Field label={form.person_type === 'PF' ? 'Nome completo' : 'Razão social'} className="col-6">
          <input value={form.name} onChange={(event) => set('name', event.target.value)} />
        </Field>
        <Field label={form.person_type === 'PF' ? 'CPF' : 'CNPJ'} className="col-3">
          <input
            value={form.document}
            onChange={(event) => set('document', event.target.value)}
            placeholder={form.person_type === 'PF' ? '000.000.000-00' : '00.000.000/0000-00'}
          />
        </Field>

        {form.person_type === 'PJ' ? (
          <>
            <Field label="Nome fantasia" className="col-6">
              <input value={form.trade_name} onChange={(event) => set('trade_name', event.target.value)} />
            </Field>
            <Field label="Inscrição estadual" className="col-6" help="Necessária para NF-e a contribuinte">
              <input
                value={form.state_registration}
                onChange={(event) => set('state_registration', event.target.value)}
              />
            </Field>
          </>
        ) : null}

        <Field label="Telefone / WhatsApp" className="col-4">
          <input value={form.phone} onChange={(event) => set('phone', event.target.value)} placeholder="(11) 99999-9999" />
        </Field>
        <Field label="E-mail" className="col-5">
          <input type="email" value={form.email} onChange={(event) => set('email', event.target.value)} />
        </Field>
        <Field label={form.person_type === 'PF' ? 'Nascimento' : 'Fundação'} className="col-3">
          <input
            type="date"
            value={form.birth_date ?? ''}
            onChange={(event) => set('birth_date', event.target.value || null)}
          />
        </Field>

        <FieldsetTitle>Endereço (necessário para emissão de NF-e)</FieldsetTitle>

        <Field label="CEP" className="col-3">
          <div className="row">
            <input
              value={form.zip_code}
              onChange={(event) => set('zip_code', event.target.value)}
              onBlur={lookupZip}
              placeholder="00000-000"
            />
            <button type="button" className="btn secondary sm" onClick={lookupZip}>
              Buscar
            </button>
          </div>
        </Field>
        <Field label="Logradouro" className="col-6">
          <input value={form.street} onChange={(event) => set('street', event.target.value)} />
        </Field>
        <Field label="Número" className="col-3">
          <input value={form.number} onChange={(event) => set('number', event.target.value)} />
        </Field>
        <Field label="Complemento" className="col-4">
          <input value={form.complement} onChange={(event) => set('complement', event.target.value)} />
        </Field>
        <Field label="Bairro" className="col-4">
          <input value={form.district} onChange={(event) => set('district', event.target.value)} />
        </Field>
        <Field label="Cidade" className="col-3">
          <input value={form.city} onChange={(event) => set('city', event.target.value)} />
        </Field>
        <Field label="UF" className="col-1">
          <select value={form.state} onChange={(event) => set('state', event.target.value)}>
            {UFS.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Código IBGE do município" className="col-4" help="Preenchido automaticamente pelo CEP">
          <input
            value={form.city_ibge_code}
            onChange={(event) => set('city_ibge_code', event.target.value)}
          />
        </Field>

        <FieldsetTitle>Comercial</FieldsetTitle>

        <Field label="Limite de crediário (R$)" className="col-3">
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.credit_limit}
            onChange={(event) => set('credit_limit', Number(event.target.value))}
          />
        </Field>
        <Field label="Situação" className="col-3">
          <label className="checkbox" style={{ paddingTop: 8 }}>
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => set('active', event.target.checked)}
            />
            Cliente ativo
          </label>
        </Field>
        <Field label="Observações" className="col-12">
          <textarea value={form.notes} onChange={(event) => set('notes', event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
