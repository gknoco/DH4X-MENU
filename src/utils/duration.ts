// Conversão entre expressões de duração ("1h", "7d", "lifetime") e segundos.

/** Durações oferecidas no gerador do painel. */
export const DURACOES_PADRAO = ['1h', '1d', '7d', '30d', '90d', '365d', 'lifetime'] as const;

export interface DuracaoParseada {
  label: string;    // forma normalizada (ex.: "7d")
  segundos: number; // 0 = lifetime
}

const REGEX_DURACAO = /^(\d{1,5})(h|d)$/;

/** Retorna null se a expressão for inválida. */
export function parseDuracao(entrada: unknown): DuracaoParseada | null {
  if (typeof entrada !== 'string') return null;
  const texto = entrada.trim().toLowerCase();

  if (texto === 'lifetime') return { label: 'lifetime', segundos: 0 };

  const m = REGEX_DURACAO.exec(texto);
  if (!m) return null;

  const valor = Number(m[1]);
  if (valor <= 0) return null;

  const segundos = valor * (m[2] === 'h' ? 3600 : 86400);
  return { label: `${valor}${m[2]}`, segundos };
}

/** Converte segundos em rótulo legível ("3d", "36h", "5400s"). 0 = lifetime. */
export function formatarDuracao(segundos: number): string {
  if (segundos === 0) return 'lifetime';
  if (segundos % 86400 === 0) return `${segundos / 86400}d`;
  if (segundos % 3600 === 0) return `${segundos / 3600}h`;
  return `${segundos}s`;
}
