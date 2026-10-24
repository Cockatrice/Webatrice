import { scrollFades } from './useScrollFades';

describe('scrollFades', () => {
  it('shows no fade when everything fits', () => {
    expect(scrollFades({ scrollLeft: 0, clientWidth: 500, scrollWidth: 500 })).toEqual({ start: false, end: false });
  });

  it('fades the end while more tabs wait to the right', () => {
    expect(scrollFades({ scrollLeft: 0, clientWidth: 500, scrollWidth: 900 })).toEqual({ start: false, end: true });
  });

  it('fades both ends in the middle and only the start at the far end', () => {
    expect(scrollFades({ scrollLeft: 200, clientWidth: 500, scrollWidth: 900 })).toEqual({ start: true, end: true });
    expect(scrollFades({ scrollLeft: 400, clientWidth: 500, scrollWidth: 900 })).toEqual({ start: true, end: false });
  });

  it('ignores sub-pixel scroll offsets', () => {
    expect(scrollFades({ scrollLeft: 0.5, clientWidth: 500, scrollWidth: 500.5 })).toEqual({ start: false, end: false });
  });
});
