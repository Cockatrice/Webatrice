import i18n from 'i18next';
import ICU from 'i18next-icu';

import seatCardText from './SeatCard.i18n.json';
import { cardLabel, counterLetter } from './cardLabel';

const i18nInstance = i18n.createInstance();
void i18nInstance.use(ICU).init({
  lng: 'en-US',
  resources: { 'en-US': { translation: seatCardText } },
  interpolation: { escapeValue: false },
});
const t = i18nInstance.t;

describe('cardLabel', () => {
  it('is the card name alone for a plain card', () => {
    expect(cardLabel(t, { name: 'Llanowar Elves' })).toBe('Llanowar Elves');
  });

  it('reads out the state the board shows only in pictures', () => {
    expect(cardLabel(t, {
      name: 'Grizzly Bears',
      tapped: true,
      doesntUntap: true,
      attached: true,
      pt: '3/3',
      counters: [{ id: 0, value: 2 }, { id: 2, value: 1 }],
      annotation: 'blocking',
    })).toBe(
      'Grizzly Bears, tapped, doesn\'t untap, attached, power and toughness 3/3, 2 counters A, 1 counter C, note: blocking',
    );
  });

  it('names a face-down card by its id, as the board does', () => {
    expect(cardLabel(t, { name: '', id: '12', faceDown: true, pt: '2/2' })).toBe('Face-down card #12, power and toughness 2/2');
  });

  it('letters counters as the card menu does', () => {
    expect([0, 1, 5].map(counterLetter)).toEqual(['A', 'B', 'F']);
  });
});
