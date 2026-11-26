import { z } from 'zod';

// Formato de error que devuelve SIEMPRE la API (ver server/src/middlewares/errorHandler.ts).
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
  traceId: z.string().optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
