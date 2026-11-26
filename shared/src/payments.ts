// Validaciones de la tarjeta SIMULADA. Las usa el back para aceptar o
// rechazar el pago y el front para validar el formulario en vivo.
// Nunca se guarda el numero completo ni el CVV: solo marca y ultimos 4.

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'other';

export const onlyDigits = (value: string) => value.replace(/\D/g, '');

// Algoritmo de Luhn (digito verificador de las tarjetas).
export function luhnCheck(cardNumber: string): boolean {
  const digits = onlyDigits(cardNumber);
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}

export function detectCardBrand(cardNumber: string): CardBrand {
  const d = onlyDigits(cardNumber);
  if (/^4/.test(d)) return 'visa';
  if (/^(5[1-5]|2(2[2-9]|[3-6]\d|7[01]|720))/.test(d)) return 'mastercard';
  if (/^3[47]/.test(d)) return 'amex';
  return 'other';
}

export const cvvLength = (brand: CardBrand) => (brand === 'amex' ? 4 : 3);

// Vencimiento MM/AA: valido hasta el ultimo dia del mes indicado.
export function isExpiryValid(month: number, year2: number, now = new Date()): boolean {
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  const year = 2000 + year2;
  const endOfMonth = new Date(year, month, 1); // primer dia del mes siguiente
  return endOfMonth.getTime() > now.getTime();
}

// Tarjetas que el pago simulado RECHAZA a proposito, para mostrar el
// manejo de errores (ej: 4000 0000 0000 0002).
export const isDeclinedTestCard = (cardNumber: string) => onlyDigits(cardNumber).endsWith('0002');
