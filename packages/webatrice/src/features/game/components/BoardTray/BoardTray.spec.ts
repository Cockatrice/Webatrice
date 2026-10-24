import { TRAY_DOCK_GAP_PX, TRAY_HAND_MIN_PX, trayKeepPx } from './BoardTray';

describe('trayKeepPx', () => {
  it('keeps everything but the flexible hand, plus a minimum hand and a gap before the chat dock', () => {
    expect(trayKeepPx({ trayWidth: 1000, paddingRight: 320, flexWidth: 200, hasHand: true }))
      .toBe(1000 - 320 - 200 + TRAY_HAND_MIN_PX + TRAY_DOCK_GAP_PX);
  });

  it('keeps only the fixed parts for a spectator, whose tray has no hand', () => {
    expect(trayKeepPx({ trayWidth: 1000, paddingRight: 8, flexWidth: 700, hasHand: false })).toBe(292 + TRAY_DOCK_GAP_PX);
  });
});
