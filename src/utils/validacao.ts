// Helpers de validação de entrada.

/** Retorna a string aparada se for texto não vazio com até `max` caracteres; senão null. */
export function texto(valor: unknown, max: number): string | null {
  if (typeof valor !== 'string') return null;
  const t = valor.trim();
  return t.length > 0 && t.length <= max ? t : null;
}

/** Lê e normaliza { key, hwid } de um corpo JSON. Keys são case-insensitive (guardadas em maiúsculas). */
export function lerKeyEHwid(corpo: unknown): { key: string; hwid: string } | null {
  if (typeof corpo !== 'object' || corpo === null) return null;
  const c = corpo as Record<string, unknown>;
  const key = texto(c.key, 128);
  const hwid = texto(c.hwid, 256);
  if (!key || !hwid) return null;
  return { key: key.toUpperCase(), hwid };
}

/** Lê e normaliza apenas { key } de um corpo JSON. */
export function lerKey(corpo: unknown): string | null {
  if (typeof corpo !== 'object' || corpo === null) return null;
  const key = texto((corpo as Record<string, unknown>).key, 128);
  return key ? key.toUpperCase() : null;
}
