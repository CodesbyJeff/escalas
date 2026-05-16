import { Router } from 'express';
import { ok } from '../utils/response.js';

export const router = Router();

router.get('/', (_req, res) => ok(res, 'API online.', { name: 'escalas', version: 'v1' }));
