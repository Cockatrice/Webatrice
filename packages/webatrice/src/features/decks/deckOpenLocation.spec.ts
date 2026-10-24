import { deckOpenLocation, resolveDeckOpenChoice } from './deckOpenLocation';

describe('deckOpenLocation', () => {
  it.each([
    [true, false, false, 'new-tab'],
    [true, true, false, 'new-tab'],
    [true, false, true, 'same-tab'],
    [false, false, false, 'same-tab'],
    [false, false, true, 'same-tab'],
    [false, true, false, 'prompt'],
  ] as const)('option %s, modified %s, blank %s → %s', (openDeckInNewTab, isModified, isBlank, expected) => {
    expect(deckOpenLocation({ openDeckInNewTab, isModified, isBlank })).toBe(expected);
  });
});

describe('resolveDeckOpenChoice', () => {
  it('opens in the same tab once the save succeeds', async () => {
    await expect(resolveDeckOpenChoice('save', async () => true)).resolves.toBe('same-tab');
  });

  it('cancels when the save fails', async () => {
    await expect(resolveDeckOpenChoice('save', async () => false)).resolves.toBe('cancelled');
  });

  it.each([
    ['discard', 'same-tab'],
    ['new-tab', 'new-tab'],
    ['cancel', 'cancelled'],
  ] as const)('%s → %s without saving', async (choice, expected) => {
    const saveNow = vi.fn(async () => true);
    await expect(resolveDeckOpenChoice(choice, saveNow)).resolves.toBe(expected);
    expect(saveNow).not.toHaveBeenCalled();
  });
});
