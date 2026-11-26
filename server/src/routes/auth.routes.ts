import { Router } from 'express';
import { loginSchema, registerSchema } from '@burger/shared';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';
import { authLimiter, refreshLimiter } from '../middlewares/rateLimit';
import { validate } from '../middlewares/validate';

export const authRouter = Router();

authRouter.post(
  '/register',
  authLimiter,
  validate({ body: registerSchema }),
  authController.register,
);
authRouter.post('/login', authLimiter, validate({ body: loginSchema }), authController.login);
authRouter.post('/refresh', refreshLimiter, authController.refresh);
authRouter.post('/logout', authController.logout);
authRouter.get('/me', authenticate, authController.me);
