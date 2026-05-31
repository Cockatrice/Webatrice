import { expect, type Locator, type Page } from '@playwright/test';

// Page object for the Login screen (`/login`).
//
// Wraps the quirks documented in `e2e/specs/login-join-room.spec.ts`:
//   1. The KnownHosts Add-Host trigger lives inside the MUI Select's
//      portalled `<ul role="listbox">`. Chromium prunes non-option
//      descendants from the accessibility tree, so `getByRole('button')`
//      cannot find it — locate by visible text instead.
//   2. The Add-Host dialog itself is a real `role="dialog"`; the listbox
//      uses `role=listbox/presentation`, so dialog role lookups remain
//      unambiguous.
//   3. The Login form's Login button is disabled until the test-connection
//      probe succeeds. `selectHost` waits for that.
//   4. The Register flow opens the Registration dialog from the Login
//      footer ("Create an account" button); the dialog hosts a second
//      KnownHosts picker so callers may need to call `selectHost` again
//      inside the dialog.

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await expect(this.hostPicker).toBeVisible();
  }

  get hostPicker(): Locator {
    return this.page.getByRole('combobox', { name: /host/i });
  }

  get loginButton(): Locator {
    return this.page.getByRole('button', { name: /^login$/i });
  }

  get registerButton(): Locator {
    return this.page.getByRole('button', { name: /create an account/i });
  }

  async openHostPicker(): Promise<void> {
    await this.hostPicker.click();
  }

  async addHost(label: string, host: string, port: number): Promise<void> {
    await this.openHostPicker();
    const addHostTrigger = this.page.locator('button', { hasText: /add new host/i });
    await expect(addHostTrigger).toBeVisible();
    await addHostTrigger.click();

    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/host name/i).fill(label);
    await dialog.getByLabel(/host address/i).fill(host);
    await dialog.getByLabel(/port/i).fill(String(port));

    // Submit lives inside a <form> in a dialog that also hosts a Select; per
    // [[feedback_mui-select-role-pruning]], `getByRole('button')` returns
    // zero hits in that subtree because Chromium prunes the accessibility
    // tree. Locate via the form's submit attribute instead — robust against
    // both a11y pruning and i18n drift (label is "Add Host" today).
    const addBtn = dialog.locator('button[type="submit"]');
    await expect(addBtn).toBeEnabled();
    await addBtn.click();
    await expect(dialog).toBeHidden();
  }

  async selectHost(label: string): Promise<void> {
    await this.openHostPicker();
    const option = this.page.getByRole('option', { name: new RegExp(label, 'i') });
    await expect(option).toBeVisible();
    await option.click();
    await expect(this.loginButton).toBeEnabled({ timeout: 15_000 });
  }

  async login(username: string, password: string): Promise<void> {
    await this.page.getByLabel(/^username$/i).fill(username);
    await this.page.getByLabel(/^password$/i).fill(password);
    await this.loginButton.click();
  }

  async register(username: string, password: string, email?: string): Promise<void> {
    await this.registerButton.click();
    const dialog = this.page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/^username$/i).fill(username);
    await dialog.getByLabel(/^password$/i).fill(password);
    await dialog.getByLabel(/confirm password/i).fill(password);

    if (email) {
      await dialog.getByLabel(/^email$/i).fill(email);
      await dialog.getByLabel(/confirm email/i).fill(email);
    }

    // RegisterForm has its OWN KnownHosts picker that does not inherit the
    // outer LoginForm selection (see RegisterForm.tsx defaultValues:
    // `selectedHost: undefined`). Re-pick the first available host so the
    // register call has a target. The listbox also contains an "Add new
    // host" Button on top; we skip it by selecting the first
    // role="option" (MenuItem) in the open listbox.
    const dialogHostPicker = dialog.getByRole('combobox', { name: /host/i });
    await dialogHostPicker.click();
    const option = this.page.getByRole('listbox').getByRole('option').first();
    await expect(option).toBeVisible();
    await option.click();

    // Same a11y-pruning trap as `addHost` — RegisterForm wraps its submit in
    // a <form> that also hosts Country + Host Selects, so `getByRole('button')`
    // returns nothing. Locate via the form's submit attribute.
    const submit = dialog.locator('button[type="submit"]');
    await expect(submit).toBeEnabled({ timeout: 15_000 });
    await submit.click();
  }

}
