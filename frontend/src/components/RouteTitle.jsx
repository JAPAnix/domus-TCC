import { useLocation } from 'react-router-dom';
import { useDocumentMeta } from '../hooks/useDocumentMeta';

// Títulos das páginas de conteúdo fixo, da regra mais específica para a mais geral.
// Páginas com dados próprios (anúncio, perfil, artigo) definem o título delas com useDocumentMeta.
const TITLES = [
  [/^\/$/, 'Encontre profissionais e contrate serviços'],
  [/^\/servicos$/, 'Pedidos abertos'], [/^\/servicos\/novo$/, 'Publicar um pedido'], [/^\/servicos\/[^/]+\/propostas$/, 'Propostas recebidas'],
  [/^\/servicos\/[^/]+\/enviar-proposta$/, 'Enviar proposta'], [/^\/servicos\/[^/]+\/avaliar$/, 'Avaliar'],
  [/^\/buscar$/, 'Buscar serviços'],
  [/^\/ajuda$/, 'Central de Ajuda'], [/^\/ajuda\/categoria\//, 'Central de Ajuda'], [/^\/ajuda\/contato$/, 'Fale com a gente'],
  [/^\/termos-de-uso$/, 'Termos de uso'], [/^\/politica-de-privacidade$/, 'Política de privacidade'], [/^\/politica-de-cancelamento$/, 'Política de cancelamento'],
  [/^\/login$/, 'Entrar'], [/^\/cadastro$/, 'Criar conta'], [/^\/forgot-password$/, 'Recuperar senha'], [/^\/reset-password$/, 'Criar nova senha'], [/^\/sair$/, 'Saindo'],
  [/^\/favoritos$/, 'Favoritos'], [/^\/favoritos\//, 'Lista de favoritos'],
  [/^\/mensagens\/respostas-rapidas$/, 'Respostas rápidas'], [/^\/mensagens/, 'Mensagens'],
  [/^\/notificacoes$/, 'Notificações'],
  [/^\/meus-servicos$/, 'Pedidos e contratações'], [/^\/contratacoes\/[^/]+\/avaliar$/, 'Avaliar serviço'], [/^\/contratacoes\//, 'Pedido'], [/^\/pagamentos\/[^/]+\/recibo$/, 'Recibo de pagamento'],
  [/^\/perfil\/editar$/, 'Editar perfil'], [/^\/perfil\/avaliacoes/, 'Avaliações'], [/^\/perfil/, 'Perfil'], [/^\/bem-vindo$/, 'Bem-vindo'],
  [/^\/admin\/pagamentos$/, 'Administração de pagamentos'], [/^\/admin\/ajuda$/, 'Assistente de ajuda'], [/^\/admin\/moderacao$/, 'Moderação'], [/^\/pro\/oportunidades$/, 'Oportunidades'], [/^\/pro\/oportunidades\/[^/]+$/, 'Oportunidade'], [/^\/configuracoes\/pagamentos$/, 'Pagamentos'], [/^\/configuracoes\/impostos$/, 'Impostos'], [/^\/configuracoes\/notificacoes$/, 'Notificações da conta'],
  [/^\/configuracoes\/privacidade$/, 'Privacidade'], [/^\/configuracoes\/seguranca$/, 'Login e segurança'], [/^\/configuracoes\/idioma$/, 'Idioma e tradução'], [/^\/configuracoes/, 'Configurações da conta'],
  [/^\/pro\/comecar$/, 'Comece a oferecer serviços'], [/^\/pro\/anuncio\//, 'Seu anúncio'], [/^\/pro\/pedidos$/, 'Pedidos e agenda'], [/^\/pro\/servicos$/, 'Meus serviços'], [/^\/pro\/ganhos$/, 'Ganhos'], [/^\/pro/, 'Painel profissional'],
];
// Rotas cujo título vem da própria página (dados carregados da API).
const OWN_TITLE = [/^\/anuncios\//, /^\/usuarios\//, /^\/ajuda\/artigo\//, /^\/servicos\/[^/]+$/];

export default function RouteTitle() {
  const { pathname } = useLocation();
  const own = OWN_TITLE.some((pattern) => pattern.test(pathname)) && !/^\/servicos\/(novo)$/.test(pathname);
  const found = TITLES.find(([pattern]) => pattern.test(pathname));
  useDocumentMeta({ title: own ? '' : found ? found[1] : 'Página não encontrada' });
  return null;
}
