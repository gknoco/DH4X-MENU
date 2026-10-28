// Limitadores de taxa por IP.
import rateLimit from 'express-rate-limit';

/** API pública (APK): 120 req/min por IP. O heartbeat (60s) fica bem abaixo disso. */
export const limitadorPublico = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ valid: false, reason: 'rate_limited' });
  },
});

/** Login do admin: 10 tentativas / 15 min por IP (barra força bruta). */
export const limitadorLogin = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ ok: false, reason: 'rate_limited' });
  },
});

/** Demais rotas administrativas: 300 req/min por IP. */
export const limitadorAdmin = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({ ok: false, reason: 'rate_limited' });
  },
});
