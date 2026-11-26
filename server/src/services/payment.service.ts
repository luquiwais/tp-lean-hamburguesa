import {
  cvvLength,
  detectCardBrand,
  isDeclinedTestCard,
  isExpiryValid,
  luhnCheck,
  onlyDigits,
  type CardBrand,
  type PaymentInput,
} from '@burger/shared';
import { AppError, badRequest } from '../lib/errors';
import { formatARS } from '../lib/format';

export interface PaymentResult {
  method: 'cash' | 'card';
  brand: CardBrand | null;
  last4: string | null;
  cashAmount: number | null;
}

// Pago SIMULADO: no hay pasarela real. Valida la tarjeta como lo haria un
// procesador y devuelve solo lo que se puede guardar (marca + ultimos 4).
// El numero completo y el CVV mueren aca: no se loguean ni se persisten.
export const paymentService = {
  process(payment: PaymentInput, total: number): PaymentResult {
    if (payment.method === 'cash') {
      if (payment.cashAmount !== undefined && payment.cashAmount < total) {
        throw badRequest(`El efectivo no alcanza: el total es ${formatARS(total)}`);
      }
      return { method: 'cash', brand: null, last4: null, cashAmount: payment.cashAmount ?? null };
    }

    const digits = onlyDigits(payment.cardNumber);
    if (!luhnCheck(digits)) throw badRequest('El numero de tarjeta no es valido');

    const brand = detectCardBrand(digits);
    if (payment.cvv.length !== cvvLength(brand)) {
      throw badRequest('El codigo de seguridad no es valido');
    }
    if (!isExpiryValid(payment.expMonth, payment.expYear)) {
      throw badRequest('La tarjeta esta vencida');
    }

    if (isDeclinedTestCard(digits)) {
      throw new AppError(402, 'PAYMENT_DECLINED', 'El pago fue rechazado. Proba con otra tarjeta.');
    }

    return { method: 'card', brand, last4: digits.slice(-4), cashAmount: null };
  },
};
