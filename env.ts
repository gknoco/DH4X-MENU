// Carrega e valida as variáveis de ambiente uma única vez no startup.
import dotenv from 'dotenv';
import crypto from 'crypto';
import path from 'path';

dotenv.config();

const emProducao = process.env.NODE_ENV === 'production';

/** Lê uma variável obrigatória; aborta o startup se estiver ausente. */
function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor || !valor.trim()) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${nome}`);
  }
  return valor;
}

// JWT_SECRET: em produção é obrigatório (>= 32 chars). Em dev, gera um temporário.
let jwtSecret = process.env.JWT_SECRET ?? '';
if (jwtSecret.length < 32) {
  if (emProducao) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres em produção.');
  }
  jwtSecret = crypto.randomBytes(48).toString('hex');
  console.warn('[env] JWT_SECRET ausente/curto: usando segredo temporário (sessões caem ao reiniciar).');
}

const porta = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(porta) || porta < 1 || porta > 65535) {
  throw new Error('PORT inválida.');
}

export const env = {
  port: porta,
  emProducao,
  adminUser: obrigatoria('ADMIN_USER'),
  adminPass: obrigatoria('ADMIN_PASS'),
  jwtSecret,
  dbPath: path.resolve(process.env.DB_PATH ?? './data/ln-aux.db'),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  trustProxy: Number(process.env.TRUST_PROXY ?? 0),
};
