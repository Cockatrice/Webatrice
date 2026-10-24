import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { getSettings, settingsStore } from '@app/hooks';
import { CommanderSpellbookIntegration } from '@app/types';

import { writeBracketLookupsMode } from '../../bracketConsent';
import { useBracketAssessment } from '../../hooks/useBracketAssessment';
import type { DeckCard } from '../../types';
import { BracketSection } from './BracketSection';

vi.mock('../../hooks/useBracketAssessment', () => ({ useBracketAssessment: vi.fn() }));

const signals = {
  turns: { matches: ['Time Warp'], restricted: [] },
  denial: { matches: [], restricted: [] },
  gameChangers: { matches: [] },
  earlyCombos: [],
  lateCombos: [],
};

const lookupsAllowed = () => vi.mocked(useBracketAssessment).mock.lastCall?.[3];

beforeEach(async () => {
  settingsStore.reset();
  await getSettings();
});

afterEach(() => {
  settingsStore.reset();
});

describe('BracketSection', () => {
  it('asks before any third-party lookup, with desktop\'s three answers', async () => {
    vi.mocked(useBracketAssessment).mockReturnValue({ status: 'consentRequired', retry: vi.fn() });
    render(<BracketSection cards={[]} />);

    expect(screen.getByText('DeckBracket.consent.prompt')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DeckBracket.consent.enable' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DeckBracket.consent.disable' })).toBeInTheDocument();
    expect(lookupsAllowed()).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'DeckBracket.consent.automatic' }));
    await waitFor(() => expect(lookupsAllowed()).toBe(true));
    expect((await getSettings()).commanderSpellbookIntegration).toBe(CommanderSpellbookIntegration.Automatic);
  });

  it('estimates on request when Enabled, for the deck as it is then', async () => {
    await act(() => writeBracketLookupsMode(CommanderSpellbookIntegration.Enabled));
    vi.mocked(useBracketAssessment).mockReturnValue({ status: 'consentRequired', retry: vi.fn() });
    const cards: DeckCard[] = [{ name: 'Sol Ring', quantity: 1, category: 'main', lookupSource: 'scryfall' }];
    const { rerender } = render(<BracketSection cards={cards} />);
    expect(screen.queryByText('DeckBracket.consent.prompt')).not.toBeInTheDocument();
    expect(lookupsAllowed()).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'DeckBracket.estimate' }));
    expect(lookupsAllowed()).toBe(true);

    rerender(<BracketSection cards={[...cards, { name: 'Mana Crypt', quantity: 1, category: 'main', lookupSource: 'scryfall' }]} />);
    expect(lookupsAllowed()).toBe(false);
  });

  it('lets the user turn the lookups off again, back to asking first', async () => {
    await act(() => writeBracketLookupsMode(CommanderSpellbookIntegration.Automatic));
    vi.mocked(useBracketAssessment).mockReturnValue({
      status: 'complete',
      report: { level: 2, signals },
      retry: vi.fn(),
    });
    render(<BracketSection cards={[]} />);
    expect(lookupsAllowed()).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'DeckBracket.why' }));
    fireEvent.click(screen.getByRole('button', { name: 'DeckBracket.consent.revoke' }));
    await waitFor(() => expect(lookupsAllowed()).toBe(false));
    expect((await getSettings()).commanderSpellbookIntegration).toBe(CommanderSpellbookIntegration.Unprompted);
  });

  it('shows progress while assessing', () => {
    vi.mocked(useBracketAssessment).mockReturnValue({ status: 'loading', retry: vi.fn() });
    render(<BracketSection cards={[]} />);
    expect(screen.getByText('DeckBracket.assessing')).toBeInTheDocument();
  });

  it('shows a complete assessment with its signals, and the provenance on request', () => {
    vi.mocked(useBracketAssessment).mockReturnValue({
      status: 'complete',
      report: { level: 2, signals },
      retry: vi.fn(),
    });
    render(<BracketSection cards={[]} />);
    expect(screen.getByTitle('DeckBracket.title')).toHaveTextContent('DeckBracket.bracket 2 · DeckBracket.level.2');
    expect(screen.getByText('DeckBracket.signal.turns').parentElement).toHaveTextContent('1DeckBracket.signal.turns· Time Warp');
    expect(screen.queryByText('DeckBracket.partialNotice')).toBeNull();
    expect(screen.queryByText('DeckBracket.provenance')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'DeckBracket.why' }));
    expect(screen.getByText('DeckBracket.provenance')).toBeInTheDocument();
  });

  it('marks a degraded assessment as a floor, lists the failed sources and offers a retry', () => {
    const retry = vi.fn();
    vi.mocked(useBracketAssessment).mockReturnValue({
      status: 'degraded',
      report: { level: 2, signals },
      unavailable: [
        { source: 'combos', failure: { kind: 'http', status: 503 } },
        { source: 'oracleText', failure: { kind: 'timeout' }, missing: 3, total: 40 },
      ],
      retry,
    });
    render(<BracketSection cards={[]} />);

    expect(screen.getByTitle('DeckBracket.partialTitle')).toBeInTheDocument();
    expect(screen.getByText('2+')).toBeInTheDocument();
    expect(screen.getByText('DeckBracket.partialNotice')).toBeInTheDocument();
    expect(screen.getByText('DeckBracket.sourceUnavailable')).toBeInTheDocument();
    expect(screen.getByText('DeckBracket.sourcePartial')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /DeckBracket\.retry/ }));
    expect(retry).toHaveBeenCalled();
  });

  it('explains a failed assessment', () => {
    vi.mocked(useBracketAssessment).mockReturnValue({ status: 'error', message: 'boom', retry: vi.fn() });
    render(<BracketSection cards={[]} />);
    expect(screen.getByText('DeckBracket.failed')).toBeInTheDocument();
  });

  it('keeps keyboard focus in the section when Retry replaces the notice with progress', () => {
    const degraded = {
      status: 'degraded' as const,
      report: { level: 2 as const, signals },
      unavailable: [{ source: 'combos' as const, failure: { kind: 'timeout' as const } }],
      retry: vi.fn(),
    };
    vi.mocked(useBracketAssessment).mockReturnValue(degraded);
    const { container, rerender } = render(<BracketSection cards={[]} />);
    const retryButton = screen.getByRole('button', { name: /DeckBracket\.retry/ });
    retryButton.focus();

    fireEvent.click(retryButton);
    vi.mocked(useBracketAssessment).mockReturnValue({ status: 'loading', retry: vi.fn() });
    rerender(<BracketSection cards={[]} />);

    expect(document.activeElement).toBe(container.firstChild);
  });
});
