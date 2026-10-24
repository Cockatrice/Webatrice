import { fireEvent, render, waitFor } from '@testing-library/react';
import { games } from '@cockatrice/datatrice';
import { CardDTO } from '@app/services';
import { cardDataPreferencesStore } from '@app/hooks';
import PlaymatImage from './PlaymatImage';

const playmat = { cardName: 'Island', cardProviderId: 'preferred', params: games.DEFAULT_PLAYMAT_PARAMS };
beforeEach(async () => {
  await cardDataPreferencesStore.whenReady();
  cardDataPreferencesStore.setValue({ pictureUrlTemplates: ['https://images.test/!set:uuid!.jpg'],
    setPreferences: new Map(), setLongNames: new Map() });
});

const ART_CROP_BY_NAME = 'https://api.scryfall.com/cards/named?exact=Island&format=image&version=art_crop';
const HOOF = '276f5cee-a501-4658-bd4d-7a044bf1ccbc';

it('shows the Scryfall art crop first, then the configured source and printing, then hides exhausted images', async () => {
  vi.spyOn(CardDTO, 'get').mockResolvedValue({ name: { value: 'Island' },
    set: [{ value: 'OLD', uuid: 'old' }, { value: 'NEW', uuid: 'preferred' }] } as CardDTO);
  const { container } = render(<PlaymatImage playmat={playmat} area={{ width: 300, height: 100 }} />);
  await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', ART_CROP_BY_NAME));
  fireEvent.error(container.querySelector('img')!);
  expect(container.querySelector('img')).toHaveAttribute('src', 'https://images.test/preferred.jpg');
  fireEvent.error(container.querySelector('img')!);
  expect(container.querySelector('img')).toHaveAttribute('src', 'https://images.test/old.jpg');
  fireEvent.error(container.querySelector('img')!);
  expect(container.querySelector('img')!.src).toContain('cards/named?exact=Island');
  fireEvent.error(container.querySelector('img')!);
  expect(container.querySelector('img')).toBeNull();
});

it('asks for the art crop of the announced printing when it is a Scryfall id', async () => {
  vi.spyOn(CardDTO, 'get').mockResolvedValue(undefined);
  const { container } = render(<PlaymatImage playmat={{ ...playmat, cardProviderId: HOOF }}
    area={{ width: 300, height: 100 }} />);
  await waitFor(() => expect(container.querySelector('img'))
    .toHaveAttribute('src', `https://api.scryfall.com/cards/${HOOF}?format=image&version=art_crop`));
  fireEvent.error(container.querySelector('img')!);
  expect(container.querySelector('img')).toHaveAttribute('src', ART_CROP_BY_NAME);
  fireEvent.error(container.querySelector('img')!);
  expect(container.querySelector('img')!.src).toContain(`cards/${HOOF}?format=image&version=large`);
});

it('frames an art crop to the area without rotating it, even for landscape cards', async () => {
  vi.spyOn(CardDTO, 'get').mockResolvedValue({ name: { value: 'Island' }, landscapeOrientation: { value: '1' },
    set: { value: 'NEW', uuid: 'preferred' } } as CardDTO);
  const { container } = render(<PlaymatImage playmat={{ ...playmat,
    params: { marginPctL: 0, marginPctR: 0, verticalOffset: 0.5, zoom: 1 } }} area={{ width: 1000, height: 300 }} />);
  await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', ART_CROP_BY_NAME));
  const img = container.querySelector('img')!;
  Object.defineProperties(img, { naturalWidth: { value: 600 }, naturalHeight: { value: 400 } });
  fireEvent.load(img);
  expect(img.style).toMatchObject({ left: '0px', width: '1000px' });
  expect(parseFloat(img.style.top)).toBeCloseTo(-110 * 1000 / 600);
  expect(parseFloat(img.style.height)).toBeCloseTo(400 * 1000 / 600);
  expect(img.style.transform).toBe('');
});

it('rotates the full image of a landscape card clockwise before applying crop coordinates', async () => {
  vi.spyOn(CardDTO, 'get').mockResolvedValue({ name: { value: 'Island' }, landscapeOrientation: { value: '1' },
    set: { value: 'NEW', uuid: 'preferred' } } as CardDTO);
  const { container } = render(<PlaymatImage playmat={{ ...playmat,
    params: { marginPctL: 0, marginPctR: 0, verticalOffset: 0, zoom: 1 } }} area={{ width: 1000, height: 300 }} />);
  await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', ART_CROP_BY_NAME));
  fireEvent.error(container.querySelector('img')!);
  const img = container.querySelector('img')!;
  Object.defineProperties(img, { naturalWidth: { value: 900 }, naturalHeight: { value: 600 } });
  fireEvent.load(img);
  expect(img.style).toMatchObject({ left: '1000px', top: '-350px', width: '1500px', height: '1000px',
    transform: 'rotate(90deg)', transformOrigin: '0 0' });
});

it('hides dimensions from the old image immediately when a fallback starts loading', async () => {
  vi.spyOn(CardDTO, 'get').mockResolvedValue({ name: { value: 'Island' },
    set: { value: 'NEW', uuid: 'preferred' } } as CardDTO);
  const { container } = render(<PlaymatImage playmat={playmat} area={{ width: 300, height: 100 }} />);
  await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
  const img = container.querySelector('img')!;
  Object.defineProperties(img, { naturalWidth: { value: 600 }, naturalHeight: { value: 900 } });
  fireEvent.load(img);
  expect(img.style.visibility).not.toBe('hidden');
  fireEvent.error(img);
  expect(container.querySelector('img')!.style.visibility).toBe('hidden');
});

it('honours the announced printing when several variants share a set code', async () => {
  vi.spyOn(CardDTO, 'get').mockResolvedValue({ name: { value: 'Island' },
    set: [{ value: 'SET', uuid: 'other' }, { value: 'SET', uuid: 'preferred' }] } as CardDTO);
  const { container } = render(<PlaymatImage playmat={playmat} area={{ width: 300, height: 100 }} />);
  await waitFor(() => expect(container.querySelector('img')).toHaveAttribute('src', ART_CROP_BY_NAME));
  fireEvent.error(container.querySelector('img')!);
  expect(container.querySelector('img')).toHaveAttribute('src', 'https://images.test/preferred.jpg');
});
