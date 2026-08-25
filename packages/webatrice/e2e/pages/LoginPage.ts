import { expect, type Locator, type Page } from '@playwright/test';

// Page object for the Login screen (`/login`).
//
// The Tailwind rewrite replaced the MUI Select KnownHosts picker with a
// custom dropdown built from a trigger `<button>` (accessible-named via
// aria-labelledby against the visible "Host" caption) plus refresh and
// chevron buttons in a non-label wrapper (KnownHosts.tsx). No
// `role="combobox"`, no `role="option"` — options are plain `<div>` rows
// with click handlers.
//
// Login button + Register button both still resolve by role/name. The
// login button remains disabled until the test-connection probe reports
// `success`; `selectHost` waits for that. The registration dialog is a
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

  // The KnownHosts trigger is a <button> whose accessible name is the
  // visible "Host" caption (wired via aria-labelledby in KnownHosts.tsx),
  // so we can locate it by role + exact name. `exact` guards against
  // "Host Name" / "Host Address" field labels in KnownHostDialog.
  get hostPicker(): Locator {
    return this.hostPickerIn(this.page);
  }

  // Same lookup, but scoped to a specific dialog (registration form has
  // its OWN independent KnownHosts picker per RegisterForm.tsx).
  private hostPickerIn(scope: Page | Locator): Locator {
    return scope.getByRole('button', { name: 'Host', exact: true }).first();
  }

  get loginButton(): Locator {
    return this.page.getByRole('button', { name: /^login$/i });
  }

  get registerButton(): Locator {
    return this.page.getByRole('button', { name: /create an account/i });
  }

  async openHostPicker(scope: Page | Locator = this.page): Promise<void> {
    await this.hostPickerIn(scope).click();
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
    // Dropdown options are plain <div class="group ...">s (no role). Each
    // row renders the host name and address in adjacent <span>s inside a
    // wrapping <span class="flex-1 min-w-0 truncate"> — the two collapse
    // to one textContent like "e2elocalhost:4748" (no separator). Match
    // the row by the dedicated `<span class="font-medium">{host.name}</span>`
    // so an anchored equality on the host name doesn't collide with the
    // address, and no word-boundary tricks are needed.
    const option = this.page.locator('div.group', {
      has: this.page.locator('span.font-medium', { hasText: new RegExp(`^${label}$`, 'i') }),
    });
    await expect(option.first()).toBeVisible();
    await option.first().click();
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
        ? dialog.locator('div.group', {
          has: dialog.locator('span.font-medium', {
            hasText: new RegExp(`^${options.hostLabel}$`, 'i'),
          }),
        }).first()
        : dialog.locator('div.group').first();
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
