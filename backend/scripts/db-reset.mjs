import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

function databaseTarget() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const parsed = new URL(url);
    return { host: parsed.hostname, database: decodeURIComponent(parsed.pathname.replace(/^\//, '')) || process.env.DATABASE_NAME };
  }
  return { host: process.env.DATABASE_HOST, database: process.env.DATABASE_NAME };
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('exit', (code) => code === 0 ? resolve() : reject(new Error(`${command} terminou com código ${code}.`)));
  });
}

const target = databaseTarget();
if (!target.host || !target.database) {
  console.error('DATABASE_URL ou DATABASE_HOST/DATABASE_NAME não foram configurados. Nada foi apagado.');
  process.exit(1);
}

console.log(`Banco que será APAGADO: host=${target.host}; banco=${target.database}`);
console.log('A operação é irreversível: remove todos os dados, inclusive administradores e contas existentes.');
const isProductionHost = /render\.com|railway\.app|amazonaws\.com|planetscale|aivencloud|tidbcloud|hostinger|hstgr\.io|production|prod/i.test(target.host);
const yes = process.argv.includes('--yes');
const productionYes = process.argv.includes('--yes-production');
const rl = createInterface({ input: stdin, output: stdout });

try {
  if (!yes) {
    const answer = await rl.question(`Digite exatamente o nome do banco (${target.database}) para confirmar: `);
    if (answer.trim() !== target.database) throw new Error('Confirmação não corresponde ao nome do banco. Nada foi apagado.');
  }
  if (isProductionHost) {
    console.warn('\nATENÇÃO: o host parece ser de produção. A exclusão é irreversível.');
    if (!productionYes) {
      const answer = await rl.question('Digite APAGAR PRODUCAO (sem acento) para a segunda confirmação: ');
      const normalized = answer.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
      if (normalized !== 'APAGAR PRODUCAO') throw new Error('Segunda confirmação não recebida. Nada foi apagado.');
    }
  }
  await run(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'reset', '--force']);
  await run(process.execPath, ['--env-file-if-exists=.env', 'prisma/seed.js']);
  console.log('Reset e seed de demonstração concluídos.');
} catch (error) {
  console.error(`Reset interrompido: ${error.message}`);
  if (/AI|agent|migrate reset/i.test(error.message)) console.error('Se o Prisma bloqueou o reset por estar sendo executado por um agente, execute este comando manualmente no seu terminal após conferir o destino.');
  process.exitCode = 1;
} finally {
  rl.close();
}
