import { z } from 'zod';

// Contrato de GET /api/health. Lo usa el server para tipar la respuesta
// y el client para validarla al recibirla.
export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.string(),
  database: z.enum(['ok', 'error']),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.string(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
