import { expect, test } from '../fixtures/test';

import { registerAndJoinFirstRoom } from '../fixtures/flows';

interface Box { x: number; y: number; width: number; height: number }

const EDGE = 8;
const SPOTS = ['top-left', 'top', 'top-right', 'right', 'bottom-right', 'bottom', 'bottom-left', 'left'] as const;

test('a context menu stays in view and off its anchor at every edge and corner', async ({ page }) => {
  test.setTimeout(90_000);
  const { rooms, user } = await registerAndJoinFirstRoom(page);
  const name = await rooms.findPerson(user.username);
  const viewport = page.viewportSize()!;
  const menu = page.getByRole('menu');

  for (const spot of SPOTS) {
    await name.evaluate((element, [where, width, height]) => {
      for (let node = element.parentElement; node; node = node.parentElement) {
        Object.assign(node.style, { contain: 'none', transform: 'none', willChange: 'auto', overflow: 'visible', zIndex: 'auto' });
      }
      const box = element.getBoundingClientRect();
      const left = where.includes('left') ? 2 : where.includes('right') ? width - box.width - 2 : (width - box.width) / 2;
      const top = where.includes('top') ? 2 : where.includes('bottom') ? height - box.height - 2 : (height - box.height) / 2;
      Object.assign(element.style, { position: 'fixed', left: `${left}px`, top: `${top}px`, zIndex: '9000' });
    }, [spot, viewport.width, viewport.height] as const);
    const anchor = (await name.boundingBox())!;
    const expected = await name.evaluate((element) => ({ left: element.style.left, top: element.style.top }));
    expect(anchor.x, `pinned at ${spot}`).toBeCloseTo(parseFloat(expected.left), 0);
    expect(anchor.y, `pinned at ${spot}`).toBeCloseTo(parseFloat(expected.top), 0);

    for (const opener of ['right-click', 'Shift+F10'] as const) {
      let point: { x: number; y: number } | null = null;
      if (opener === 'right-click') {
        point = { x: Math.round(anchor.x + anchor.width / 2), y: Math.round(anchor.y + anchor.height / 2) };
        await page.mouse.click(point.x, point.y, { button: 'right' });
      } else {
        await name.focus();
        await page.keyboard.press('Shift+F10');
      }
      await expect(menu.getByRole('menuitem').first(), `${opener} at ${spot}`).toBeFocused();
      const box = (await menu.boundingBox())!;

      expect(box.x, `${opener} at ${spot}: left`).toBeGreaterThanOrEqual(0);
      expect(box.y, `${opener} at ${spot}: top`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${opener} at ${spot}: right`).toBeLessThanOrEqual(viewport.width);
      expect(box.y + box.height, `${opener} at ${spot}: bottom`).toBeLessThanOrEqual(viewport.height);

      const target: Box = point ? { ...point, width: 0, height: 0 } : anchor;
      const roomBelow = viewport.height - EDGE - (target.y + target.height);
      const roomAbove = target.y - EDGE;
      if (Math.max(roomBelow, roomAbove) >= box.height + 2) {
        const overlapsVertically = box.y < target.y + target.height && target.y < box.y + box.height;
        expect(overlapsVertically, `${opener} at ${spot}: covers its anchor`).toBe(false);
      }

      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
    }
  }
});
