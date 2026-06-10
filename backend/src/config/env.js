const required = [
  'DATABASE_HOST',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
  'JWT_SECRET'
];

export const validateEnv = () => {
  const missing = required.filter(key => process.env[key] === undefined);

  if (missing.length > 0) {
    console.error(`❌ Variáveis de ambiente faltando: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('✅ Variáveis de ambiente carregadas');
};