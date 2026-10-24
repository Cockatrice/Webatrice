import type { Locator, Page } from '@playwright/test';

export async function tabTo(page: Page, target: Locator, maxPresses = 60): Promise<void> {
  await target.waitFor();
  for (let i = 0; i < maxPresses; i++) {
    const { position, onCard } = await target.evaluate((element) => {
      const active = document.activeElement;
      const card = active?.closest('[data-game-board] [role="option"], [data-testid="board-tray"] [role="option"]') != null;
      if (element === active) {
        return { position: 'focused', onCard: card };
      }
      if (!active || active === document.body) {
        return { position: 'after', onCard: card };
      }
      const before = active.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_PRECEDING;
      return { position: before ? 'before' : 'after', onCard: card };
    });
    if (position === 'focused') {
      return;
    }
    const key = onCard ? 'F6' : 'Tab';
    await page.keyboard.press(position === 'before' ? `Shift+${key}` : key);
  }
  throw new Error(`Tab never reached ${target}`);
}
