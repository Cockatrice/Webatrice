---
'@cockatrice/webatrice': minor
---

Account self-service, server discovery and navigation now match desktop:

- The Account page's Edit, Change Password and Change Avatar buttons open working dialogs
  (desktop `DlgEditUser`, `DlgEditPassword`, `DlgEditAvatar`). Edits re-fetch your own record, ask
  for your current password only when a hash-capable server needs it to change your email, and show
  desktop's message for each refusal (or the timed-out / connection-lost reason when the server never
  answered) while keeping what you typed. Avatars are downscaled to
  1024 px and re-encoded as JPEG under Servatrice's 2 MB limit; confirming with no image removes yours.
- Activating an account now logs you in afterwards with the password you registered or logged in
  with, held in memory only until activation finishes or is cancelled. An activation that times out or
  loses its connection says so instead of reporting a rejected token.
- The host picker lists Cockatrice's public servers (the list desktop downloads), with a refresh
  button and an offline fallback to the last download. Saved hosts are never overwritten. A picked
  server is saved as `host/servatrice` on port 443 and dials `wss://host/servatrice`, the endpoint
  desktop opens on that port; servers without a WebSocket port on 443 are shown disabled as
  desktop-only, since desktop reaches any other WebSocket port over plain `ws://`, which an https page
  cannot open.
- The user menu reaches Account, Settings, Shortcuts, Logs (moderators and developers) and card
  import. Developers who are not moderators search the logs through the developer command family,
  without the IP filter and Private Chat, as on desktop. Its
  entries come from one list in `userMenuEntries.ts`, so new destinations are a one-line addition.
  The unused LeftNav was removed.
