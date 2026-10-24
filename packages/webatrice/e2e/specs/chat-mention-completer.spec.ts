import { expect, test } from '../fixtures/test';
import { registerAndJoinFirstRoom } from '../fixtures/flows';
import { randomSuffix } from '../fixtures/users';

test('completes an @mention in room chat from the keyboard', async ({ page }) => {
  const { user } = await registerAndJoinFirstRoom(page);

  const input = page.getByPlaceholder(/^Message /);
  await input.focus();
  const prefix = `@${user.username.slice(0, -1)}`;
  await page.keyboard.type(prefix);

  const suggestions = page.getByRole('listbox', { name: /mention suggestions/i });
  await expect(suggestions).toBeVisible();
  await expect(input).toHaveAttribute('aria-expanded', 'true');
  await expect(suggestions.getByRole('option', { name: `@${user.username}` })).toHaveAttribute('aria-selected', 'true');

  await page.keyboard.press('Escape');
  await expect(suggestions).toBeHidden();
  await expect(input).toHaveValue(prefix);

  await page.keyboard.press('Backspace');
  await page.keyboard.type(user.username.slice(-2, -1));
  await expect(suggestions).toBeVisible();
  await page.keyboard.press('Enter');
  await expect(suggestions).toBeHidden();
  await expect(input).toHaveValue(`@${user.username} `);

  const text = `hello-${randomSuffix()}`;
  await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await expect(input).toHaveValue('');
  await expect(page.getByText(new RegExp(text)).first()).toBeVisible();
});
