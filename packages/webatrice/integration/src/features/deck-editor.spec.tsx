import { Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { create, isFieldSet } from '@bufbuild/protobuf';

import { ShortcutProvider } from '@app/feature-widgets/shortcuts';
import {
  DeckEditor,
  clearBracketSourceCaches,
  clearDeckEditorCache,
  clearDecksListCache,
  writeBracketLookupsMode,
} from '@app/features/decks';
import { parseCod } from '@app/services';
import { CommanderSpellbookIntegration, RouteEnum, type ParsedDeck } from '@app/types';
import {
  Command_DeckDownload_ext,
  Command_DeckList_ext,
  Command_DeckUpload_ext,
  Command_DeckUploadSchema,
  Response_DeckUploadSchema,
  Response_DeckUpload_ext,
  ServerInfo_DeckStorage_TreeItemSchema,
} from '@cockatrice/sockatrice/generated';

import { connectAndLogin } from '../helpers/setup';
import { findAllSessionCommands, findLastSessionCommand } from '../helpers/command-capture';
import { buildResponse, buildResponseMessage, deliverMessage } from '../helpers/protobuf-builders';
import { renderFeatureScreen } from './helpers';
import {
  LocationProbe,
  type FetchOverride,
  codXml,
  fetchCalls,
  respondToDeckDownload,
  stubImagePreload,
  stubThirdPartyFetch,
} from './deckHelpers';

const DECK_ID = 5;

const MODERN_DECK = codXml({
  name: 'Burn',
  format: 'modern',
  main: [
    { name: 'Lightning Bolt', quantity: 1, set: 'm11', num: '149' },
    { name: 'Sol Ring', quantity: 1 },
    { name: 'Forest', quantity: 10 },
  ],
  side: [{ name: 'Llanowar Elves', quantity: 1 }],
});

const COMMANDER_DECK = codXml({
  name: 'Superfriends',
  format: 'commander',
  main: [
    { name: 'Atraxa, Grand Unifier', quantity: 1, commander: true },
    { name: 'Lightning Bolt', quantity: 1, set: 'm11', num: '149' },
    { name: 'Sol Ring', quantity: 1 },
    { name: 'Forest', quantity: 10 },
  ],
  side: [{ name: 'Llanowar Elves', quantity: 1 }],
});

const GROUP_LABELS = new RegExp(
  '^DeckEditor\\.section\\.'
  + '(commander|creature|planeswalker|battle|instant|sorcery|enchantment|artifact|land|other|sideboard)\\d+$',
);

let fetchMock: ReturnType<typeof stubThirdPartyFetch>;

function stubWideViewport() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true, media: query, addEventListener: () => {}, removeEventListener: () => {},
  }));
}

beforeEach(async () => {
  vi.useRealTimers();
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 1204, 800));
  stubWideViewport();
  clearDeckEditorCache();
  clearDecksListCache();
  clearBracketSourceCaches();
  await writeBracketLookupsMode(CommanderSpellbookIntegration.Automatic);
  fetchMock = stubThirdPartyFetch();
  stubImagePreload();
  connectAndLogin();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

async function openDeck(xml: string) {
  renderFeatureScreen(
    <ShortcutProvider>
      <Routes>
        <Route path={RouteEnum.DECK} element={<DeckEditor />} />
        <Route path={RouteEnum.DECKS} element={<LocationProbe />} />
      </Routes>
    </ShortcutProvider>,
    `/deck/${DECK_ID}`,
  );
  await waitFor(() => expect(findLastSessionCommand(Command_DeckDownload_ext).value.deckId).toBe(DECK_ID));
  act(() => {
    respondToDeckDownload(DECK_ID, xml);
  });
  const name = await screen.findByDisplayValue(parseCod(xml).name, {}, { timeout: 5000 });
  await waitFor(() => expect(name).toBeEnabled());
}

function searchResults(): HTMLElement {
  return screen.getByRole('region', { name: 'CardSearchDock.results' });
}

async function searchResult(cardName: string): Promise<HTMLElement> {
  const title = await within(searchResults()).findByRole('button', { name: new RegExp(`^${cardName}`) }, { timeout: 3000 });
  return title.closest<HTMLElement>('li')!;
}

function openMoreMenu(): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: 'DeckHeader.more' }));
  return screen.getByRole('menu', { name: 'DeckHeader.more' });
}

function closeDialog() {
  fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Common.action.close' }));
}

function groupHeadings(): string[] {
  return screen
    .getAllByRole('heading', { level: 3 })
    .map((h) => h.textContent ?? '')
    .filter((t) => GROUP_LABELS.test(t));
}

function uploads(): ParsedDeck[] {
  return findAllSessionCommands(Command_DeckUpload_ext).map((c) => parseCod(c.value.deckList));
}

async function autosaved(predicate: (deck: ParsedDeck) => boolean): Promise<ParsedDeck> {
  let match: ParsedDeck | undefined;
  await waitFor(() => {
    match = uploads().find(predicate);
    expect(match).toBeDefined();
  }, { timeout: 3000 });
  return match!;
}

function card(deck: ParsedDeck, name: string) {
  return deck.cards.find((c) => c.name === name);
}

function cardRow(cardName: string): HTMLElement {
  return screen.getByRole('button', { name: cardName }).closest<HTMLElement>('[role="row"]')!;
}

function rowActions(cardName: string) {
  return within(cardRow(cardName)).getByRole('button', { name: 'DeckEditor.rowActions.trigger' });
}

function sections(...entries: [string, number][]): string[] {
  return entries.map(([section, total]) => `DeckEditor.section.${section}${total}`);
}

describe('DeckEditor (integration)', () => {
  it('downloads the deck by id and renders grouped rows, counts and the header', async () => {
    await openDeck(MODERN_DECK);

    expect(screen.getByDisplayValue('Burn')).toBeInTheDocument();
    expect(screen.getByText('DeckHeader.cardCount · DeckHeader.sideboardCount')).toBeInTheDocument();
    expect(groupHeadings()).toEqual(sections(['instant', 1], ['artifact', 1], ['land', 10], ['sideboard', 1]));
    expect(screen.getByRole('combobox', { name: 'FormatPicker.label' })).toHaveValue('modern');
    expect(screen.queryByText('DeckBreakdown.bracketEstimate')).toBeNull();
    expect(screen.getByRole('heading', { name: 'DeckBreakdown.manaCurve' })).toBeInTheDocument();
  });

  it('shows the commander section and persists a computed bracket and price for commander decks', async () => {
    await openDeck(COMMANDER_DECK);

    expect(groupHeadings()).toEqual(
      sections(['commander', 1], ['instant', 1], ['artifact', 1], ['land', 10], ['sideboard', 1]),
    );
    expect(await screen.findByTitle('DeckBracket.title', {}, { timeout: 3000 })).toBeInTheDocument();

    const spellbook = fetchCalls(fetchMock, 'https://backend.commanderspellbook.com/find-my-combos/');
    expect(spellbook).toHaveLength(1);
    const body = JSON.parse(String(spellbook[0][1]?.body));
    expect(body.main).toEqual(expect.arrayContaining([
      { card: 'Sol Ring', quantity: 1 },
      { card: 'Forest', quantity: 10 },
    ]));
    expect(body.main).not.toContainEqual(expect.objectContaining({ card: 'Llanowar Elves' }));
    expect(body.commanders).toEqual([{ card: 'Atraxa, Grand Unifier', quantity: 1 }]);

    const saved = await autosaved((d) => d.bracketAssessment?.level === 1 && d.meta.priceUsd === 24.75);
    expect(saved.meta.bracketLevel).toBe(1);
    expect(saved.bracketAssessment?.fingerprint).toMatch(/^[0-9a-z]{8}$/);
  });

  it('makes no third-party bracket request until the user allows it', async () => {
    await writeBracketLookupsMode(CommanderSpellbookIntegration.Unprompted);
    await openDeck(COMMANDER_DECK);

    expect(await screen.findByText('DeckBracket.consent.prompt')).toBeInTheDocument();
    const saved = await autosaved((d) => d.meta.priceUsd === 24.75);
    expect(saved.bracketAssessment).toBeUndefined();
    expect(fetchCalls(fetchMock, 'https://backend.commanderspellbook.com/')).toEqual([]);
    expect(fetchCalls(fetchMock, 'https://api.scryfall.com/cards/search?q=is%3Agamechanger')).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: 'DeckBracket.consent.automatic' }));

    expect(await screen.findByTitle('DeckBracket.title', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(fetchCalls(fetchMock, 'https://backend.commanderspellbook.com/find-my-combos/')).toHaveLength(1);
    await autosaved((d) => d.bracketAssessment?.level === 1);
  });

  describe('bracket assessment with a third-party outage (DATA-001)', () => {
    function withOutage(override: FetchOverride) {
      vi.unstubAllGlobals();
      stubWideViewport();
      stubImagePreload();
      let outage = true;
      fetchMock = stubThirdPartyFetch((url, init) => (outage ? override(url, init) : undefined));
      return () => {
        outage = false;
      };
    }

    function bracketUploads() {
      return uploads().filter((d) => d.bracketAssessment || d.meta.bracketLevel != null);
    }

    it('shows a partial estimate, never persists it, and saves the bracket once a retry succeeds', async () => {
      const recover = withOutage((url) =>
        url.startsWith('https://backend.commanderspellbook.com/')
          ? ({ ok: false, status: 503, json: async () => ({}) } as Response)
          : undefined);
      await openDeck(COMMANDER_DECK);

      expect(await screen.findByTitle('DeckBracket.partialTitle', {}, { timeout: 3000 })).toBeInTheDocument();
      expect(screen.getByText('DeckBracket.sourceUnavailable')).toBeInTheDocument();
      await autosaved((d) => d.meta.priceUsd === 24.75);
      expect(bracketUploads()).toEqual([]);

      recover();
      fireEvent.click(screen.getByRole('button', { name: /DeckBracket\.retry/ }));

      expect(await screen.findByTitle('DeckBracket.title', {}, { timeout: 3000 })).toBeInTheDocument();
      expect(screen.queryByText('DeckBracket.partialNotice')).toBeNull();
      const saved = await autosaved((d) => d.bracketAssessment?.level === 1);
      expect(saved.meta.bracketLevel).toBe(1);
    });

    it('treats a malformed Game Changers response as incomplete, not as "no Game Changers"', async () => {
      withOutage((url) =>
        url.includes('is%3Agamechanger')
          ? ({
            ok: true,
            status: 200,
            json: async () => {
              throw new SyntaxError('bad json');
            },
          } as unknown as Response)
          : undefined);
      await openDeck(COMMANDER_DECK);

      expect(await screen.findByTitle('DeckBracket.partialTitle', {}, { timeout: 3000 })).toBeInTheDocument();
      await autosaved((d) => d.meta.priceUsd === 24.75);
      expect(bracketUploads()).toEqual([]);
    });

    it('drops a stale saved assessment instead of leaving it as current', async () => {
      withOutage((url) =>
        url.startsWith('https://backend.commanderspellbook.com/')
          ? Promise.reject(new TypeError('Failed to fetch'))
          : undefined);
      await openDeck(codXml({
        name: 'Stale',
        format: 'commander',
        bracketLevel: 4,
        main: [{ name: 'Sol Ring' }],
      }));

      expect(await screen.findByTitle('DeckBracket.partialTitle', {}, { timeout: 3000 })).toBeInTheDocument();
      const saved = await autosaved((d) => d.meta.priceUsd === 1.5);
      expect(saved.bracketAssessment).toBeUndefined();
      expect(saved.meta.bracketLevel).toBeUndefined();
    });
  });

  it('autosaves edits as an update of the same deck id without a storage path', async () => {
    await openDeck(MODERN_DECK);

    fireEvent.change(screen.getByDisplayValue('Burn'), { target: { value: 'Burn v2' } });
    expect(screen.getByText('DeckHeader.dirty')).toBeInTheDocument();

    await autosaved((d) => d.name === 'Burn v2');
    const upload = findAllSessionCommands(Command_DeckUpload_ext)
      .find((c) => parseCod(c.value.deckList).name === 'Burn v2')!;
    expect(upload.value.deckId).toBe(DECK_ID);
    expect(isFieldSet(upload.value, Command_DeckUploadSchema.field.path)).toBe(false);

    const listRequestsBefore = findAllSessionCommands(Command_DeckList_ext).length;
    act(() => {
      deliverMessage(buildResponseMessage(buildResponse({
        cmdId: upload.cmdId,
        ext: Response_DeckUpload_ext,
        value: create(Response_DeckUploadSchema, {
          newFile: create(ServerInfo_DeckStorage_TreeItemSchema, { id: DECK_ID, name: 'Burn v2' }),
        }),
      })));
    });
    expect(await screen.findByText('DeckHeader.saved')).toBeInTheDocument();
    expect(findAllSessionCommands(Command_DeckList_ext).length).toBe(listRequestsBefore);
  });

  it('does not upload when nothing changed', async () => {
    await openDeck(MODERN_DECK);
    await autosaved((d) => d.meta.priceUsd !== undefined);
    const before = uploads().length;

    fireEvent.change(screen.getByDisplayValue('Burn'), { target: { value: 'Burn v2' } });
    fireEvent.change(screen.getByDisplayValue('Burn v2'), { target: { value: 'Burn' } });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 800));
    });
    expect(uploads()).toHaveLength(before);
  });

  it('leaves the format unset when a legacy deck has no evidence for inference', async () => {
    await openDeck(codXml({ name: 'Legacy', main: [{ name: 'Sol Ring' }] }));

    expect(screen.getByRole('combobox', { name: 'FormatPicker.label' })).toHaveValue('');
    const saved = await autosaved((d) => d.meta.priceUsd === 1.5);
    expect(saved).toMatchObject({ name: 'Legacy', format: '' });
  });

  it('the search dock looks the card up, appends a mainboard row, and Enter increments an existing one', async () => {
    await openDeck(MODERN_DECK);

    const search = screen.getByRole('textbox', { name: 'CardSearch.label' });
    fireEvent.change(search, { target: { value: 'Atra' } });
    const atraxa = await searchResult('Atraxa, Grand Unifier');
    expect(within(atraxa).getByRole('button', { name: /^Atraxa/ })).toHaveTextContent('Legendary Creature');
    fireEvent.click(within(atraxa).getByRole('button', { name: 'CardSearchDock.addMain' }));

    await waitFor(() => expect(groupHeadings()).toContain('DeckEditor.section.creature1'));
    const added = await autosaved((d) => card(d, 'Atraxa, Grand Unifier')?.category === 'main');
    expect(card(added, 'Atraxa, Grand Unifier')?.quantity).toBe(1);
    expect(within(atraxa).getByText(/CardSearchDock\.inDeck/)).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'DeckInspector.title' })).toHaveTextContent('Atraxa, Grand Unifier');

    fireEvent.change(search, { target: { value: 'Sol' } });
    const solRing = await searchResult('Sol Ring');
    expect(solRing).toHaveAttribute('aria-current', 'true');
    fireEvent.keyDown(search, { key: 'Enter', code: 'Enter' });
    await waitFor(() => expect(groupHeadings()).toContain('DeckEditor.section.artifact2'));
    const incremented = await autosaved((d) => card(d, 'Sol Ring')?.quantity === 2);
    expect(incremented.cards.filter((c) => c.name === 'Sol Ring')).toHaveLength(1);
  });

  it('moves a card to the sideboard and back, changes quantity, and removes it from the row menu', async () => {
    await openDeck(MODERN_DECK);

    fireEvent.click(rowActions('Sol Ring'));
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'DeckEditor.rowActions.moveToSideboard' }));
    await waitFor(() => expect(groupHeadings()).toEqual(sections(['instant', 1], ['land', 10], ['sideboard', 2])));
    await autosaved((d) => card(d, 'Sol Ring')?.category === 'sideboard');

    fireEvent.click(rowActions('Sol Ring'));
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'DeckEditor.rowActions.moveToMain' }));
    await autosaved((d) => card(d, 'Sol Ring')?.category === 'main');

    fireEvent.click(rowActions('Sol Ring'));
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'DeckEditor.rowActions.addOne' }));
    await autosaved((d) => card(d, 'Sol Ring')?.quantity === 2);
    expect(screen.getByRole('menu')).toBeInTheDocument();

    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Common.action.remove' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Sol Ring' })).toBeNull());
    await autosaved((d) => !card(d, 'Sol Ring'));
  });

  it('lists every Scryfall printing in the picker and stores the chosen one', async () => {
    await openDeck(MODERN_DECK);

    fireEvent.click(rowActions('Lightning Bolt'));
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'DeckEditor.rowActions.changePrinting' }));

    expect(screen.getByRole('heading', { name: 'PrintingPicker.title' })).toBeInTheDocument();
    fireEvent.click(await screen.findByTitle('LEA · Lightning Bolt'));
    expect(screen.queryByRole('heading', { name: 'PrintingPicker.title' })).toBeNull();

    const saved = await autosaved((d) => card(d, 'Lightning Bolt')?.set === 'lea');
    expect(card(saved, 'Lightning Bolt')).toEqual(expect.objectContaining({
      collectorNumber: '161',
      scryfallId: 'id-bolt-lea',
    }));
  });

  it('persists a format change from the sidebar picker', async () => {
    await openDeck(MODERN_DECK);

    fireEvent.change(screen.getByRole('combobox', { name: 'FormatPicker.label' }), { target: { value: 'legacy' } });
    await autosaved((d) => d.format === 'legacy');

    fireEvent.change(screen.getByRole('combobox', { name: 'FormatPicker.label' }), { target: { value: 'other' } });
    fireEvent.change(screen.getByPlaceholderText('FormatPicker.placeholder.sidebar'), { target: { value: 'Cube' } });
    await autosaved((d) => d.format === 'Cube');
  });

  it('the dock composes filters into a Scryfall query, limited to the deck format, and adds the clicked result', async () => {
    await openDeck(MODERN_DECK);

    fireEvent.change(screen.getByRole('textbox', { name: 'CardSearch.label' }), { target: { value: 'bolt' } });
    fireEvent.click(screen.getByRole('button', { name: 'CardSearch.color.R' }));
    fireEvent.click(screen.getByRole('button', { name: 'CardSearch.cardType.Instant' }));
    await waitFor(() => {
      const queries = fetchCalls(fetchMock, 'https://api.scryfall.com/cards/search?')
        .map(([url]) => new URL(String(url)).searchParams.get('q'));
      expect(queries).toContain('bolt c:r t:instant f:modern');
    });

    const bolt = await searchResult('Lightning Bolt');
    fireEvent.click(within(bolt).getByRole('button', { name: 'CardSearchDock.addMain' }));
    await autosaved((d) => card(d, 'Lightning Bolt')?.quantity === 2);
    expect(groupHeadings()).toContain('DeckEditor.section.instant2');
  });

  it('opens the card detail dialog and edits quantity without closing it', async () => {
    await openDeck(MODERN_DECK);

    fireEvent.click(screen.getByRole('button', { name: 'Lightning Bolt' }));
    const inspector = screen.getByRole('region', { name: 'DeckInspector.title' });
    expect(inspector).toHaveTextContent('Lightning Bolt');
    fireEvent.click(within(inspector).getByRole('button', { name: 'DeckInspector.details' }));
    expect(await screen.findByText('Lightning Bolt deals 3 damage to any target.')).toBeInTheDocument();
    expect(screen.getByText('M11 · #149')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'CardDetailDialog.increase' }));
    await autosaved((d) => card(d, 'Lightning Bolt')?.quantity === 2);
    expect(screen.getByText('Lightning Bolt deals 3 damage to any target.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'DeckEditor.rowActions.moveToSideboard' }));
    await autosaved((d) => card(d, 'Lightning Bolt')?.category === 'sideboard');
    expect(screen.queryByText('Lightning Bolt deals 3 damage to any target.')).toBeNull();
  });

  it('exports the deck as plain text and as a Cockatrice .cod', async () => {
    await openDeck(MODERN_DECK);

    fireEvent.click(screen.getByRole('button', { name: 'DeckHeader.export' }));
    expect(screen.getAllByRole('textbox').some((el) => (el as HTMLTextAreaElement).value
      === '// Deck\n1 Lightning Bolt\n1 Sol Ring\n10 Forest\n\n// Sideboard\nSB: 1 Llanowar Elves')).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: /ExportDeckDialog\.format\.cockatrice\.label/ }));
    const cod = screen.getAllByRole('textbox')
      .map((el) => (el as HTMLTextAreaElement).value)
      .find((v) => v.startsWith('<?xml'))!;
    const parsed = parseCod(cod);
    expect(parsed.name).toBe('Burn');
    expect(parsed.cards.map((c) => c.name)).toEqual(['Lightning Bolt', 'Sol Ring', 'Forest', 'Llanowar Elves']);
  });

  it('undoes and redoes from the buttons, the history list and the keyboard; autosave follows', async () => {
    await openDeck(MODERN_DECK);
    await autosaved((d) => d.meta.priceUsd !== undefined);

    fireEvent.change(screen.getByRole('combobox', { name: 'FormatPicker.label' }), { target: { value: 'legacy' } });
    fireEvent.click(rowActions('Sol Ring'));
    fireEvent.click(within(screen.getByRole('menu')).getByRole('menuitem', { name: 'Common.action.remove' }));
    await autosaved((d) => d.format === 'legacy' && !card(d, 'Sol Ring'));

    fireEvent.click(screen.getByRole('button', { name: 'DeckHistory.undo' }));
    expect(screen.getByRole('button', { name: 'Sol Ring' })).toBeInTheDocument();
    await autosaved((d) => d.format === 'legacy' && card(d, 'Sol Ring')?.quantity === 1);

    fireEvent.keyDown(document.body, { key: 'z', code: 'KeyZ', ctrlKey: true });
    expect((screen.getByRole('combobox', { name: 'FormatPicker.label' }) as HTMLSelectElement).value).toBe('modern');

    fireEvent.keyDown(document.body, { key: 'y', code: 'KeyY', ctrlKey: true });
    expect((screen.getByRole('combobox', { name: 'FormatPicker.label' }) as HTMLSelectElement).value).toBe('legacy');
    fireEvent.click(screen.getByRole('button', { name: 'DeckHistory.history' }));
    const list = screen.getByRole('menu', { name: 'DeckHistory.history' });
    fireEvent.click(within(list).getAllByRole('menuitem')[0]);
    expect(screen.queryByRole('button', { name: 'Sol Ring' })).toBeNull();
    await autosaved((d) => d.format === 'legacy' && !card(d, 'Sol Ring'));
  });

  it('edits the banner card and tags, keeping unknown tag children through the save', async () => {
    await openDeck(codXml({
      name: 'Burn',
      format: 'modern',
      main: [{ name: 'Lightning Bolt', quantity: 1, set: 'm11', num: '149' }, { name: 'Sol Ring', quantity: 1 }],
      extraXml: '<bannerCard providerId="">Sol Ring</bannerCard><tags><tag>Aggro</tag><color>red</color></tags>',
    }));

    expect(screen.getByRole('list', { name: 'DeckTags.label' })).toHaveTextContent('Aggro');

    fireEvent.click(within(openMoreMenu()).getByRole('menuitem', { name: 'DeckHeader.bannerCard' }));
    const banner = screen.getByRole('combobox', { name: 'DeckBanner.label' }) as HTMLSelectElement;
    expect(banner.selectedOptions[0].textContent).toBe('Sol Ring');
    const bolt = Array.from(banner.options).find((o) => o.textContent === 'Lightning Bolt')!;
    fireEvent.change(banner, { target: { value: bolt.value } });
    closeDialog();

    fireEvent.click(screen.getByRole('button', { name: 'DeckHeader.editTags' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'DeckTags.add' }), { target: { value: 'Burn' } });
    fireEvent.click(screen.getByRole('button', { name: 'DeckTags.add' }));

    const saved = await autosaved((d) => d.bannerCard === 'Lightning Bolt' && (d.tagsXml ?? '').includes('Burn'));
    expect(saved.tagsXml).toBe('<tags><color>red</color><tag>Aggro</tag><tag>Burn</tag></tags>');

    fireEvent.click(screen.getAllByRole('button', { name: 'DeckTags.remove' })[0]);
    closeDialog();
    fireEvent.click(within(openMoreMenu()).getByRole('menuitem', { name: 'DeckHeader.bannerCard' }));
    fireEvent.change(screen.getByRole('combobox', { name: 'DeckBanner.label' }), { target: { value: '' } });
    const cleared = await autosaved((d) => !d.bannerCard && !(d.tagsXml ?? '').includes('Aggro'));
    expect(cleared.tagsXml).toBe('<tags><color>red</color><tag>Burn</tag></tags>');
  });

  it('flags cards that are not legal in the deck format and re-checks on a format change', async () => {
    await openDeck(MODERN_DECK);

    expect(await screen.findByText('DeckLegality.illegal')).toBeInTheDocument();
    const solRing = cardRow('Sol Ring');
    expect(within(solRing).getByRole('img', { name: 'DeckLegality.reason.notLegal' })).toBeInTheDocument();
    const bolt = cardRow('Lightning Bolt');
    expect(within(bolt).queryByRole('img', { name: /DeckLegality/ })).toBeNull();

    fireEvent.change(screen.getByRole('combobox', { name: 'FormatPicker.label' }), { target: { value: 'legacy' } });
    expect(await within(solRing).findByRole('img', { name: 'DeckLegality.reason.banned' })).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'FormatPicker.label' }), { target: { value: 'commander' } });
    expect(await screen.findByText('DeckLegality.legal')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'FormatPicker.label' }), { target: { value: 'other' } });
    fireEvent.change(screen.getByPlaceholderText('FormatPicker.placeholder.sidebar'), { target: { value: 'Cube' } });
    expect(await screen.findByText('DeckLegality.unavailable')).toBeInTheDocument();
  });

  it('draws a sample hand from the main deck without saving anything', async () => {
    await openDeck(MODERN_DECK);
    await autosaved((d) => d.meta.priceUsd !== undefined);
    const before = uploads().length;

    fireEvent.click(screen.getByRole('button', { name: 'SampleHand.title' }));
    const hand = screen.getByRole('list', { name: 'SampleHand.title' });
    expect(within(hand).getAllByRole('listitem')).toHaveLength(7);
    expect(within(hand).queryByRole('img', { name: 'Llanowar Elves' })).toBeNull();

    fireEvent.change(screen.getByRole('spinbutton', { name: 'SampleHand.size' }), { target: { value: '12' } });
    expect(within(hand).getAllByRole('listitem')).toHaveLength(12);
    fireEvent.click(screen.getByRole('button', { name: 'SampleHand.redraw' }));
    expect(within(hand).getAllByRole('listitem')).toHaveLength(12);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 700));
    });
    expect(uploads()).toHaveLength(before);
  });

  it('shows the not-found shell for an unreadable deck and links back to My Decks', async () => {
    renderFeatureScreen(
      <Routes>
        <Route path={RouteEnum.DECK} element={<DeckEditor />} />
        <Route path={RouteEnum.DECKS} element={<LocationProbe />} />
      </Routes>,
      `/deck/${DECK_ID}`,
    );
    await waitFor(() => expect(findLastSessionCommand(Command_DeckDownload_ext).value.deckId).toBe(DECK_ID));
    act(() => {
      respondToDeckDownload(DECK_ID, 'not xml');
    });

    expect(await screen.findByText('DeckEditor.shell.notFoundTitle')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /DeckEditor\.shell\.backToDecks/ }));
    expect(screen.getByTestId('location')).toHaveTextContent(RouteEnum.DECKS);
  });
});
