import { ZoneName } from '@cockatrice/sockatrice';

import { catalogT } from '../../__test-utils__/catalogT';
import catalog from './zoneLabels.i18n.json';
import { ZONE_LABEL_KEYS, zoneLabel } from './zoneLabels';

const t = catalogT(catalog);

describe('zoneLabel', () => {
  it('names every wire zone, alone or inside a sentence', () => {
    expect(Object.keys(ZONE_LABEL_KEYS).sort()).toEqual(Object.values(ZoneName).sort());
    expect(zoneLabel(t, ZoneName.GRAVE)).toBe('Graveyard');
    expect(zoneLabel(t, ZoneName.EXILE)).toBe('Exile');
    expect(zoneLabel(t, ZoneName.DECK)).toBe('Library');
    expect(zoneLabel(t, ZoneName.DECK, 'inline')).toBe('library');
    expect(zoneLabel(t, ZoneName.SIDEBOARD, 'inline')).toBe('sideboard');
    expect(zoneLabel(t, ZoneName.TABLE)).toBe('Battlefield');
  });

  it('shows an unknown zone by its wire name, and no zone as nothing', () => {
    expect(zoneLabel(t, 'command')).toBe('command');
    expect(zoneLabel(t, undefined)).toBe('');
  });
});
