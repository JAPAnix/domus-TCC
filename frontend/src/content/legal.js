// Textos-base. Precisam de revisão jurídica antes de qualquer uso comercial.
export const LEGAL_NOTICE = 'Este é um texto-base, escrito para o projeto. Antes de publicar o serviço de verdade, ele precisa ser revisado por um profissional de direito.';

export const legalDocuments = {
  'termos-de-uso': {
    title: 'Termos de uso',
    updated: '5 de novembro de 2026',
    sections: [
      { h: '1. O que é o Dommos', p: ['O Dommos é uma plataforma que aproxima pessoas que precisam de um serviço (clientes) e pessoas que oferecem serviços (profissionais). O Dommos não presta os serviços anunciados e não é parte do contrato firmado entre cliente e profissional.'] },
      { h: '2. Conta', p: ['Para usar a maior parte dos recursos, é preciso criar uma conta com informações verdadeiras e mantê-las atualizadas. Você é responsável por manter a sua senha em segurança e por tudo o que acontece na sua conta.', 'Você pode desativar a conta temporariamente ou excluí-la, nas configurações da conta.'] },
      { h: '3. Clientes e profissionais', p: ['Clientes podem buscar anúncios, solicitar serviços e publicar pedidos. Profissionais podem criar anúncios, receber pedidos e enviar propostas. Uma mesma conta pode fazer as duas coisas.', 'O profissional é responsável pelo que anuncia: descrição, preço, disponibilidade e qualidade do trabalho. O cliente é responsável por fornecer informações corretas e por receber o profissional no combinado.'] },
      { h: '4. Pagamentos', p: ['Atualmente o pagamento não é processado pelo Dommos. O valor é combinado e pago diretamente entre cliente e profissional. O Dommos não retém, garante ou devolve valores.'] },
      { h: '5. Avaliações', p: ['Depois da conclusão de um serviço, cliente e profissional podem se avaliar. As avaliações devem ser verdadeiras e respeitosas, e podem ser removidas se violarem estes termos.'] },
      { h: '6. Conteúdo enviado por você', p: ['Você mantém os direitos sobre as fotos e textos que envia, e autoriza o Dommos a exibi-los na plataforma para o funcionamento do serviço. Você declara ter o direito de publicar esse conteúdo.'] },
      { h: '7. Condutas proibidas', p: ['É proibido anunciar serviços ilegais, publicar conteúdo ofensivo ou enganoso, tentar fraudar outros usuários, acessar contas alheias ou prejudicar o funcionamento da plataforma. Veja também as Regras da comunidade na Central de Ajuda.'] },
      { h: '8. Limitação de responsabilidade', p: ['O Dommos se esforça para manter a plataforma disponível e segura, mas não garante funcionamento ininterrupto nem o resultado dos serviços contratados entre as partes, nos limites permitidos pela lei.'] },
      { h: '9. Alterações e contato', p: ['Estes termos podem mudar. Quando houver mudanças relevantes, avisaremos na plataforma. Dúvidas podem ser enviadas pelo formulário “Falar com o suporte”, na Central de Ajuda.'] },
    ],
  },
  'politica-de-privacidade': {
    title: 'Política de privacidade',
    updated: '5 de novembro de 2026',
    sections: [
      { h: '1. Quais dados coletamos', p: ['Dados da conta (nome, e-mail, telefone, senha protegida e, se você informar, data de nascimento e endereço), dados de perfil (foto, apresentação, profissão e outros campos opcionais), dados de uso (pedidos, propostas, avaliações, favoritos, notificações) e dados técnicos de segurança, como o navegador e parte do endereço de rede das suas sessões.', 'Profissionais podem informar CPF ou CNPJ e uma chave Pix, que ficam protegidos e não aparecem no perfil público.'] },
      { h: '2. Para que usamos', p: ['Para criar e manter a sua conta, mostrar anúncios e perfis, permitir pedidos e avaliações, enviar avisos que você escolheu receber, proteger a plataforma contra abusos e atender pedidos de suporte.'] },
      { h: '3. Com quem compartilhamos', p: ['O perfil público mostra apenas o que você decidiu tornar visível, de acordo com as suas configurações de privacidade. Contratados por nós (como o provedor de e-mail e o de armazenamento de fotos) tratam dados apenas para prestar esses serviços. Não vendemos seus dados.'] },
      { h: '4. Seus direitos (LGPD)', p: ['Você pode confirmar a existência de tratamento, acessar e corrigir seus dados, baixar uma cópia em JSON ou CSV (Configurações da conta > Privacidade), pedir a exclusão da conta e se opor a usos que dependam de consentimento. Para outros pedidos, use o formulário de suporte.'] },
      { h: '5. Por quanto tempo guardamos', p: ['Mantemos os dados enquanto a conta existir. Ao excluir a conta, apagamos ou anonimizamos os dados pessoais. Avaliações e registros de serviços podem permanecer sem identificar você, para preservar o histórico de outras pessoas.'] },
      { h: '6. Cookies', p: ['Usamos cookies essenciais, necessários para manter você conectado. Cookies de análise e de marketing são opcionais; hoje não os utilizamos, e a sua escolha fica registrada em Privacidade.'] },
      { h: '7. Segurança', p: ['Aplicamos medidas como senhas protegidas, sessões que você pode encerrar a distância e acesso restrito a dados sensíveis. Nenhum sistema é totalmente imune a falhas; em caso de incidente relevante, avisaremos as pessoas afetadas, conforme a lei.'] },
      { h: '8. Contato', p: ['Dúvidas sobre privacidade podem ser enviadas pelo formulário “Falar com o suporte”, na Central de Ajuda.'] },
    ],
  },
  'politica-de-cancelamento': {
    title: 'Política de cancelamento',
    updated: '5 de novembro de 2026',
    sections: [
      { h: '1. Como funciona', p: ['Cada anúncio tem uma política de cancelamento escolhida pelo profissional. Ela indica até quando o cliente pode cancelar sem custo.'] },
      { h: '2. As três políticas', p: ['Flexível: sem custo até 24 horas antes da data combinada.', 'Moderada: sem custo até 72 horas antes da data combinada.', 'Rígida: sem custo até 7 dias antes da data combinada.'] },
      { h: '3. Quem pode cancelar', p: ['O cliente pode cancelar uma solicitação aguardando resposta, aceita ou em andamento. O profissional pode recusar um pedido novo e cancelar um pedido aceito ou em andamento. Depois de concluído ou cancelado, o pedido não muda mais.'] },
      { h: '4. Valores e reembolsos', p: ['Como o pagamento é feito diretamente entre as partes, qualquer compensação por cancelamento fora do prazo, ou devolução de valores, deve ser combinada entre cliente e profissional. O Dommos não intermedia reembolsos.'] },
      { h: '5. Problemas e contato', p: ['Se o combinado não for cumprido, registre um chamado em “Falar com o suporte”, com data, nomes e o que aconteceu. O Dommos guarda o seu relato.'] },
    ],
  },
};
