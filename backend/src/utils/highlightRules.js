// Critérios dos selos de destaque do profissional. Um lugar só: mude aqui e vale para o site inteiro.

export const HIGHLIGHT_CRITERIA = {
  // "Mais bem avaliado": nota alta com avaliações suficientes para a nota ser confiável.
  top_rated: { minRating: 4.8, minReviews: 5 },
  // "Superprofissional": nota alta, muitas avaliações e boa resposta às conversas.
  superpro: { minRating: 4.7, minReviews: 10, minResponseRate: 0.9, minConversations: 5 },
};

export const HIGHLIGHT_LABELS = {
  superpro: { label: 'Superprofissional', text: 'Profissional com nota alta, muitas avaliações e resposta rápida às conversas.' },
  top_rated: { label: 'Mais bem avaliado', text: 'Profissional com nota alta e várias avaliações de clientes reais.' },
};

/** Qual selo o profissional merece agora: 'superpro', 'top_rated' ou null. */
export function highlightFor({ rating = 0, reviews = 0, responseRate = null, conversations = 0 }) {
  const s = HIGHLIGHT_CRITERIA.superpro;
  if (rating >= s.minRating && reviews >= s.minReviews && conversations >= s.minConversations && responseRate != null && responseRate >= s.minResponseRate) return 'superpro';
  const t = HIGHLIGHT_CRITERIA.top_rated;
  if (rating >= t.minRating && reviews >= t.minReviews) return 'top_rated';
  return null;
}
