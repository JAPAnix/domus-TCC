/** Limite simples em memória, por usuário (ou IP, sem login). Suficiente para uma única instância. */
export function rateLimit({ limit, windowMs, message = 'Muitas solicitações. Aguarde alguns minutos.', key = (req) => req.user?.uuid ?? req.ip }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    for (const [id, entry] of hits) if (entry.until <= now) hits.delete(id);
    const id = key(req);
    const entry = hits.get(id) ?? { count: 0, until: now + windowMs };
    entry.count += 1;
    hits.set(id, entry);
    if (entry.count > limit) {
      return res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000))).status(429).json({ message });
    }
    next();
  };
}

// Por IP (e por e-mail, quando há) para frear tentativas em sequência sem travar quem divide a mesma rede.
export const byIpAndEmail = (req) => `${req.ip}:${String(req.body?.email ?? '').toLowerCase().slice(0, 120)}`;
