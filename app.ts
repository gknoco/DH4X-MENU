// Servidor principal da LN AUX API.
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import path from 'path';
import { fecharDatabase, initDatabase } from './config/database';
import { env } from './config/env';
import { rotaNaoEncontrada, tratarErros } from './middlewares/errorHandler';
import { limitadorPublico } from './middlewares/rateLimiter';
import adminRoutes from './routes/adminRoutes';
import publicRoutes from './routes/publicRoutes';

const app = express();
const PUBLIC_DIR = path.resolve(__dirname, '../public');

app.disable('x-powered-by');
if (env.trustProxy > 0) app.set('trust proxy', env.trustProxy);

// Cabeçalhos de segurança básicos.
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

app.use(
  cors({
    origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((o) => o.trim()),
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);
app.use(express.json({ limit: '10kb' }));

// ----------------------------- Páginas -------------------------------------
// CSP das páginas HTML (scripts/estilos inline próprios + fontes do Google).
const CSP =
  "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'";

function servirPagina(arquivo: string) {
  return (_req: Request, res: Response): void => {
    res.setHeader('Content-Security-Policy', CSP);
    res.sendFile(path.join(PUBLIC_DIR, arquivo));
  };
}

app.get('/', (_req, res) => res.redirect('/docs'));
app.get(['/docs', '/docs/'], servirPagina('docs/index.html'));
app.get(['/admin', '/admin/'], servirPagina('admin/index.html'));
app.get('/health', (_req, res) => res.json({ ok: true, uptime: process.uptime() }));

// ------------------------------- API ---------------------------------------
app.use('/api/public', limitadorPublico, publicRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api', rotaNaoEncontrada);

app.use(tratarErros);

// ------------------------------ Startup ------------------------------------
initDatabase();

const servidor = app.listen(env.port, () => {
  console.log(`LN AUX API rodando na porta ${env.port}  ->  /docs  e  /admin`);
});

function encerrar(sinal: string): void {
  console.log(`\n${sinal} recebido, encerrando...`);
  servidor.close(() => {
    fecharDatabase();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref(); // força saída se algo travar
}
process.on('SIGINT', () => encerrar('SIGINT'));
process.on('SIGTERM', () => encerrar('SIGTERM'));

export default app;
