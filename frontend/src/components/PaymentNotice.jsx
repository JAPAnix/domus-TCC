/** Aviso fixo das telas de pagamento: modo gratuito e cuidados contra golpes. */
export default function PaymentNotice({ compact = false, platform = false }) {
  if (platform) {
    return (
      <div className="space-y-3 rounded-control border border-info-line bg-info-soft p-4 text-sm leading-6 text-ink-soft" role="note">
        <p><strong className="text-ink">Pagamento protegido pelo Dommos.</strong> Você paga pelo Dommos (Pix, cartão ou boleto, processado pelo Asaas) e o valor só é repassado ao profissional depois que você confirma o serviço.</p>
        {!compact && (
          <ul className="list-disc space-y-1 pl-5">
            <li>Pague só pelo pedido no Dommos. Desconfie de quem pedir pagamento por fora, link estranho ou transferência para outra pessoa.</li>
            <li>Se o serviço não foi feito como combinado, abra uma reclamação antes de confirmar.</li>
            <li>O Dommos nunca recebe nem guarda dados de cartão.</li>
          </ul>
        )}
      </div>
    );
  }
  return (
    <div className="space-y-3 rounded-control border border-info-line bg-info-soft p-4 text-sm leading-6 text-ink-soft" role="note">
      <p><strong className="text-ink">Dommos em modo gratuito.</strong> O Dommos não recebe nem guarda o seu dinheiro: o pagamento é combinado direto entre cliente e profissional (Pix, dinheiro ou cartão presencial).</p>
      {!compact && (
        <ul className="list-disc space-y-1 pl-5">
          <li>Pague só pelas formas mostradas no pedido e confira o nome do recebedor antes de confirmar o Pix.</li>
          <li>Desconfie de quem pede pagamento adiantado fora do pedido, link estranho ou transferência para outra pessoa.</li>
          <li>Confira o perfil, as avaliações e o anúncio antes de contratar.</li>
          <li>Guarde o comprovante. O recibo do Dommos fica disponível depois que o profissional confirma o recebimento.</li>
        </ul>
      )}
    </div>
  );
}
