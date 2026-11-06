const required = [
  'DATABASE_HOST',
  'DATABASE_USER',
  'DATABASE_PASSWORD',
  'DATABASE_NAME',
  'JWT_SECRET'
];

const storageRequired = {
  cloudinary: ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET']
};

export const validateEnv = () => {
  const provider = process.env.STORAGE_PROVIDER || 'local';
  if (!['local', 'cloudinary'].includes(provider)) {
    console.error(`❌ STORAGE_PROVIDER inválido: ${provider}`);
    process.exit(1);
  }
  const missing = [...required, ...(storageRequired[provider] ?? [])].filter(key => process.env[key] === undefined);

  if (missing.length > 0) {
    console.error(`❌ Variáveis de ambiente faltando: ${missing.join(', ')}`);
    process.exit(1);
  }

  console.log('✅ Variáveis de ambiente carregadas');
};