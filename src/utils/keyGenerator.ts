// Gerador de keys no formato XXXXXX-XXXXXXXXXXXX--XXXXX (6-12--5, A-Z e 0-9).
import { randomInt } from 'crypto';

const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/** Gera `tamanho` caracteres com CSPRNG (crypto.randomInt, sem viés de módulo). */
function bloco(tamanho: number): string {
  let saida = '';
  for (let i = 0; i < tamanho; i++) {
    saida += ALFABETO[randomInt(ALFABETO.length)];
  }
  return saida;
}

/** Ex.: A0281N-IQM1B7SIB4K2P--U1M81 */
export function gerarKey(): string {
  return `${bloco(6)}-${bloco(12)}--${bloco(5)}`;
}
