import { Router } from 'express';
import { healthController } from '../controllers/health.controller';

// Capa de routes: define endpoints y encadena middlewares (auth, validate,
// rateLimit) antes de delegar en el controller.
export const healthRouter = Router();

healthRouter.get('/', healthController.get);
