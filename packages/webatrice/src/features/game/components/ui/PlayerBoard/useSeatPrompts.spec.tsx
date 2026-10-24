import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { ZoneName } from '@cockatrice/sockatrice';

import editTokens from '../../../../../feature-widgets/card-import/EditTokens.i18n.json';
import { catalogT } from '../../../__test-utils__/catalogT';
import menus from '../../context-menus/menus.i18n.json';
import moveTopUntil from '../../../dialogs/MoveTopUntilDialog/MoveTopUntilDialog.i18n.json';
import { NOOP_GAME_DIALOGS_ACTIONS, type GameDialogs, type PromptState } from '../../../hooks/dialogs/gameDialogs.types';
import gamePrompt from '../../../hooks/dialogs/GamePrompt.i18n.json';
import { GameDialogsProvider } from '../GameDialogsContext';
import type {
  BattlefieldCardViewModel,
  PlayerCardCommands,
  PlayerCounterCommands,
  PlayerZoneCommands,
} from './playerBoard.types';
import { useSeatPrompts, type LifeControl, type UseSeatPromptsArgs } from './useSeatPrompts';
import type { SeatCardMeta } from './useSeatCardMetadata';

const t = catalogT(gamePrompt, editTokens, menus, moveTopUntil);

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t }) }));

const bf = (id: number, name: string, pt?: string): BattlefieldCardViewModel => ({
  id: String(id),
  name,
  scryfallId: '',
  slot: { row: 0, col: 0 },
  subSlot: 0,
  tapped: false,
  pt,
});

function setup(args: Partial<UseSeatPromptsArgs> = {}) {
  const dialogs = {
    ...NOOP_GAME_DIALOGS_ACTIONS,
    openPrompt: vi.fn(),
    openZoneView: vi.fn(),
    openCreateToken: vi.fn(),
  };
  const zoneCommands = { reveal: vi.fn(), moveCards: vi.fn() } as unknown as PlayerZoneCommands;
  const cardCommands = { setAnnotation: vi.fn(), setPT: vi.fn(), createToken: vi.fn() } as unknown as PlayerCardCommands;
  const counterCommands = { set: vi.fn(), setCardCounters: vi.fn() } as unknown as PlayerCounterCommands;
  const draw = vi.fn();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <GameDialogsProvider value={dialogs as unknown as GameDialogs}>{children}</GameDialogsProvider>
  );
  const { result, rerender } = renderHook(() => useSeatPrompts({
    seatId: 1,
    lifeControl: undefined,
    battlefieldCards: [],
    cardMetaByName: new Map(),
    draw,
    zoneCommands,
    cardCommands,
    counterCommands,
    ...args,
  }), { wrapper });
  const answer = (value: string) => {
    const prompt = vi.mocked(dialogs.openPrompt).mock.calls.at(-1)![0] as PromptState;
    act(() => prompt.onSubmit(value));
    return prompt;
  };
  return { result, rerender, dialogs, zoneCommands, cardCommands, counterCommands, draw, answer };
}

describe('useSeatPrompts', () => {
  it('keeps the card-op prompt openers across renders, so the seat\'s card ops stay memoised', () => {
    const { result, rerender } = setup();
    const pick = () => {
      const { openAnnotationPrompt, openPTPrompt, openCardCounterPrompt, openMoveXFromTopPrompt, openTokenCountPrompt } = result.current;
      return [openAnnotationPrompt, openPTPrompt, openCardCounterPrompt, openMoveXFromTopPrompt, openTokenCountPrompt];
    };
    const before = pick();
    rerender();
    pick().forEach((opener, i) => expect(opener).toBe(before[i]));
  });

  it('sends life changes through the life counter: +/- as a delta, a typed value as an absolute, capped at 9999', () => {
    const life: LifeControl = { value: 20, onDelta: vi.fn(), onSet: vi.fn() };
    const { result, answer } = setup({ lifeControl: life });
    expect(result.current.life).toBe(20);

    act(() => result.current.setLife((l) => l + 1));
    expect(life.onDelta).toHaveBeenCalledWith(1);
    act(() => result.current.setLife(12_000));
    expect(life.onSet).toHaveBeenCalledWith(9999);

    result.current.openLifePrompt();
    expect(answer('40+5').initialValue).toBe('20');
    expect(life.onSet).toHaveBeenLastCalledWith(45);
  });

  it('keeps a local life total until the counter exists', () => {
    const { result } = setup();
    expect(result.current.life).toBe(40);
    act(() => result.current.setLife((l) => l - 3));
    expect(result.current.life).toBe(37);
  });

  it('sets a player counter to a non-negative value', () => {
    const { result, counterCommands, answer } = setup();
    result.current.openCounterPrompt({ counterId: 7, label: 'Other', currentValue: 2 });
    expect(answer('-4').title).toBe('Set counter');
    expect(counterCommands.set).toHaveBeenCalledWith(7, 0);
  });

  it('applies a P/T answer to each target from its own base, and an annotation to each target', () => {
    const meta = new Map<string, SeatCardMeta>([['Bear', { typeLine: 'Creature', pt: '2/2' }]]);
    const { result, cardCommands, answer } = setup({
      battlefieldCards: [bf(10, 'Bear'), bf(11, 'Golem', '4/5')],
      cardMetaByName: meta,
    });

    result.current.openPTPrompt({ targetIds: [10, 11], cardName: 'Bear', current: '2/2' });
    answer('+1/+1');
    expect(cardCommands.setPT).toHaveBeenCalledExactlyOnceWith([
      { cardId: 10, pt: '3/3' },
      { cardId: 11, pt: '5/6' },
    ]);

    result.current.openAnnotationPrompt({ targetIds: [10, 11], cardName: 'Bear', current: '' });
    answer('blocked');
    expect(vi.mocked(cardCommands.setAnnotation).mock.calls).toEqual([[10, 'blocked'], [11, 'blocked']]);
  });

  it('sets a card counter on every target in one batch', () => {
    const { result, counterCommands, answer } = setup();
    result.current.openCardCounterPrompt({ targetIds: [10, 11], cardName: 'Bear', counterId: 1, currentValue: 3 });
    expect(answer('5').title).toBe('Set counter B');
    expect(counterCommands.setCardCounters).toHaveBeenCalledExactlyOnceWith([
      { cardId: 10, counterId: 1, value: 5 },
      { cardId: 11, counterId: 1, value: 5 },
    ]);
  });

  it('routes the library count prompts: draw, view top / bottom, reveal top to a player or everyone', () => {
    const { result, dialogs, zoneCommands, draw, answer } = setup();

    result.current.openDrawCardsPrompt({ deckSize: 10 });
    answer('2');
    expect(draw).toHaveBeenCalledWith(2);

    result.current.openViewLibraryCountPrompt({ isReversed: true, deckSize: 10 });
    expect(answer('3').title).toBe('View bottom cards of library');
    expect(dialogs.openZoneView).toHaveBeenCalledWith({ playerId: 1, zoneName: ZoneName.DECK, numberCards: 3, isReversed: true });

    result.current.openRevealTopCardsPrompt({ targetPlayerId: -1, deckSize: 10 });
    expect(answer('4').title).toBe('Reveal top cards of library');
    result.current.openRevealTopCardsPrompt({ targetPlayerId: 2, deckSize: 10 });
    answer('1');
    expect(vi.mocked(zoneCommands.reveal).mock.calls).toEqual([
      [ZoneName.DECK, 'all', { top: 4 }],
      [ZoneName.DECK, 2, { top: 1 }],
    ]);
  });

  it('defaults to the first displayed position and sends wire position zero', () => {
    const { result, dialogs, answer, zoneCommands } = setup();
    result.current.openMoveXFromTopPrompt({ cardIds: [10], cardName: 'Bear', deckSize: 30 });
    const prompt = dialogs.openPrompt.mock.calls.at(-1)![0] as PromptState;
    expect(prompt.initialValue).toBe('1');
    answer(prompt.initialValue);
    expect(zoneCommands.moveCards).toHaveBeenCalledExactlyOnceWith(ZoneName.TABLE, [10], {
      zone: ZoneName.DECK, index: 0, reversed: false,
    });
  });

  it('puts a battlefield card X from the top of the library', () => {
    const { result, zoneCommands, answer } = setup();
    result.current.openMoveXFromTopPrompt({ cardIds: [10], cardName: 'Bear', deckSize: 30 });
    answer('4');
    expect(zoneCommands.moveCards).toHaveBeenCalledWith(ZoneName.TABLE, [10], { zone: ZoneName.DECK, index: 3, reversed: false });
  });

  it('creates as many of a variable-count related token as the answer says', () => {
    const { result, cardCommands, answer } = setup();
    const request = { name: 'Treasure', color: '', pt: '', annotation: '', destroyOnZoneChange: true, faceDown: false };
    result.current.openTokenCountPrompt({ request, initial: 1 });
    expect(answer('3')).toMatchObject({ title: 'Create tokens', initialValue: '1' });
    expect(cardCommands.createToken).toHaveBeenCalledTimes(3);
    expect(cardCommands.createToken).toHaveBeenCalledWith(request);
  });

  it('seeds the create-token dialog with the last token and remembers what it creates', () => {
    const { result, dialogs, cardCommands } = setup();
    const token = { name: 'Goblin', color: 'r', pt: '1/1', annotation: '', destroyOnZoneChange: true, faceDown: false };

    act(() => result.current.openCreateTokenDialog());
    const first = vi.mocked(dialogs.openCreateToken).mock.calls[0][0]!;
    expect(first.initial).toBeNull();
    act(() => first.onSubmit!(token));
    expect(cardCommands.createToken).toHaveBeenCalledWith(token);
    expect(result.current.lastToken).toEqual(token);

    act(() => result.current.openCreateTokenDialog());
    expect(vi.mocked(dialogs.openCreateToken).mock.calls[1][0]!.initial).toEqual(token);
  });
});
