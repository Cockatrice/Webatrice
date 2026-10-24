import type { LookupResult, RelatedCardRef } from '@app/services';
import { catalogT } from '../../../__test-utils__/catalogT';
import menuText from '../menus.i18n.json';

import type { ContextMenuItem as CardMenuItem } from '../ContextMenu/ContextMenu';
import {
  buildRelatedActionItems,
  buildRelatedTokenItems,
  buildRelatedViewItems,
  buildTransformItems,
  createAllRelated,
  relationCount,
  type RelatedCardSource,
} from './relatedCardActions';

const t = catalogT(menuText);

const lookup = (name: string, overrides: Partial<LookupResult> = {}): LookupResult => ({
  found: true,
  source: 'dexie',
  name,
  printings: [],
  ...overrides,
});
const ref = (name: string, overrides: Partial<RelatedCardRef> = {}): RelatedCardRef => ({ name, origin: 'related', ...overrides });
const row = (item: CardMenuItem) => {
  if ('divider' in item) {
    throw new Error('unexpected divider');
  }
  return item;
};

describe('buildRelatedTokenItems', () => {
  const tokenMeta = new Map([
    ['Soldier', lookup('Soldier', {
      power: '1', toughness: '1', colors: ['W'], pinnedPrintingId: 'sol-1', printings: [{ scryfallId: 'sol-1' } as never],
    })],
    ['Treasure', lookup('Treasure', { colors: [] })],
    ['Spirit', lookup('Spirit', { power: '1', toughness: '1', colors: ['W', 'B'] })],
  ]);

  it('labels counts and P/T like desktop addRelatedCardActions', () => {
    const items = buildRelatedTokenItems(
      t,
      [
        ref('Soldier'),
        ref('Soldier', { count: '1' }),
        ref('Soldier', { count: '3' }),
        ref('Treasure', { count: 'x' }),
        ref('Unknown Token'),
      ],
      tokenMeta,
      vi.fn(),
    );
    expect(items.map((i) => row(i).label)).toEqual([
      'Token: 1/1 Soldier',
      'Token: 1/1 Soldier',
      'Token: 3x 1/1 Soldier',
      'Token: X Treasure',
      'Token: Unknown Token',
    ]);
  });

  it('creates N tokens for a numeric count and one for X, with color and printing', () => {
    const create = vi.fn();
    const [three, x, multi, persistent] = buildRelatedTokenItems(
      t,
      [ref('Soldier', { count: '3' }), ref('Treasure', { count: 'x' }), ref('Spirit'), ref('Soldier', { persistent: 'persistent' })],
      tokenMeta,
      create,
    ).map(row);

    three.onClick!();
    expect(create).toHaveBeenCalledTimes(3);
    expect(create).toHaveBeenLastCalledWith({
      name: 'Soldier',
      color: 'w',
      pt: '1/1',
      annotation: '',
      destroyOnZoneChange: true,
      faceDown: false,
      providerId: 'sol-1',
    });

    create.mockClear();
    x.onClick!();
    multi.onClick!();
    persistent.onClick!();
    expect(create.mock.calls.map(([r]) => [r.name, r.color, r.pt, r.destroyOnZoneChange])).toEqual([
      ['Treasure', '', '', true],
      ['Spirit', 'm', '1/1', true],
      ['Soldier', 'w', '1/1', false],
    ]);
  });

  it('uses the exact pin for related tokens and sends no default printing without a pin', () => {
    const create = vi.fn();
    const meta = new Map([
      ['Pinned', lookup('Pinned', { pinnedPrintingId: 'stale-pin', printings: [{ scryfallId: 'known' }] })],
      ['Unpinned', lookup('Unpinned', { printings: [{ scryfallId: 'known' }] })],
    ]);
    const [pinned, unpinned] = buildRelatedTokenItems(t, [ref('Pinned'), ref('Unpinned')], meta, create).map(row);

    pinned.onClick!();
    unpinned.onClick!();
    expect(create.mock.calls.map(([request]) => request.providerId)).toEqual(['stale-pin', '']);
  });

  it('still renders items when no create-token command is available', () => {
    const [item] = buildRelatedTokenItems(t, [ref('Soldier')], tokenMeta, undefined).map(row);
    expect(() => item.onClick!()).not.toThrow();
  });
});

describe('annotating tokens with their card text', () => {
  it('gives a related token its rules text with "Annotate card text on tokens" on, and nothing off', () => {
    const tokenMeta = new Map([['Treasure', lookup('Treasure', { text: 'Sacrifice this artifact: Add one mana of any color.' })]]);
    const create = vi.fn();
    const [annotated] = buildRelatedTokenItems(t, [ref('Treasure')], tokenMeta, create, true).map(row);
    annotated.onClick!();
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({
      annotation: 'Sacrifice this artifact: Add one mana of any color.',
    }));

    const [plain] = buildRelatedTokenItems(t, [ref('Treasure')], tokenMeta, create).map(row);
    plain.onClick!();
    expect(create).toHaveBeenLastCalledWith(expect.objectContaining({ annotation: '' }));
  });

  it('gives a transformed face its own rules text', () => {
    const faces = [
      { name: 'Delver of Secrets', text: 'At the beginning of your upkeep, look at the top card of your library.' },
      { name: 'Insectile Aberration', text: 'Flying' },
    ];
    const create = vi.fn();
    const [item] = buildTransformItems(t, { layout: 'transform', faces }, 42, 'Delver of Secrets', create, true).map(row);
    item.onClick!();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Insectile Aberration', annotation: 'Flying' }));
  });
});

describe('buildTransformItems', () => {
  const faces = [
    { name: 'Delver of Secrets', power: '1', toughness: '1', colors: ['U'] },
    { name: 'Insectile Aberration', power: '3', toughness: '2', colors: ['U'] },
  ];

  it('offers the other face of a transformable card and targets the source card', () => {
    const create = vi.fn();
    const [front] = buildTransformItems(t, { layout: 'transform', faces }, 42, 'Delver of Secrets', create).map(row);
    expect(front).toEqual({ label: 'Token: Transform into "Insectile Aberration"', onClick: expect.any(Function) });
    front.onClick!();
    expect(create).toHaveBeenCalledWith({
      name: 'Insectile Aberration',
      color: 'u',
      pt: '3/2',
      annotation: '',
      destroyOnZoneChange: false,
      faceDown: false,
      targetCardId: 42,
      targetMode: 'transform_into',
    });

    const [back] = buildTransformItems(t, { layout: 'modal_dfc', faces }, 42, 'Insectile Aberration', vi.fn()).map(row);
    expect(back.label).toBe('Token: Transform into "Delver of Secrets"');
  });

  it.each([
    ['no metadata', undefined, 42],
    ['a non-flipping layout', { layout: 'adventure', faces }, 42],
    ['a single face', { layout: 'transform', faces: faces.slice(0, 1) }, 42],
    ['no server card id', { layout: 'transform', faces }, undefined],
  ])('offers nothing for %s', (_label, meta, cardId) => {
    expect(buildTransformItems(t, meta, cardId, 'Delver of Secrets', vi.fn())).toEqual([]);
  });

  it('targets card id 0, the first id Servatrice hands out', () => {
    const create = vi.fn();
    const [item] = buildTransformItems(t, { layout: 'reversible_card', faces }, 0, 'Delver of Secrets', create).map(row);
    item.onClick!();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ targetCardId: 0, targetMode: 'transform_into' }));
  });

  it('offers nothing without a create-token command', () => {
    expect(buildTransformItems(t, { layout: 'transform', faces }, 42, 'Delver of Secrets', undefined)).toEqual([]);
  });
});

describe('create all related tokens', () => {
  const tokenMeta = new Map([['Soldier', lookup('Soldier', { power: '1', toughness: '1' })]]);
  const faces = [
    { name: 'Delver of Secrets', power: '1', toughness: '1' },
    { name: 'Insectile Aberration', power: '3', toughness: '2' },
  ];
  const source = (overrides: Partial<RelatedCardSource>): RelatedCardSource => ({
    related: [],
    tokenMeta,
    parentMeta: undefined,
    sourceCardId: 7,
    parentName: 'Delver of Secrets',
    ...overrides,
  });

  const names = (plan: ReturnType<typeof createAllRelated>) => plan.requests.map((r) => r.name);

  it('runs the only related action, prompting for an "x" count', () => {
    expect(createAllRelated(source({ related: [ref('Soldier', { count: '2' })] })).requests.map((r) => r.name))
      .toEqual(['Soldier', 'Soldier']);
    expect(createAllRelated(source({ related: [ref('Treasure', { count: 'x=3', exclude: 'exclude' })] }))).toEqual({
      requests: [],
      prompt: { request: expect.objectContaining({ name: 'Treasure' }), defaultCount: 3 },
      lastToken: expect.objectContaining({ name: 'Treasure' }),
    });
    const transform = createAllRelated(source({ parentMeta: { layout: 'transform', faces } }));
    expect(transform.requests)
      .toEqual([expect.objectContaining({ name: 'Insectile Aberration', targetCardId: 7, targetMode: 'transform_into' })]);
    expect(transform.lastToken).toBeUndefined();
    expect(createAllRelated(source({ related: [ref('Aura', { attach: 'attach' })] })).lastToken).toBeUndefined();
  });

  it('runs the one relation that is neither excluded nor attaching, prompting for an "x" count', () => {
    const related = [ref('Soldier', { exclude: 'exclude' }), ref('Aura', { attach: 'attach' }), ref('Treasure', { count: 'x' })];
    expect(createAllRelated(source({ related }))).toEqual({
      requests: [],
      prompt: { request: expect.objectContaining({ name: 'Treasure' }), defaultCount: 1 },
      lastToken: expect.objectContaining({ name: 'Treasure' }),
    });
    expect(names(createAllRelated(source({ related: [ref('Soldier', { exclude: 'exclude' }), ref('Clue', { count: '2' })] }))))
      .toEqual(['Clue', 'Clue']);
  });

  it('creates every non-attaching, fixed-count relation when all are excluded', () => {
    const related = [
      ref('Soldier', { exclude: 'exclude', count: '2' }),
      ref('Treasure', { exclude: 'exclude', count: 'x' }),
      ref('Aura', { exclude: 'exclude', attach: 'attach' }),
      ref('Clue', { exclude: 'exclude' }),
    ];
    expect(createAllRelated(source({ related, parentMeta: { layout: 'transform', faces } }))).toEqual({
      requests: ['Soldier', 'Soldier', 'Clue'].map((name) => expect.objectContaining({ name })),
      lastToken: expect.objectContaining({ name: 'Soldier' }),
    });
  });

  it('otherwise creates every relation that is neither excluded, attaching nor asks for a count', () => {
    const plan = createAllRelated(source({
      related: [
        ref('Soldier', { count: '2' }),
        ref('Treasure', { count: 'x' }),
        ref('Aura', { attach: 'attach' }),
        ref('Clue'),
        ref('Food', { exclude: 'exclude' }),
      ],
      parentMeta: { layout: 'transform', faces },
    }));
    expect(plan.prompt).toBeUndefined();
    expect(names(plan)).toEqual(['Soldier', 'Soldier', 'Clue']);
    expect(plan.lastToken).toMatchObject({ name: 'Soldier' });
  });

  it('treats an empty exclude, attach or persistent attribute as set', () => {
    expect(createAllRelated(source({ related: [ref('Soldier', { persistent: '' })] })).requests)
      .toEqual([expect.objectContaining({ name: 'Soldier', destroyOnZoneChange: false })]);
    const related = [ref('Soldier', { exclude: '' }), ref('Aura', { attach: '' }), ref('Clue', { count: '2' })];
    expect(names(createAllRelated(source({ related })))).toEqual(['Clue', 'Clue']);
    expect(names(createAllRelated(source({ related: related.map((r) => ({ ...r, exclude: '' })) })))).toEqual(['Soldier', 'Clue', 'Clue']);
    expect(createAllRelated(source({ related: [ref('Aura', { attach: '' })] })).lastToken).toBeUndefined();
  });

  it('builds "Create another token" from the token\'s card, not from the relation', () => {
    const spirit = lookup('Spirit', {
      power: '1', toughness: '1', colors: ['W', 'B'], text: 'Flying',
      pinnedPrintingId: 'spirit-id', printings: [{ scryfallId: 'other-id' }],
    });
    const tokenMeta = new Map([['Spirit', spirit]]);
    const plan = createAllRelated(source({ related: [ref('Spirit', { persistent: 'persistent' })], tokenMeta }));
    expect(plan.requests).toEqual([expect.objectContaining({ color: 'm', destroyOnZoneChange: false })]);
    expect(plan.lastToken).toEqual({
      name: 'Spirit', color: 'w', pt: '1/1', annotation: '', destroyOnZoneChange: true, faceDown: false, providerId: 'spirit-id',
    });
    const each = createAllRelated(source({
      related: [ref('Spirit', { persistent: '' }), ref('Clue')],
      tokenMeta,
      annotate: true,
    }));
    expect(each.lastToken).toEqual({
      name: 'Spirit', color: 'w', pt: '1/1', annotation: 'Flying', destroyOnZoneChange: true, faceDown: false, providerId: 'spirit-id',
    });
  });

  it('reads counts as the cards.xml parser does', () => {
    expect([undefined, '3', '0', 'x', 'x=4', 'x=0'].map((count) => relationCount({ count }))).toEqual([
      { variable: false, count: 1 },
      { variable: false, count: 3 },
      { variable: false, count: 1 },
      { variable: true, count: 1 },
      { variable: true, count: 4 },
      { variable: true, count: 1 },
    ]);
  });

  const CREATE_ALL = { shortcut: 'Ctrl+Shift+K', keyShortcuts: 'Control+Shift+K' };

  it('puts the create-all hint on the only item, or on "All tokens"', () => {
    const createAll = vi.fn();
    const single = buildRelatedActionItems(t, source({ related: [ref('Soldier')] }), vi.fn(), CREATE_ALL, createAll).map(row);
    expect(single.map((i) => [i.label, i.shortcut, i.keyShortcuts])).toEqual([['Token: 1/1 Soldier', 'Ctrl+Shift+K', 'Control+Shift+K']]);
    single[0].onClick!();
    expect(createAll).toHaveBeenCalledTimes(1);
    createAll.mockClear();

    const create = vi.fn();
    const many = buildRelatedActionItems(
      t,
      source({ related: [ref('Soldier'), ref('Treasure', { count: 'x' })], parentMeta: { layout: 'transform', faces } }),
      create,
      CREATE_ALL,
      createAll,
    ).map(row);
    expect(many.map((i) => [i.label, i.shortcut])).toEqual([
      ['Token: 1/1 Soldier', undefined],
      ['Token: X Treasure', undefined],
      ['Token: Transform into "Insectile Aberration"', undefined],
      ['All tokens', 'Ctrl+Shift+K'],
    ]);
    many[3].onClick!();
    expect(createAll).toHaveBeenCalledTimes(1);
    expect(create).not.toHaveBeenCalled();
  });

  it('offers nothing for a card without relations, and no hint when unbound', () => {
    expect(buildRelatedActionItems(t, source({}), vi.fn(), CREATE_ALL, vi.fn())).toEqual([]);
    const noShortcut = { shortcut: '', keyShortcuts: '' };
    const [item] = buildRelatedActionItems(t, source({ related: [ref('Soldier')] }), vi.fn(), noShortcut, vi.fn());
    expect(row(item).shortcut).toBeUndefined();
  });
});

describe('buildRelatedViewItems', () => {
  const known = new Set(['Spark Elemental']);
  const resolvable = (name: string) => known.has(name);

  it('lists every relation, related and reverse-related, in order after a separator', () => {
    const onView = vi.fn();
    const items = buildRelatedViewItems(
      t,
      [ref('Missing Card'), ref('Spark Elemental', { origin: 'reverse-related' })],
      resolvable,
      onView,
    );
    expect(items[0]).toEqual({ divider: true });
    const submenu = row(items[1]).submenu ?? [];
    expect(row(items[1]).label).toBe('View related cards');
    expect(submenu.map((i) => row(i).label)).toEqual(['Missing Card', 'Spark Elemental']);

    row(submenu[1]).onClick?.();
    expect(onView).toHaveBeenCalledWith(expect.objectContaining({ name: 'Spark Elemental' }));
  });

  it('is empty unless at least one relation resolves', () => {
    expect(buildRelatedViewItems(t, [ref('Missing Card')], resolvable, vi.fn())).toEqual([]);
    expect(buildRelatedViewItems(t, [], resolvable, vi.fn())).toEqual([]);
  });
});
