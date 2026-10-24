import { cardOverride } from './cardOverrides';

it('uses exact card names without inherited properties or normalization', () => {
  const overrides = { ' Lightning Bolt ': 'spaces', Bolt: 'upper', bolt: 'lower' };

  expect(cardOverride(overrides, 'Lightning Bolt')).toBeUndefined();
  expect(cardOverride(overrides, ' Lightning Bolt ')).toBe('spaces');
  expect(cardOverride(overrides, 'Bolt')).toBe('upper');
  expect(cardOverride(overrides, 'bolt')).toBe('lower');
  expect(cardOverride({}, 'constructor')).toBeUndefined();
  expect(cardOverride({ ['__proto__']: 'printing' }, '__proto__')).toBe('printing');
});
