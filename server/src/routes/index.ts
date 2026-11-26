import { Router } from 'express';
import { healthRouter } from './health.routes';

// Router raiz montado en /api. Cada dominio suma su router aca:
// /auth, /categories, /products, /orders, /coupons, /admin/*
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
