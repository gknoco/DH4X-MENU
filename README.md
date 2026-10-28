# LN AUX API

API de autenticação e gestão de licenças (keys) com validação de HWID e painel administrativo web.
Node.js + TypeScript + Express + SQLite (better-sqlite3).

## Rodando

```bash
npm install
cp .env.example .env     # edite ADMIN_USER, ADMIN_PASS e JWT_SECRET
npm run dev              # desenvolvimento
# produção:
npm run build && NODE_ENV=production npm start
```

- Documentação: `http://localhost:3000/docs`
- Painel admin: `http://localhost:3000/admin`
- Health check: `http://localhost:3000/health`

> Em produção, `JWT_SECRET` (32+ caracteres) é obrigatório. Gere com:
> `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

## Rotas públicas (APK)

| Método | Rota | Função |
|---|---|---|
| POST | `/api/public/key/validate` | Valida e **ativa** a key no primeiro uso (grava HWID, `activated_at`, `expires_at`) |
| POST | `/api/public/key/status` | Heartbeat somente leitura (não ativa) |

Corpo: `{ "key": "...", "hwid": "..." }`. Erros: `{ "valid": false, "reason": "invalid_key | paused | expired | hwid_mismatch | not_activated | bad_request" }`.

## Rotas admin (JWT via `POST /api/admin/login`)

| Método | Rota | Corpo |
|---|---|---|
| POST | `/api/admin/login` | `{ user, pass }` |
| GET | `/api/admin/stats` | |
| GET | `/api/admin/keys?status=&search=&limit=&offset=` | |
| POST | `/api/admin/keys/generate` | `{ quantity (1-500), duration }` |
| POST | `/api/admin/key/reset-hwid` | `{ key }` |
| POST | `/api/admin/key/toggle-pause` | `{ key }` |
| POST | `/api/admin/key/extend` | `{ key, duration }` |
| POST | `/api/admin/key/delete` | `{ key }` |

Durações aceitas: `Nh`, `Nd` (ex.: `1h`, `7d`, `365d`) e `lifetime`.

## Decisões de implementação

- **Concorrência:** escritas críticas rodam em transação `IMMEDIATE`; duas ativações simultâneas da mesma key nunca passam juntas.
- **Lifetime:** `duration_seconds = 0`; `expires_at` e `seconds_left` retornam `null`.
- **Reset de HWID:** `hwid` vira `NULL`, o tempo não reinicia. Até o novo aparelho chamar `/validate`, `/status` responde `hwid_mismatch`.
- **Keys** são case-insensitive (normalizadas para maiúsculas) e geradas com `crypto.randomInt`.
- **Segurança:** rate limit por IP (público, login e admin), JWT de 12h, senha do admin comparada com bcrypt, HWID escapado no painel (anti-XSS).
- Atrás de proxy (Render, Railway, Cloudflare), defina `TRUST_PROXY=1`.
