// Rotas consumidas pelo APK. Montadas em /api/public.
import { Router } from 'express';
import { statusKey, validateKey } from '../controllers/keyController';

const router = Router();

router.post('/key/validate', validateKey); // valida e ATIVA no primeiro uso
router.post('/key/status', statusKey);     // heartbeat somente leitura

export default router;

