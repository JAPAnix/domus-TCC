import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { apiError } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { Avatar, Button, ErrorState, Input, Modal, SkeletonList, Toggle, useToast } from '../../components/ui';
import { SettingsBlock, SettingsHeading } from './SettingsPages';
import { Link } from 'react-router-dom';

const VISIBILITY = [
  ['everyone', 'Todas as pessoas', 'Qualquer visitante pode ver o seu perfil.'],
  ['members', 'Só quem tem conta', 'Visitantes sem login veem apenas seu nome e foto.'],
  ['connections', 'Só minhas conexões', 'Só quem já fechou negócio com você vê o perfil completo.'],
];

function BlockedPeople() {
  const toast = useToast();
  const blocked = useApiResource('/blocks', undefined, { keepPrevious: true });
  const [busy, setBusy] = useState('');

  async function unblock(uuid) {
    setBusy(uuid);
    try {
      await api.delete(`/blocks/${uuid}`);
      toast.success('Usuário desbloqueado.');
      blocked.retry();
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível desbloquear.'));
    } finally {
      setBusy('');
    }
  }

  if (!blocked.data && blocked.loading) return <SkeletonList count={1} label="Carregando bloqueios" itemClassName="h-16" />;
  if (blocked.error) return <ErrorState title="Não foi possível carregar os bloqueios" message={apiError(blocked.error)} onRetry={blocked.retry} />;
  if (!blocked.data.length) return <p className="rounded-card border border-dashed border-line-strong p-4 text-sm text-ink-muted">Você não bloqueou ninguém. Para bloquear, abra o perfil da pessoa e use “Bloquear esta pessoa”.</p>;
  return (
    <ul className="space-y-2">
      {blocked.data.map((person) => (
        <li key={person.uuid} className="flex items-center justify-between gap-3 rounded-card border border-line p-3">
          <span className="flex min-w-0 items-center gap-3"><Avatar src={person.profilePictureUrl} name={person.name} size="sm" decorative /><span className="truncate text-sm font-medium">{person.name}</span></span>
          <Button variant="secondary" size="sm" onClick={() => unblock(person.uuid)} loading={busy === person.uuid}>Desbloquear</Button>
        </li>
      ))}
    </ul>
  );
}

function DeleteAccount({ hasPassword }) {
  const toast = useToast();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState('');
  const [word, setWord] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function openDialog() { setOpen(true); setStep(1); setPassword(''); setWord(''); setToken(''); setError(''); }

  async function start(event) {
    event.preventDefault();
    if (hasPassword && !password) { setError('Digite sua senha para continuar.'); return; }
    setBusy(true);
    setError('');
    try {
      const { data } = await api.post('/account/delete/start', hasPassword ? { password } : {});
      setToken(data.token);
      setStep(2);
    } catch (err) {
      setError(err.response?.status === 403 ? 'Senha incorreta.' : apiError(err, 'Não foi possível continuar.'));
    } finally {
      setBusy(false);
    }
  }

  async function confirm(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.post('/account/delete/confirm', { token, confirmation: word });
      // Passa por /sair, que encerra a sessão sem a rota protegida desviar para o login.
      navigate('/sair?para=%2F', { replace: true });
      toast.success('Sua conta foi excluída.');
    } catch (err) {
      setError(apiError(err, 'Não foi possível excluir a conta.'));
      setBusy(false);
    }
  }

  return (
    <SettingsBlock tone="danger" title="Excluir minha conta" description="A exclusão é definitiva. Seus dados pessoais, fotos, favoritos e notificações são apagados, e seu nome some das avaliações que outras pessoas guardam. Pedidos abertos são cancelados. Não é possível excluir enquanto houver serviço em andamento.">
      <Button variant="dangerOutline" onClick={openDialog}>Excluir minha conta</Button>
      <Modal open={open} title={step === 1 ? 'Excluir conta (1 de 2)' : 'Excluir conta (2 de 2)'} onClose={() => !busy && setOpen(false)}>
        {step === 1 ? (
          <form onSubmit={start} noValidate className="space-y-4">
            <p className="text-sm leading-6 text-ink-soft">Confirme que é você. Na próxima etapa, você ainda poderá desistir.</p>
            {hasPassword && <Input label="Sua senha" type="password" autoComplete="current-password" required value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} error={error} />}
            {!hasPassword && error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Cancelar</Button><Button type="submit" loading={busy}>Continuar</Button></div>
          </form>
        ) : (
          <form onSubmit={confirm} noValidate className="space-y-4">
            <p className="text-sm leading-6 text-ink-soft">Esta ação não pode ser desfeita. Para confirmar, digite <strong>EXCLUIR</strong> abaixo. A confirmação vale por 10 minutos.</p>
            <Input label="Digite EXCLUIR" value={word} onChange={(event) => { setWord(event.target.value); setError(''); }} autoComplete="off" error={error} />
            <div className="flex justify-end gap-3"><Button variant="secondary" onClick={() => setOpen(false)} disabled={busy}>Desistir</Button><Button type="submit" variant="danger" loading={busy} disabled={word !== 'EXCLUIR'}>Excluir minha conta</Button></div>
          </form>
        )}
      </Modal>
    </SettingsBlock>
  );
}

export default function PrivacySettings() {
  const toast = useToast();
  const resource = useApiResource('/settings', undefined, { keepPrevious: true });
  const me = useApiResource('/auth/me', undefined, { keepPrevious: true });
  const [local, setLocal] = useState(null);
  const [busy, setBusy] = useState('');
  const settings = local ?? resource.data;

  async function save(path, key, body) {
    setBusy(key);
    try {
      const { data } = await api.patch(`/settings/${path}`, body);
      setLocal(data);
      toast.success('Preferência salva.');
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível salvar.'));
    } finally {
      setBusy('');
    }
  }

  async function download(format) {
    setBusy(`export-${format}`);
    try {
      const { data } = await api.get('/account/export', { params: { format }, responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `dommos-meus-dados.${format}`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Seus dados foram baixados.');
    } catch (err) {
      toast.error(err.response?.status === 429 ? 'Você já pediu seus dados várias vezes. Tente de novo mais tarde.' : 'Não foi possível baixar seus dados.');
    } finally {
      setBusy('');
    }
  }

  if (!settings && resource.loading) return <><SettingsHeading title="Privacidade" /><div className="mt-6"><SkeletonList count={3} label="Carregando" itemClassName="h-32" /></div></>;
  if (resource.error || !settings) return <><SettingsHeading title="Privacidade" /><div className="mt-6"><ErrorState title="Não foi possível carregar esta página" message={apiError(resource.error)} onRetry={resource.retry} /></div></>;

  const { privacy, cookies } = settings;
  return (
    <>
      <SettingsHeading title="Privacidade">Controle quem vê as suas informações e como o Dommos usa os seus dados. Cada alteração é salva na hora.</SettingsHeading>

      <SettingsBlock title="Quem pode ver o seu perfil" description="Seu e-mail, telefone e endereço nunca aparecem no perfil público.">
        <fieldset disabled={busy === 'visibility'} className="space-y-2">
          <legend className="sr-only">Quem pode ver o seu perfil</legend>
          {VISIBILITY.map(([value, label, description]) => (
            <label key={value} className={`flex min-h-control cursor-pointer items-start gap-3 rounded-card border p-4 ${privacy.profileVisibility === value ? 'border-primary bg-primary-softer' : 'border-line'}`}>
              <input type="radio" name="visibility" className="mt-1" checked={privacy.profileVisibility === value} onChange={() => save('privacy', 'visibility', { profile_visibility: value })} />
              <span><span className="block text-sm font-medium">{label}</span><span className="block text-sm text-ink-muted">{description}</span></span>
            </label>
          ))}
        </fieldset>
      </SettingsBlock>

      <SettingsBlock title="Busca e avaliações">
        <div className="space-y-6">
          <Toggle label="Aparecer nos resultados de busca do Dommos" description="Desligue para que o seu perfil profissional e seus anúncios deixem de aparecer na busca. Quem tiver o link ainda consegue abrir." checked={privacy.searchIndexing} disabled={busy === 'search'} onChange={(value) => save('privacy', 'search', { search_indexing: value })} />
          <Toggle label="Mostrar no meu perfil as avaliações que eu escrevo" description="Quando desligado, só você vê a lista de avaliações que escreveu." checked={privacy.showWrittenReviews} disabled={busy === 'written'} onChange={(value) => save('privacy', 'written', { show_written_reviews: value })} />
          <Toggle label="Confirmação de leitura de mensagens" description="Quando ligada, a outra pessoa vê “Visto” nas mensagens que você leu, e você vê o dela. Desligada, nenhum dos dois aparece." checked={privacy.readReceipts} disabled={busy === 'receipts'} onChange={(value) => save('privacy', 'receipts', { read_receipts: value })} />
        </div>
      </SettingsBlock>

      <SettingsBlock title="Pessoas bloqueadas" description="Quem você bloqueia não vê o seu perfil e não envia propostas aos seus pedidos."><BlockedPeople /></SettingsBlock>

      <SettingsBlock title="Cookies" description="Os cookies essenciais mantêm você conectado e sempre ficam ativos. Hoje o Dommos não usa cookies de análise nem de marketing; sua escolha fica registrada e será respeitada se isso mudar.">
        <div className="space-y-6">
          <Toggle label="Cookies essenciais" description="Necessários para entrar na conta e usar o site." checked disabled onChange={() => {}} />
          <Toggle label="Cookies de análise" description="Ajudam a entender como o site é usado." checked={cookies.analytics} disabled={busy === 'analytics'} onChange={(value) => save('cookies', 'analytics', { analytics: value })} />
          <Toggle label="Cookies de marketing" description="Personalizam anúncios e comunicações." checked={cookies.marketing} disabled={busy === 'marketing'} onChange={(value) => save('cookies', 'marketing', { marketing: value })} />
        </div>
      </SettingsBlock>

      <SettingsBlock title="Meus dados pessoais" description="Baixe uma cópia dos dados que o Dommos guarda sobre você: conta, perfil, pedidos, propostas, avaliações, favoritos e chamados. Senhas não são incluídas. Leia também a nossa Política de privacidade.">
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => download('json')} loading={busy === 'export-json'}>Baixar em JSON</Button>
          <Button variant="secondary" onClick={() => download('csv')} loading={busy === 'export-csv'}>Baixar em CSV</Button>
          <Link to="/politica-de-privacidade" className="inline-flex min-h-control items-center px-2 text-sm font-semibold text-primary-strong underline underline-offset-2">Política de privacidade</Link>
        </div>
      </SettingsBlock>

      {me.data && <DeleteAccount hasPassword={me.data.hasPassword} />}
    </>
  );
}
