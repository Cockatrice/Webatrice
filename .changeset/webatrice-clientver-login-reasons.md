---
'@cockatrice/webatrice': patch
---

Identify the real Webatrice build to Servatrice and explain two login rejections.

`Command_Login.clientver` was the hard-coded `webclient-1.0 (2019-10-31)`. It is now built like desktop's VERSION_STRING from the package version and last commit date (for example `webatrice-5.3.0 (2026-10-03)`).

When a server refuses a login because an administrator reset the password (`RespPasswordChangeRequired`) or because it is full (`RespServerFull`), the login screen now shows a translated explanation instead of the generic status line. Servatrice refuses every login while a password change is pending and only a forgot-password reset clears it, so that explanation sends the user to Forgot Password and offers a button that opens it.
