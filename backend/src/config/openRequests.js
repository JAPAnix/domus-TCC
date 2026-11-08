// Configuração do pedido aberto ("Publicar um pedido" do cliente e "Oportunidades" do profissional).
// Tudo pode ser mudado por variável de ambiente, sem mexer no código.

const int = (value, fallback, min, max) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
};

export function readOpenRequestConfig(env = process.env) {
  return {
    // Desligue com OPEN_REQUESTS_ENABLED=false: some das telas e as rotas respondem 404.
    enabled: String(env.OPEN_REQUESTS_ENABLED ?? 'true').toLowerCase() !== 'false',
    maxProposals: int(env.OPEN_REQUEST_MAX_PROPOSALS, 5, 1, 50),
    defaultDays: int(env.OPEN_REQUEST_DEFAULT_DAYS, 7, 1, 30),
    validityDays: [3, 7, 15, 30],
    maxPerDay: int(env.OPEN_REQUEST_MAX_PER_DAY, 5, 1, 50),
    maxActive: int(env.OPEN_REQUEST_MAX_ACTIVE, 10, 1, 100),
    digestHours: int(env.OPEN_REQUEST_DIGEST_HOURS, 6, 1, 72),
    proposalValidityHours: int(env.OPEN_REQUEST_PROPOSAL_VALIDITY_HOURS, 72, 1, 720),
    warnHours: 24,
  };
}

export const openRequestConfig = () => readOpenRequestConfig();

/** Bloqueia as rotas do pedido aberto quando a funcionalidade está desligada. */
export function requireOpenRequests(req, res, next) {
  if (!openRequestConfig().enabled) return res.status(404).json({ message: 'Os pedidos abertos estão desativados no momento.' });
  return next();
}
