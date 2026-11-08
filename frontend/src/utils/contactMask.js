/*
 * Esconde formas de contato (telefone, e-mail, links e redes sociais) em textos de pedidos abertos, para as pessoas
 * combinarem tudo pela plataforma. Este arquivo é idêntico no backend e no frontend (um teste confere).
 */
const PLACEHOLDER = '[contato removido]';

const PATTERNS = [
  /[\w.+-]+@[\w-]+(\.[\w-]+)+/g,                                   // e-mail
  /\b(?:https?:\/\/|www\.)\S+/gi,                                  // links
  /\b[a-z0-9-]+\.(?:com|net|org|io|me|app|link|bio|gg|tv|co)(?:\.br)?(?:\/\S*)?\b/gi, // endereços soltos (site.com.br)
  /(?:\d[\s.()/-]*){8,}/g,                                        // telefone, CPF, cartão: 8 ou mais números
  /@[a-z0-9_.]{3,}/gi,                                             // @usuario de rede social
  /\b(?:insta(?:gram)?|face(?:book)?|whats(?:app)?|zap|telegram|tiktok|twitter|linkedin)\b\s*[:-]?\s*@?[a-z0-9_.]{3,}/gi, // "instagram fulano"
];

/** Devolve o texto sem os contatos e se algo foi escondido. */
export function maskContacts(text) {
  let masked = false;
  let result = String(text ?? '');
  for (const pattern of PATTERNS) {
    result = result.replace(pattern, () => { masked = true; return PLACEHOLDER; });
  }
  // Vários avisos seguidos viram um só.
  result = result.replace(/(?:\[contato removido\][\s,;]*){2,}/g, `${PLACEHOLDER} `).trim();
  return { text: result, masked };
}
