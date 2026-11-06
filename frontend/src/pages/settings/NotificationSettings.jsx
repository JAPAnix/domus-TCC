import { useState } from 'react';
import api, { apiError } from '../../services/api';
import { useApiResource } from '../../hooks/useApiResource';
import { ErrorState, SkeletonList, Tabs, Toggle, useToast } from '../../components/ui';
import { SettingsHeading } from './SettingsPages';

const CHANNEL_LABELS = { app: 'No site', email: 'Por e-mail' };

export default function NotificationSettings() {
  const toast = useToast();
  const resource = useApiResource('/settings', undefined, { keepPrevious: true });
  const [local, setLocal] = useState(null);
  const [tab, setTab] = useState('account');
  const [busy, setBusy] = useState('');
  const settings = local ?? resource.data;

  async function toggle(key, channel, value) {
    setBusy(`${key}.${channel}`);
    try {
      const { data } = await api.patch('/settings/notifications', { [key]: { [channel]: value } });
      setLocal(data);
    } catch (err) {
      toast.error(apiError(err, 'Não foi possível salvar.'));
    } finally {
      setBusy('');
    }
  }

  if (!settings && resource.loading) return <><SettingsHeading title="Notificações" /><div className="mt-6"><SkeletonList count={3} label="Carregando" itemClassName="h-28" /></div></>;
  if (resource.error || !settings) return <><SettingsHeading title="Notificações" /><div className="mt-6"><ErrorState title="Não foi possível carregar esta página" message={apiError(resource.error)} onRetry={resource.retry} /></div></>;

  const { catalog, values } = settings.notifications;
  const items = tab === 'account' ? catalog.account : catalog.offers;
  return (
    <>
      <SettingsHeading title="Notificações">Escolha o que você quer receber e por onde. Cada alteração é salva na hora.</SettingsHeading>
      <div className="mt-6">
        <Tabs label="Tipos de notificação" value={tab} onChange={setTab} tabs={[{ value: 'offers', label: 'Ofertas e novidades' }, { value: 'account', label: 'Conta' }]} />
        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'offers' && <p className="mb-5 rounded-control bg-surface-muted p-4 text-sm leading-6 text-ink-soft">Hoje o Dommos não envia comunicados de novidades ou dicas. Sua escolha fica registrada e será respeitada quando esses envios começarem.</p>}
          <ul className="space-y-4">
            {items.map((item) => (
              <li key={item.key} className="rounded-card border border-line p-5">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-0.5 text-sm text-ink-muted">{item.description}</p>
                <div className="mt-4 space-y-4 border-t border-line pt-4">
                  {item.channels.map((channel) => (
                    <Toggle
                      key={channel}
                      label={<><span className="sr-only">{item.title}: </span>{CHANNEL_LABELS[channel]}</>}
                      checked={values[item.key][channel]}
                      disabled={busy === `${item.key}.${channel}`}
                      onChange={(value) => toggle(item.key, channel, value)}
                    />
                  ))}
                </div>
              </li>
            ))}
          </ul>
          {tab === 'account' && <p className="mt-5 text-sm text-ink-muted">Os avisos “No site” aparecem no sino do topo e na página de Notificações. O envio de e-mails depende de o serviço de e-mail estar ativo.</p>}
        </div>
      </div>
    </>
  );
}
