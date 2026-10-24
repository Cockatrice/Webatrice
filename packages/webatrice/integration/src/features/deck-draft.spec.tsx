import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { generatePath, Route, Routes } from 'react-router-dom';

import { Command_DeckDownload_ext, Command_DeckUpload_ext } from '@cockatrice/sockatrice/generated';
import { DeckEditor } from '@app/features/decks';
import { stageDeckDocument } from '@app/services';
import { RouteEnum } from '@app/types';

import { findLastSessionCommand } from '../helpers/command-capture';
import { connectAndLogin } from '../helpers/setup';
import { renderFeatureScreen } from './helpers';

const GAME_DECK = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<cockatrice_deck version="1">',
  '<deckname>Burn</deckname>',
  '<zone name="main">',
  '<card number="4" name="Lightning Bolt" setShortName="M11" collectorNumber="149" uuid="bolt-uuid"/>',
  '</zone>',
  '</cockatrice_deck>',
].join('');

beforeEach(() => {
  vi.useRealTimers();
  connectAndLogin();
  vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
});

function renderDraft() {
  const route = generatePath(RouteEnum.DECK_DRAFT, { token: stageDeckDocument(GAME_DECK) });
  renderFeatureScreen(
    <Routes>
      <Route path={RouteEnum.DECK} element={<DeckEditor />} />
      <Route path={RouteEnum.DECK_DRAFT} element={<DeckEditor />} />
    </Routes>,
    route,
  );
}

describe('deck draft route (integration)', () => {
  it('opens a staged game deck in the editor without downloading a stored deck', async () => {
    renderDraft();

    expect(await screen.findByDisplayValue('Burn', {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.getAllByText('Lightning Bolt').length).toBeGreaterThan(0);
    expect(() => findLastSessionCommand(Command_DeckDownload_ext)).toThrow(/No outbound session command/);
  });

  it('stores the draft on its first edit as a new root deck that keeps every printing field', async () => {
    renderDraft();
    const name = await screen.findByDisplayValue('Burn', {}, { timeout: 5000 });
    await waitFor(() => expect(name).toBeEnabled());

    fireEvent.change(name, { target: { value: 'Burn v2' } });

    const upload = await waitFor(() => findLastSessionCommand(Command_DeckUpload_ext), { timeout: 5000 });
    expect(upload.value.path).toBe('');
    expect(upload.value.deckId).toBe(0);
    expect(upload.value.deckList).toContain('<deckname>Burn v2</deckname>');
    expect(upload.value.deckList).toMatch(
      /name="Lightning Bolt"[^>]*setShortName="M11"[^>]*collectorNumber="149"[^>]*uuid="bolt-uuid"/,
    );
  });
});
