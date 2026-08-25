---
'@cockatrice/webatrice': patch
---

Fix: adding a new host no longer auto-logs you in.

Dialogs portal to `document.body`, but React dispatches synthetic `submit` events along the React component tree, not the DOM tree. Because the Add-Host dialog (`KnownHostForm`) renders inside the Login form's React subtree, clicking **Add Host** bubbled its submit up to the Login form's `onSubmit`, which — with a saved-password host selected and the password field empty — injected the stored `hashedPassword` and logged the user in.

`DialogShell` now stops `submit` propagation at the portal root, containing every dialog form's submit at the modal boundary so it can never reach a form on the page behind it. Added a regression spec asserting an inner dialog-form submit does not fire an ancestor form's `onSubmit`.
