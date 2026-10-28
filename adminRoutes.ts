// Rotas do painel administrativo. Montadas em /api/admin.
import { Router } from 'express';
import { extendKey, stats } from '../controllers/adminController';
import { login } from '../controllers/authController';
import {
  deleteKey,
  generateKeys,
  listKeys,
  resetHwid,
  togglePauseKey,
} from '../controllers/keyController';
import { adminAuth } from '../middlewares/adminAuth';
import { limitadorAdmin, limitadorLogin } from '../middlewares/rateLimiter';

const router = Router();

// Única rota aberta: o login (com limite estrito de tentativas).
router.post('/login', limitadorLogin, login);

// Tudo abaixo exige JWT de administrador.
router.use(limitadorAdmin, adminAuth);

router.get('/stats', stats);
router.get('/keys', listKeys);
router.post('/keys/generate', generateKeys);
router.post('/key/reset-hwid', resetHwid);
router.post('/key/toggle-pause', togglePauseKey);
router.post('/key/extend', extendKey);
router.post('/key/delete', deleteKey);

export default router;
