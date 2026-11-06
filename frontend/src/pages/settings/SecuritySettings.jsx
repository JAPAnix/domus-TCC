import { useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api, { apiError, apiFieldErrors } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import GoogleSignInButton from '../../components/GoogleSignInButton';
import { Button, ConfirmDialog, ErrorState, Input, Modal, SkeletonList, useToast } from '../../components/ui';
import { SettingsBlock, SettingsHeading } from './SettingsPages';

const when = (value) => new Date(value).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function PasswordSection({ hasPassword, onChanged }) {
  const toast = useToast();
  const [form, setForm] = useState({ current_password: '', new_password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const change = (event) => { setForm((current) => ({ ...current, [event.target.name]: event.target.value })); setErrors((current) => ({ ...current, [event.target.name]: undefined })); };

  async function submit(event) {
    event.preventDefault();
    const found = {};
    if (hasPassword && !form.current_password) found.current_password = 'Digite a senha atual.';
    if (form.new_password.length < 8) found.new_password = 'A nova senha precisa ter pelo menos 8 caracteres.';
    else if (hasPassword && form.new_password === form.current_password) found.new_password = 'A nova senha precisa ser diferente da atual.';
    if (form.confirm !== form.new_password) found.confirm = 'As senhas não coincidem.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      await api.patch('/account/password', { ...(hasPassword && { current_password: form.current_password }), new_password: form.new_password });
      toast.success(hasPassword ? 'Senha alterada. Os outros dispositivos foram desconectados.' : 'Senha criada.');
      setForm({ current_password: '', new_password: '', confirm: '' });
      onChanged();
    } catch (err) {
      const fields = apiFieldErrors(err);
      setErrors(err.response?.status === 403 ? { current_password: 'A senha atual está incorreta.' } : { new_password: fields.new_password });
      toast.error(apiError(err, 'Não foi possível alterar a senha.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <SettingsBlock title={hasPassword ? 'Alterar senha' : 'Criar senha'} description={hasPassword ? 'Ao trocar a senha, os outros dispositivos conectados são desconectados.' : 'Você entrou com o Google e ainda não tem senha. Crie uma para também poder entrar com e-mail e senha.'}>
      <form onSubmit={submit} noValidate className="max-w-md space-y-4">
        {hasPassword && <Input label="Senha atual" name="current_password" type="password" autoComplete="current-password" required value={form.current_password} onChange={change} error={errors.current_password} />}
        <Input label="Nova senha" name="new_password" type="password" autoComplete="new-password" required hint="Use pelo menos 8 caracteres." value={form.new_password} onChange={change} error={errors.new_password} />
        <Input label="Confirmar nova senha" name="confirm" type="password" autoComplete="new-password" required value={form.confirm} onChange={change} error={errors.confirm} />
        <Button type="submit" loading={busy}>{hasPassword ? 'Alterar senha' : 'Criar senha'}</Button>
      </form>
    </SettingsBlock>
  );
}

function GoogleSection({ linked, hasPassword, onChanged }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const configured = !!import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const connect = useCallback(async (credential) => {
    setBusy(true);
    try {
      await api.post('/account/google', { credential });
      toast.success('Conta Google conectada.');
      onChanged();
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível conectar o Google.'));
    } finally {
      setBusy(false);
    }
  }, [onChanged, toast]);

  async function disconnect() {
    setBusy(true);
    try {
      await api.delete('/account/google');
      toast.success('Conta Google desconectada.');
      onChanged();
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível desconectar o Google.'));
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <SettingsBlock title="Contas sociais" description="Entre no Dommos com uma conta que você já tem.">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-line p-4">
        <div>
          <p className="font-medium">Google</p>
          <p className="text-sm text-ink-muted">{linked ? 'Conectado' : 'Não conectado'}</p>
        </div>
        {linked ? (
          <Button variant="secondary" onClick={() => setConfirming(true)} disabled={!hasPassword || busy}>Desconectar</Button>
        ) : configured ? (
          <div className={busy ? 'pointer-events-none opacity-60' : ''}><GoogleSignInButton onCredential={connect} disabled={busy} /></div>
        ) : (
          <p className="max-w-xs text-sm text-ink-muted">O login com Google não está configurado neste ambiente.</p>
        )}
      </div>
      {linked && !hasPassword && <p className="mt-3 text-sm text-warning">Para desconectar o Google, crie uma senha primeiro. Assim você não perde o acesso à conta.</p>}
      <ConfirmDialog open={confirming} busy={busy} danger title="Desconectar o Google" confirmLabel="Desconectar" message="Depois disso, você entrará só com e-mail e senha." onConfirm={disconnect} onCancel={() => setConfirming(false)} />
    </SettingsBlock>
  );
}

function SessionsSection() {
  const toast = useToast();
  const sessions = useApiResource('/account/sessions', undefined, { keepPrevious: true });
  const [busy, setBusy] = useState('');
  const list = sessions.data ?? [];

  async function revoke(id) {
    setBusy(id);
    try {
      await api.delete(`/account/sessions/${id}`);
      toast.success('Dispositivo desconectado.');
      sessions.retry();
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível desconectar.'));
    } finally {
      setBusy('');
    }
  }

  async function revokeOthers() {
    setBusy('all');
    try {
      const { data } = await api.delete('/account/sessions');
      toast.success(data.revoked ? 'Os outros dispositivos foram desconectados.' : 'Não havia outros dispositivos conectados.');
      sessions.retry();
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível desconectar.'));
    } finally {
      setBusy('');
    }
  }

  return (
    <SettingsBlock title="Onde você está conectado" description="Estes são os dispositivos com sessão aberta na sua conta. Se não reconhecer algum, desconecte e troque a senha.">
      {!sessions.data && sessions.loading ? <SkeletonList count={2} label="Carregando dispositivos" itemClassName="h-20" className="space-y-3" />
        : sessions.error ? <ErrorState title="Não foi possível carregar os dispositivos" message={apiError(sessions.error)} onRetry={sessions.retry} />
          : (
            <>
              <ul className="space-y-3">
                {list.map((session) => (
                  <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line p-4">
                    <div className="min-w-0">
                      <p className="font-medium">{session.device}{session.current && <span className="ml-2 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success">Este dispositivo</span>}</p>
                      <p className="text-sm text-ink-muted">Rede {session.ip} · último acesso {when(session.lastSeenAt)}</p>
                      <p className="text-xs text-ink-muted">Conectado em {when(session.createdAt)}</p>
                    </div>
                    {session.current
                      ? <Button to="/sair" variant="secondary" size="sm">Sair da conta</Button>
                      : <Button variant="secondary" size="sm" onClick={() => revoke(session.id)} loading={busy === session.id}>Sair da conta</Button>}
                  </li>
                ))}
              </ul>
              {list.length > 1 && <Button variant="ghost" className="mt-4" onClick={revokeOthers} loading={busy === 'all'}>Sair de todos os outros dispositivos</Button>}
            </>
          )}
    </SettingsBlock>
  );
}

function DeactivateSection({ hasPassword }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (hasPassword && !password) { setError('Digite sua senha para confirmar.'); return; }
    setBusy(true);
    try {
      await api.post('/account/deactivate', hasPassword ? { password } : {});
      navigate('/sair?para=%2F', { replace: true });
      toast.success('Conta desativada. Entre novamente quando quiser reativá-la.');
    } catch (err) {
      setError(err.response?.status === 403 ? 'Senha incorreta.' : apiError(err, 'Não foi possível desativar a conta.'));
      setBusy(false);
    }
  }

  return (
    <SettingsBlock title="Desativar conta" description="Desativar é temporário: seu perfil, seus anúncios e seus pedidos deixam de aparecer para os outros, e você é desconectado de todos os dispositivos. Para reativar, basta entrar de novo. Para apagar os dados de vez, veja “Excluir minha conta” em Privacidade.">
      <Button variant="dangerOutline" onClick={() => { setOpen(true); setError(''); setPassword(''); }}>Desativar minha conta</Button>
      <Modal open={open} title="Desativar conta" onClose={() => !busy && setOpen(false)}>
        <form onSubmit={submit} noValidate className="space-y-4">
          <p className="text-sm leading-6 text-ink-soft">Você será desconectado de todos os dispositivos. Entre de novo quando quiser reativar a conta.</p>
          {hasPassword && <Input label="Sua senha" type="password" autoComplete="current-password" required value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} error={error} />}
          {!hasPassword && error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button>
            <Button type="submit" variant="danger" loading={busy}>Desativar</Button>
          </div>
        </form>
      </Modal>
    </SettingsBlock>
  );
}

export default function SecuritySettings() {
  const me = useApiResource('/auth/me', undefined, { keepPrevious: true });
  const retry = me.retry;
  const onChanged = useCallback(() => retry(), [retry]);

  if (!me.data && me.loading) return <><SettingsHeading title="Login e segurança" /><div className="mt-6"><SkeletonList count={3} label="Carregando" itemClassName="h-32" /></div></>;
  if (me.error) return <><SettingsHeading title="Login e segurança" /><div className="mt-6"><ErrorState title="Não foi possível carregar esta página" message={apiError(me.error)} onRetry={me.retry} /></div></>;

  return (
    <>
      <SettingsHeading title="Login e segurança">Cuide do acesso à sua conta. Para trocar o e-mail ou o telefone, use <Link to="/configuracoes/pessoais" className="font-semibold text-primary-strong underline underline-offset-2">Informações pessoais</Link>.</SettingsHeading>
      <PasswordSection hasPassword={me.data.hasPassword} onChanged={onChanged} />
      <GoogleSection linked={me.data.googleLinked} hasPassword={me.data.hasPassword} onChanged={onChanged} />
      <SessionsSection />
      <DeactivateSection hasPassword={me.data.hasPassword} />
    </>
  );
}
