const required = [
  'DATABASE_HOST',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
  'JWT_SECRET',
  'FRONTEND_URL'
];

export const validateEnv = () => {
  const missing = required.filter(key => key === 'DATABASE_PASSWORD' && process.env.NODE_ENV !== 'production'
    ? process.env[key] === undefined : !process.env[key]?.trim());

  if (missing.length > 0) {
    console.error(`❌ Variáveis de ambiente faltando: ${missing.join(', ')}`);
    process.exit(1);
  }

  const frontend = new URL(process.env.FRONTEND_URL);
  if (!['http:', 'https:'].includes(frontend.protocol) || frontend.search || frontend.hash || frontend.username || frontend.password) throw new Error('FRONTEND_URL inválida.');
  if (process.env.NODE_ENV === 'production' && (frontend.protocol !== 'https:' || process.env.JWT_SECRET.length < 32)) {
    throw new Error('Produção exige FRONTEND_URL HTTPS e JWT_SECRET aleatório com pelo menos 32 caracteres.');
  }
  const port = Number(process.env.PORT || 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT inválida.');
  if (process.env.DATABASE_SSL && !['true', 'false'].includes(process.env.DATABASE_SSL)) throw new Error('DATABASE_SSL deve ser true ou false.');

  console.log('✅ Variáveis de ambiente carregadas');
};
