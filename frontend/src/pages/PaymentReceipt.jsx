import { useParams } from 'react-router-dom';
import { apiError } from '../services/api';
import { useApiResource } from '../hooks/useApiResource';
import { formatDay, formatMoney } from '../utils/format';
import { Breadcrumb, Button, Card, EmptyState, ErrorState, SkeletonList } from '../components/ui';

const when = (value) => (value ? new Date(value).toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' }) : '');

export default function PaymentReceipt() {
  const { uuid } = useParams();
  const resource = useApiResource(`/payments/${uuid}/receipt`);
  const receipt = resource.data;
  const crumbs = [{ label: 'Pagamentos', to: '/configuracoes/pagamentos' }, { label: 'Recibo' }];

  if (resource.loading) return <main className="mx-auto max-w-form px-4 py-10 sm:px-6"><Breadcrumb items={crumbs} /><SkeletonList count={2} label="Carregando recibo" itemClassName="h-24" /></main>;
  if (resource.error) {
    const status = resource.error.response?.status;
    return (
      <main className="mx-auto max-w-form px-4 py-10 sm:px-6">
        <Breadcrumb items={crumbs} />
        {status === 404 || status === 409
          ? <EmptyState icon="list" title={status === 404 ? 'Recibo não encontrado' : 'Recibo ainda não disponível'} description={status === 404 ? 'Ele não existe ou você não participa deste pagamento.' : 'O recibo aparece depois que o profissional confirma o recebimento.'} action={<Button to="/configuracoes/pagamentos">Ver pagamentos</Button>} />
          : <ErrorState title="Não foi possível carregar o recibo" message={apiError(resource.error)} onRetry={resource.retry} />}
      </main>
    );
  }

  const rows = [
    ['Serviço', receipt.service], ['Data do serviço', formatDay(receipt.serviceDate, { dateStyle: 'long' })], ['Cliente', receipt.client], ['Profissional', receipt.professional],
    ['Forma de pagamento', receipt.methodLabel], ['Situação', receipt.statusLabel], ['Confirmado em', when(receipt.confirmedAt)], ...(receipt.refundedAt ? [['Estornado em', when(receipt.refundedAt)]] : []),
  ];
  return (
    <main className="mx-auto max-w-form px-4 py-10 sm:px-6">
      <div className="print:hidden"><Breadcrumb items={crumbs} /></div>
      <Card as="article" className="space-y-6" aria-labelledby="receipt-title">
        <header className="border-b border-line pb-5">
          <p className="text-sm font-semibold text-primary-strong">Dommos</p>
          <h1 id="receipt-title" className="mt-1 text-2xl font-bold">Recibo de pagamento</h1>
          <p className="mt-1 text-sm text-ink-muted">Nº {receipt.number}</p>
        </header>
        <p className="text-3xl font-bold">{formatMoney(receipt.amount)}</p>
        <dl className="divide-y divide-line">
          {rows.map(([label, value]) => <div key={label} className="flex flex-wrap justify-between gap-2 py-3"><dt className="text-sm text-ink-muted">{label}</dt><dd className="text-sm font-medium">{value}</dd></div>)}
        </dl>
        <p className="rounded-control bg-surface-muted p-3 text-xs leading-5 text-ink-soft">{receipt.notice}</p>
        <div className="flex flex-wrap gap-3 print:hidden">
          <Button onClick={() => window.print()}>Imprimir ou salvar em PDF</Button>
          <Button variant="secondary" to={`/contratacoes/${receipt.orderUuid}`}>Voltar ao pedido</Button>
        </div>
      </Card>
    </main>
  );
}
