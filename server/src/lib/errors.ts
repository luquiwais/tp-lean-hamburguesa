// Errores de aplicacion con status HTTP y un codigo estable que el front
// puede usar. El mensaje de un AppError SI se muestra al cliente, asi que
// nunca debe contener detalles internos (SQL, stack, etc.).
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const badRequest = (message = 'Solicitud invalida', details?: unknown) =>
  new AppError(400, 'BAD_REQUEST', message, details);

export const unauthorized = (message = 'No autenticado') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'No tenes permiso para esta accion') =>
  new AppError(403, 'FORBIDDEN', message);

export const notFound = (message = 'Recurso no encontrado') =>
  new AppError(404, 'NOT_FOUND', message);

export const conflict = (message = 'Conflicto con el estado actual') =>
  new AppError(409, 'CONFLICT', message);
