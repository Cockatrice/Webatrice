// Canonical wire values for a card zone's name (ServerInfo_Card / ServerInfo_Zone
// `name`). Server-defined and stable — these are the Cockatrice protocol zone
// strings, so they live in the protocol layer and every consumer imports them
// from here.
export const ZoneName = {
  TABLE: 'table',
  GRAVE: 'grave',
  EXILE: 'rfg',
  HAND: 'hand',
  DECK: 'deck',
  SIDEBOARD: 'sb',
  STACK: 'stack',
} as const;

export type ZoneNameValue = (typeof ZoneName)[keyof typeof ZoneName];
