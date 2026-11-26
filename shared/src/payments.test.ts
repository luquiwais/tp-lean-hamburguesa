import { describe, expect, it } from 'vitest';
import { detectCardBrand, isDeclinedTestCard, isExpiryValid, luhnCheck } from './payments';

describe('luhnCheck', () => {
  it('acepta tarjetas de prueba validas (con o sin espacios)', () => {
    expect(luhnCheck('4242 4242 4242 4242')).toBe(true);
    expect(luhnCheck('5555555555554444')).toBe(true);
    expect(luhnCheck('378282246310005')).toBe(true);
    expect(luhnCheck('4000000000000002')).toBe(true);
  });

  it('rechaza digito verificador incorrecto y largos invalidos', () => {
    expect(luhnCheck('4242424242424241')).toBe(false);
    expect(luhnCheck('424242')).toBe(false);
    expect(luhnCheck('4'.repeat(20))).toBe(false);
  });
});

describe('detectCardBrand', () => {
  it('detecta la marca por prefijo', () => {
    expect(detectCardBrand('4242424242424242')).toBe('visa');
    expect(detectCardBrand('5555555555554444')).toBe('mastercard');
    expect(detectCardBrand('2223003122003222')).toBe('mastercard');
    expect(detectCardBrand('378282246310005')).toBe('amex');
    expect(detectCardBrand('6011111111111117')).toBe('other');
  });
});

describe('isExpiryValid', () => {
  const now = new Date(2026, 10, 26); // 26/11/2026

  it('vale hasta el ultimo dia del mes', () => {
    expect(isExpiryValid(11, 26, now)).toBe(true);
    expect(isExpiryValid(12, 30, now)).toBe(true);
  });

  it('rechaza vencidas y meses invalidos', () => {
    expect(isExpiryValid(10, 26, now)).toBe(false);
    expect(isExpiryValid(13, 30, now)).toBe(false);
    expect(isExpiryValid(0, 30, now)).toBe(false);
  });
});

it('la tarjeta terminada en 0002 es la de rechazo simulado', () => {
  expect(isDeclinedTestCard('4000 0000 0000 0002')).toBe(true);
  expect(isDeclinedTestCard('4242424242424242')).toBe(false);
});
