import { expect, it } from 'vitest';
import { slugify } from './slug';

it('genera slugs validos desde nombres con tildes y simbolos', () => {
  expect(slugify('Bacon Crispy')).toBe('bacon-crispy');
  expect(slugify('  Ñandú  & Papas!! ')).toBe('nandu-papas');
  expect(slugify('Milkshake de dulce de leche')).toBe('milkshake-de-dulce-de-leche');
});
