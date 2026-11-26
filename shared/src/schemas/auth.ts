import { z } from 'zod';

// =====================================================================
// Contratos de auth (/api/auth/*)
// =====================================================================

export const ROLES = ['customer', 'admin'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email('Email invalido'));

// bcrypt solo usa los primeros 72 bytes: se limita para que no haya
// contrasenas "distintas" que en la practica sean iguales.
export const passwordSchema = z
  .string()
  .min(8, 'La contrasena debe tener al menos 8 caracteres')
  .max(72, 'La contrasena puede tener hasta 72 caracteres');

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{6,20}$/, 'Telefono invalido');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(1, 'Ingresa tu nombre').max(80),
  phone: phoneSchema.optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Ingresa tu contrasena').max(72),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  role: roleSchema,
});
export type AuthUser = z.infer<typeof authUserSchema>;

// Respuesta de register / login / refresh. El refresh token NO viaja en el
// body: va en una cookie httpOnly que el navegador maneja solo.
export const authResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().positive(), // segundos
  user: authUserSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;
