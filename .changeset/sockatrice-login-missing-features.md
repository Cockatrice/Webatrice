---
'@cockatrice/sockatrice': patch
---

`ISessionResponse.loginSuccessful` receives the server's `missingFeatures` (Response_Login.missing_features): the features the server supports that the client did not list in `clientfeatures`. Desktop uses it to tell the user a newer client may be available.
