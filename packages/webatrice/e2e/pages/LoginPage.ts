import { expect, type Locator, type Page } from '@playwright/test';

// Page object for the Login screen (`/login`).
//
// The login home shows the selected server as one line with a "Change
// server" button (KnownHosts.tsx, summary variant) that opens the saved
// host list. The dialogs keep the field variant, whose trigger `<button>`
// is named by its visible "Host" caption. Saved hosts are a
// single-tab-stop `role="listbox"` of clickable `<li role="option">`s.
//
// The state-aware sign-in button reads "Sign in and play" only when it can
// be pressed; while the server is tested or the session opens it names the
// step instead, so `selectHost` waits for the enabled "Sign in and play". The registration dialog is a
// Tailwind DialogShell (portalled `role="dialog"` with `aria-modal`).

// Text used by the KnownHosts dropdown from KnownHosts.i18n.json.
const ADD_NEW_HOST_TEXT = /add new host/i;

export class LoginPage {
  constructor(private readonly page: Page) {}

  async goto(): Promise<void> {
    await this.page.goto('/login');
    // Wait for the login form's Host picker button to be attached; the
    // KnownHosts dropdown trigger is what marks the page as ready.
    await expect(this.hostPicker).toBeVisible();
  }

  get hostPicker(): Locator {
    return this.page.getByRole('button', { name: /^change server$/i }).first();
  }

  // Same lookup, but scoped to a specific dialog (registration form has
  // its OWN independent KnownHosts picker per RegisterForm.tsx).
  private hostPickerIn(scope: Page | Locator): Locator {
    return scope.getByRole('button', { name: 'Host', exact: true }).first();
  }

  private hostOption(scope: Page | Locator, label: string): Locator {
    return scope.getByRole('option').filter({
      has: this.page.locator('span.font-medium', { hasText: new RegExp(`^${label}$`, 'i') }),
    }).first();
  }

  get loginButton(): Locator {
    return this.page.getByRole('button', { name: /^sign in and play$/i });
  }

  get registerButton(): Locator {
    return this.page.getByRole('button', { name: /create an account/i });
  }

  async openHostPicker(scope: Page | Locator = this.page): Promise<void> {
    await (scope === this.page ? this.hostPicker : this.hostPickerIn(scope)).click();
  }

  async addHost(label: string, host: string, port: number): Promise<void> {
    await this.openHostPicker();
    const addHostTrigger = this.page.getByRole('button', { name: ADD_NEW_HOST_TEXT });
    await expect(addHostTrigger).toBeVisible();
    await addHostTrigger.click();

    // KnownHostDialog is a DialogShell portalled to <body> with
    // role="dialog" and aria-label="Add Known Host" (title interpolated
    // from KnownHostDialog.i18n.json — {mode} = add).
    const dialog = this.page.getByRole('dialog', { name: /add known host/i });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel(/host name/i).fill(label);
    await dialog.getByLabel(/host address/i).fill(host);
    await dialog.getByLabel(/^port$/i).fill(String(port));

    // KnownHostForm uses a single submit button labelled from i18n
    // (add mode → "Add", edit mode → "Save Changes"). Match by
    // form-level submit attribute so the label text drift doesn't
    // break us — same trick used for the register form below.
    const addBtn = dialog.locator('button[type="submit"]');
    await expect(addBtn).toBeEnabled();
    await addBtn.click();
    await expect(dialog).toBeHidden();
  }

  async selectHost(label: string): Promise<void> {
    await this.openHostPicker();
    const option = this.hostOption(this.page, label);
    await expect(option).toBeVisible();
    await option.click();
    await expect(this.loginButton).toBeEnabled({ timeout: 15_000 });
  }

  async login(username: string, password: string): Promise<void> {
    await this.page.getByLabel(/^username$/i).fill(username);
    await this.page.getByLabel(/^password$/i).fill(password);
    await this.loginButton.click();
  }

  async register(
    username: string,
    password: string,
    options: { email?: string; hostLabel?: string } = {},
  ): Promise<void> {
    await this.registerButton.click();
    // RegistrationDialog is a DialogShell (role="dialog") aria-labelled
    // "Registration" (RegistrationDialog.i18n.json → RegistrationDialog.title).
    // Match any dialog that contains the Register form's submit — the
    // stricter name lookup is redundant since we scope every field to
    // this container.
    const dialog = this.page.getByRole('dialog').filter({
      has: this.page.getByRole('button', { name: /^register$/i }),
    });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel(/^username$/i).fill(username);
    await dialog.getByLabel(/^password$/i).fill(password);
    await dialog.getByLabel(/confirm password/i).fill(password);

    if (options.email) {
      await dialog.getByLabel(/^email$/i).fill(options.email);
      await dialog.getByLabel(/confirm email/i).fill(options.email);
    }

    // RegisterForm mounts its own KnownHosts widget, but the "selected
    // host" state is shared through useKnownHostsComponent — whatever
    // the outer form picked (via `selectHost`) is already reflected on
    // the dialog's Host button. So: read the button's visible text; if
    // it already names the desired host, skip the dropdown entirely.
    // This is important because the dropdown menu is positioned
    // absolutely inside the DialogShell body and gets visually clipped
    // by the dialog's overflow, making the option unclickable.
    const picker = this.hostPickerIn(dialog);
    const pickerText = (await picker.innerText()).toLowerCase();
    const wantsHost = options.hostLabel?.toLowerCase();
    const alreadyPicked = wantsHost != null && pickerText.includes(wantsHost);
    if (!alreadyPicked) {
      await this.openHostPicker(dialog);
      const option = options.hostLabel
        ? this.hostOption(dialog, options.hostLabel)
        : dialog.getByRole('option').first();
      await expect(option).toBeVisible();
      await option.click();
    }

    // Register submit is a plain <button type="submit"> labelled from
    // i18n. Match by role name — there's exactly one enabled Register-
    // named button in the dialog once fields validate.
    const submit = dialog.getByRole('button', { name: /^register$/i });
    await expect(submit).toBeEnabled({ timeout: 15_000 });
    await submit.click();
  }
}
