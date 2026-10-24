import {
  annotationPrompt,
  cardCounterPrompt,
  expressionPrompt,
  libraryCountPrompt,
  moveXFromTopPrompt,
  powerToughnessPrompt,
  tokenCountPrompt,
} from './seatPrompts';
import { catalogT } from '../../__test-utils__/catalogT';
import editTokens from '../../../../feature-widgets/card-import/EditTokens.i18n.json';
import moveTopUntil from '../../dialogs/MoveTopUntilDialog/MoveTopUntilDialog.i18n.json';
import gamePrompt from './GamePrompt.i18n.json';
import menus from '../../components/context-menus/menus.i18n.json';

const t = catalogT(gamePrompt, editTokens, moveTopUntil, menus);

describe('expressionPrompt', () => {
  it('seeds the current value and submits the evaluated sum', () => {
    const onSubmit = vi.fn();
    const prompt = expressionPrompt(t, { current: 20, onSubmit });

    expect(prompt).toMatchObject({ title: 'Set life total', label: 'Life total', initialValue: '20', submitLabel: 'Save' });
    prompt.onSubmit('20+5*2');
    expect(onSubmit).toHaveBeenCalledWith(30);
  });

  it('previews arithmetic but not a plain number, and rejects what does not evaluate', () => {
    const prompt = expressionPrompt(t, { current: 40, onSubmit: vi.fn() });

    expect(prompt.preview?.('40+10')).toBe('= 50');
    expect(prompt.preview?.('40')).toBeNull();
    expect(prompt.preview?.('40+')).toBeNull();
    expect(prompt.validate?.('-3')).toBeNull();
    expect(prompt.validate?.('abc')).toBe('Enter a number or a sum like 40+10');
    expect(prompt.validate?.('')).toBe('Enter a number or a sum like 40+10');
  });

  it('takes a counter title, label and description', () => {
    const prompt = expressionPrompt(t, {
      current: 2,
      onSubmit: vi.fn(),
      title: 'Set white counter',
      label: 'White',
      description: 'Current: 2',
    });
    expect(prompt).toMatchObject({ title: 'Set white counter', label: 'White', description: 'Current: 2' });
  });
});

describe('card text prompts', () => {
  it('prefills P/T and annotation with the card name as the description, blank allowed', () => {
    const onSubmit = vi.fn();
    const pt = powerToughnessPrompt(t, { cardName: 'Bear', current: '2/2', onSubmit });
    const note = annotationPrompt(t, { cardName: 'Bear', current: '', onSubmit });

    expect(pt).toMatchObject({
      title: 'Change power/toughness',
      label: 'Change stats to',
      description: 'Bear',
      initialValue: '2/2',
    });
    expect(note).toMatchObject({
      title: 'Set annotation',
      label: 'Please enter the new annotation',
      description: 'Bear',
      placeholder: 'Leave blank to clear',
    });
    expect(pt.validate).toBeUndefined();
    note.onSubmit('');
    expect(onSubmit).toHaveBeenCalledWith('');
  });
});

describe('cardCounterPrompt', () => {
  it('accepts 0 or more and submits the number', () => {
    const onSubmit = vi.fn();
    const prompt = cardCounterPrompt(t, { cardName: 'Bear', counterLetter: 'B', current: 3, onSubmit });

    expect(prompt).toMatchObject({ title: 'Set counter B', initialValue: '3', submitLabel: 'Set' });
    expect(prompt.validate?.('0')).toBeNull();
    expect(prompt.validate?.('-1')).toBe('Enter 0 or more');
    expect(prompt.validate?.('x')).toBe('Enter 0 or more');
    prompt.onSubmit('7');
    expect(onSubmit).toHaveBeenCalledWith(7);
  });
});

describe('libraryCountPrompt', () => {
  it('requires 1 or more and clamps to the library', () => {
    const onSubmit = vi.fn();
    const prompt = libraryCountPrompt(t, { title: 'Draw cards', submitLabel: 'Draw', deckSize: 5, initial: 1, onSubmit });

    expect(prompt).toMatchObject({ description: 'Library size: 5', initialValue: '1', submitLabel: 'Draw' });
    expect(prompt.validate?.('0')).toBe('Enter 1 or more');
    expect(prompt.validate?.('9')).toBeNull();
    prompt.onSubmit('9');
    expect(onSubmit).toHaveBeenCalledWith(5);
  });

  it('refuses any count when the library is empty', () => {
    const prompt = libraryCountPrompt(t, { title: 'T', submitLabel: 'View', deckSize: 0, initial: 1, onSubmit: vi.fn() });
    expect(prompt.validate?.('1')).toBe('The library is empty');
  });
});

describe('moveXFromTopPrompt', () => {
  it('displays one-based positions and submits the zero-based protocol position', () => {
    const onSubmit = vi.fn();
    const prompt = moveXFromTopPrompt(t, { cardName: 'Bear', deckSize: 4, initial: 3, onSubmit });

    expect(prompt).toMatchObject({
      title: 'Place card X cards from top of library',
      label: 'Place at position (1 = top, 5 = bottom)',
      initialValue: '4',
      submitLabel: 'Move',
    });
    expect(prompt.validate?.('1')).toBeNull();
    expect(prompt.validate?.('0')).toBe('Enter 1 or more');
    prompt.onSubmit('1');
    expect(onSubmit).toHaveBeenLastCalledWith(0);
    prompt.onSubmit('5');
    expect(onSubmit).toHaveBeenLastCalledWith(4);
    prompt.onSubmit('10');
    expect(onSubmit).toHaveBeenLastCalledWith(4);
  });
});

describe('tokenCountPrompt', () => {
  it('takes 1 to 99, seeded with the default count', () => {
    const onSubmit = vi.fn();
    const prompt = tokenCountPrompt(t, { tokenName: 'Treasure', initial: 3, onSubmit });

    expect(prompt).toMatchObject({ title: 'Create tokens', description: 'Treasure', initialValue: '3' });
    expect(['0', '1', '99', '100', 'x'].map((v) => prompt.validate?.(v))).toEqual([
      'Enter 1 to 99', null, null, 'Enter 1 to 99', 'Enter 1 to 99',
    ]);
    prompt.onSubmit('5');
    expect(onSubmit).toHaveBeenCalledWith(5);
  });

  it('uses the current translator for all token prompt text', () => {
    const translate = vi.fn(t);
    const prompt = tokenCountPrompt(translate, { tokenName: 'Treasure', initial: 1, onSubmit: vi.fn() });
    prompt.validate?.('100');
    expect(translate).toHaveBeenCalledWith('GamePrompt.token.title');
    expect(translate).toHaveBeenCalledWith('GamePrompt.token.label');
    expect(translate).toHaveBeenCalledWith('GamePrompt.token.create');
    expect(translate).toHaveBeenCalledWith('GamePrompt.token.invalid', { max: 99 });
  });
});
