import { act, fireEvent, render, screen } from '@testing-library/react';

import { getSettings, settingsStore } from '../../../../../hooks/useSettings';

import Card from './SeatCard';

const cardFaceRender = vi.hoisted(() => vi.fn());
vi.mock('@app/hooks', async (importOriginal) => {
  const original = await importOriginal<typeof import('@app/hooks')>();
  return {
    ...original,
    usePreference: (...args: Parameters<typeof original.usePreference>) => {
      cardFaceRender(...args);
      return original.usePreference(...args);
    },
  };
});

describe('SeatCard', () => {
  it('rerenders only card faces whose shallow props change', () => {
    const counters = [{ id: 0, value: 2 }];
    const Faces = ({ changedName, stableCounters }: { changedName: string; stableCounters: typeof counters }) => (
      <>
        <Card name="Grizzly Bears" counters={stableCounters} />
        <Card name={changedName} />
      </>
    );
    const view = render(<Faces changedName="Shock" stableCounters={counters} />);
    cardFaceRender.mockClear();

    view.rerender(<Faces changedName="Lightning Bolt" stableCounters={counters} />);

    expect(cardFaceRender).toHaveBeenCalledOnce();
    expect(screen.queryByText('Shock')).not.toBeInTheDocument();
    expect(screen.getByText('Lightning Bolt')).toBeInTheDocument();

    cardFaceRender.mockClear();
    view.rerender(<Faces changedName="Lightning Bolt" stableCounters={[{ id: 0, value: 3 }]} />);

    expect(cardFaceRender).toHaveBeenCalledOnce();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('draws its name, P/T and annotation in the over-art colours, whatever the theme', () => {
    render(<Card name="Grizzly Bears" pt="2/2" basePT="2/2" annotation="token" />);
    for (const text of ['Grizzly Bears', '2/2', 'token']) {
      expect(screen.getByText(text)).toHaveClass('bg-over-art-backdrop', 'text-over-art-text');
    }
  });

  it('names each counter in its tooltip, where the badge shows its type only as a colour', () => {
    const { container } = render(<Card name="Grizzly Bears" counters={[{ id: 0, value: 2 }, { id: 3, value: 1 }]} />);
    expect(container.querySelector('.seat-card')?.getAttribute('title')?.split('\n')).toHaveLength(3);
  });

  it('draws a modified P/T in desktop\'s orange, from its token', () => {
    render(<Card name="Grizzly Bears" pt="3/3" basePT="2/2" />);
    expect(screen.getByText('3/3')).toHaveClass('text-pt-modified');
    expect(screen.getByText('3/3')).not.toHaveClass('text-over-art-text');
  });

  describe('"Display card names on cards having a picture"', () => {
    afterEach(() => {
      settingsStore.reset();
    });

    const namesOff = async () => {
      const settings = await getSettings();
      await act(async () => {
        settingsStore.setValue(Object.assign(settings, { displayCardNames: false }));
      });
    };

    it('names a card with a picture only while the option is on', async () => {
      const { container } = render(<Card name="Grizzly Bears" />);
      fireEvent.load(container.querySelector('img')!);
      expect(screen.getByText('Grizzly Bears')).toBeInTheDocument();
      await namesOff();
      expect(screen.queryByText('Grizzly Bears')).not.toBeInTheDocument();
    });

    it('always names a face-down card, and a card whose picture is loading or failed to load', async () => {
      await namesOff();
      const { container } = render(<Card name="Morph" id="12" faceDown />);
      expect(screen.getByText('# 12')).toBeInTheDocument();

      container.remove();
      const { container: loading } = render(<Card name="Grizzly Bears" />);
      expect(screen.getByText('Grizzly Bears')).toBeInTheDocument();
      fireEvent.load(loading.querySelector('img')!);
      expect(screen.queryByText('Grizzly Bears')).not.toBeInTheDocument();

      loading.remove();
      const { container: missing } = render(<Card name="Homemade Token" />);
      fireEvent.error(missing.querySelector('img')!);
      expect(screen.getByText('Homemade Token')).toBeInTheDocument();
    });
  });
});

const ID = '0f1a2b3c-4d5e-4f60-8a7b-9c0d1e2f3a4b';

const imgSrc = (container: HTMLElement) => container.querySelector('img')?.getAttribute('src');

describe('SeatCard image', () => {
  it('loads the chosen printing by Scryfall id', () => {
    const { container } = render(<Card name="Rhino, Warrior Token" scryfallId={ID} />);
    expect(imgSrc(container)).toBe(`https://api.scryfall.com/cards/${ID}?format=image&version=large`);
  });

  it('loads a name-only card by its exact name without the Token suffix', () => {
    const { container } = render(<Card name="Rhino, Warrior Token" />);
    expect(imgSrc(container))
      .toBe('https://api.scryfall.com/cards/named?exact=Rhino%2C%20Warrior&format=image&version=large');
  });

  it('keeps a name that is only the word Token', () => {
    const { container } = render(<Card name="Token" scryfallId="" />);
    expect(imgSrc(container)).toBe('https://api.scryfall.com/cards/named?exact=Token&format=image&version=large');
  });
});
