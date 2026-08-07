import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { EmptyState, ErrorBox, Field, Modal, TableSkeleton } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { api } from '@/lib/api';
import { date } from '@/lib/format';
import type { Role, User } from '@/types';

type Form = { id?: number; name: string; email: string; password: string; role: Role; active: boolean };

const EMPTY: Form = { name: '', email: '', password: '', role: 'operador', active: true };

const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  gerente: 'Gerente',
  operador: 'Operador de caixa',
};

export function UsersPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { user: current } = useAuth();
  const [editing, setEditing] = useState<Form | null>(null);
  const [passwordOpen, setPasswordOpen] = useState(false);

  const users = useQuery({ queryKey: ['users'], queryFn: () => api<User[]>('/users') });

  const save = useMutation({
    mutationFn: (payload: Form) => {
      const body: Record<string, unknown> = {
        name: payload.name,
        email: payload.email,
        role: payload.role,
        active: payload.active,
      };
      if (payload.password) body.password = payload.password;
      return payload.id
        ? api(`/users/${payload.id}`, { method: 'PUT', body })
        : api('/users', { method: 'POST', body });
    },
    onSuccess: () => {
      toast.success('Usuário salvo.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEditing(null);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deactivate = useMutation({
    mutationFn: (id: number) => api(`/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Usuário desativado.');
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="stack">
      <div className="toolbar">
        <div className="spacer" />
        <button type="button" className="btn secondary" onClick={() => setPasswordOpen(true)}>
          Alterar minha senha
        </button>
        <button type="button" className="btn" onClick={() => setEditing({ ...EMPTY })}>
          + Novo usuário
        </button>
      </div>

      <div className="card">
        <div className="card-body tight table-wrap">
          <ErrorBox error={users.error} />
          {users.isLoading ? (
            <TableSkeleton cols={5} />
          ) : !users.data?.length ? (
            <EmptyState icon="👥" title="Nenhum usuário" />
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Criado em</th>
                  <th>Situação</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.data.map((user) => (
                  <tr key={user.id}>
                    <td className="strong">
                      {user.name}
                      {user.id === current?.id ? <span className="badge blue" style={{ marginLeft: 6 }}>você</span> : null}
                    </td>
                    <td className="text-sm">{user.email}</td>
                    <td>
                      <span className="badge gray">{ROLE_LABELS[user.role]}</span>
                    </td>
                    <td className="text-sm muted">{user.created_at ? date(user.created_at) : '—'}</td>
                    <td>
                      {user.active ? (
                        <span className="badge green">Ativo</span>
                      ) : (
                        <span className="badge red">Inativo</span>
                      )}
                    </td>
                    <td className="nowrap">
                      <button
                        type="button"
                        className="btn ghost sm"
                        onClick={() =>
                          setEditing({
                            id: user.id,
                            name: user.name,
                            email: user.email,
                            password: '',
                            role: user.role,
                            active: user.active,
                          })
                        }
                      >
                        Editar
                      </button>
                      {user.active && user.id !== current?.id ? (
                        <button
                          type="button"
                          className="btn ghost sm"
                          onClick={() => {
                            if (confirm(`Desativar o acesso de ${user.name}?`)) deactivate.mutate(user.id);
                          }}
                        >
                          Desativar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {editing ? (
        <Modal
          title={editing.id ? `Editar ${editing.name}` : 'Novo usuário'}
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
                disabled={save.isPending || !editing.name.trim() || !editing.email.trim()}
              >
                Salvar
              </button>
            </>
          }
        >
          <div className="form-grid">
            <Field label="Nome" className="col-12">
              <input value={editing.name} onChange={(event) => setEditing({ ...editing, name: event.target.value })} />
            </Field>
            <Field label="E-mail" className="col-12">
              <input
                type="email"
                value={editing.email}
                onChange={(event) => setEditing({ ...editing, email: event.target.value })}
              />
            </Field>
            <Field
              label="Senha"
              className="col-12"
              help={editing.id ? 'Deixe em branco para manter a senha atual' : 'Mínimo de 6 caracteres'}
            >
              <input
                type="password"
                value={editing.password}
                onChange={(event) => setEditing({ ...editing, password: event.target.value })}
              />
            </Field>
            <Field label="Perfil" className="col-12">
              <select
                value={editing.role}
                onChange={(event) => setEditing({ ...editing, role: event.target.value as Role })}
              >
                <option value="operador">Operador de caixa — vende e consulta</option>
                <option value="gerente">Gerente — ajusta estoque e configurações</option>
                <option value="admin">Administrador — acesso total</option>
              </select>
            </Field>
            <Field label="Situação" className="col-12">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={editing.active}
                  onChange={(event) => setEditing({ ...editing, active: event.target.checked })}
                />
                Usuário ativo
              </label>
            </Field>
          </div>
        </Modal>
      ) : null}

      {passwordOpen ? <ChangePasswordModal onClose={() => setPasswordOpen(false)} /> : null}
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const change = useMutation({
    mutationFn: () =>
      api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      }),
    onSuccess: () => {
      toast.success('Senha alterada.');
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Modal
      title="Alterar minha senha"
      size="narrow"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => change.mutate()}
            disabled={change.isPending || newPassword.length < 6}
          >
            Alterar
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Senha atual" className="col-12">
          <input
            type="password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </Field>
        <Field label="Nova senha" className="col-12" help="Mínimo de 6 caracteres">
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}
