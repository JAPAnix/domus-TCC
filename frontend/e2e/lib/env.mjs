// Constantes e ajudas do ambiente de teste. NUNCA lê o .env do projeto: tudo que o teste usa vem daqui ou de variáveis E2E_*.
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const here = path.dirname(fileURLToPath(import.meta.url));
export const e2eDir = path.resolve(here, '..');
export const root = path.resolve(here, '../../..');
export const backendDir = path.join(root, 'backend');
export const frontendDir = path.join(root, 'frontend');

export const PORTS = { db: Number(process.env.E2E_DB_PORT ?? 3307), api: Number(process.env.E2E_API_PORT ?? 3100), web: Number(process.env.E2E_WEB_PORT ?? 5183), fakeAsaas: 3200 };
export const DB_NAME = process.env.E2E_DB ?? 'dommos_teste';
export const MYSQL_DIR = process.env.E2E_MYSQL_DIR ?? 'C:/xampp/mysql/bin';
export const API_URL = `http://localhost:${PORTS.api}/api`;
export const WEB_BASE = `http://localhost:${PORTS.web}`;
// Senha de todas as contas de teste.
export const PW = 'senha-forte-1';

/** URL (file://) de um arquivo do backend, para importar serviços direto nos testes. */
export const backendUrl = (relative) => new URL(relative, new URL(`file:///${backendDir.replace(/\\/g, '/')}/`)).href;

/** Roda SQL no banco de teste. Recusa qualquer banco que não seja o descartável local. */
export function sql(query, database = DB_NAME) {
  if (!/^dommos_(teste|e2e)/.test(database)) throw new Error(`Por segurança, o teste só usa bancos "dommos_teste*". Recebido: ${database}`);
  return execFileSync(`${MYSQL_DIR}/mysql.exe`, ['-h127.0.0.1', `-P${PORTS.db}`, '--default-character-set=utf8mb4', '-uroot', database, '-N', '-e', query]).toString().trim();
}
