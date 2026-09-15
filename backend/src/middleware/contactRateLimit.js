const requests = new Map();
export function contactRateLimit(req, res, next) {
  const now = Date.now();
  for (const [key, value] of requests) if (value.until <= now) requests.delete(key);
  const key = req.ip;
  const entry = requests.get(key) ?? { count: 0, until: now + 15 * 60000 };
  entry.count++;
  requests.set(key, entry);
  if (entry.count > 60) return res.set('Retry-After', String(Math.ceil((entry.until - now) / 1000))).status(429).json({ message: 'Muitas solicitações. Aguarde alguns minutos.' });
  next();
}
