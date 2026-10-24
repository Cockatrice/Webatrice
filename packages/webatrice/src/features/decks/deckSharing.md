# Share link endpoints

New Webatrice links encode the live socket's complete `ws://` or `wss://` URL
in `hostname`, including its port, path and query. `port` is the effective
WebSocket port (443 for default WSS, 80 for default WS). Tokens remain in the
fragment. Matching uses that exact endpoint, not the selected known host.

Desktop links and older Webatrice links contain only a hostname and port.
To enable them, open the server's settings in the known-hosts picker and set
**Desktop port (optional)** to its Servatrice TCP port (1–65535), as provided
by the server operator. The setting is saved locally with the host in IndexedDB;
clearing it disables these links. Built-in hosts also expose this setting,
while keeping their address fields locked. No default host has a desktop port
configured: Webatrice does not infer TCP ports from WebSocket ports.

A desktop or legacy link opens only when its hostname matches the live socket's
hostname and its port matches `desktopPort` on the saved host whose WebSocket
endpoint matches that live connection. Selecting a different host does not
change this check. Saved hosts with paths follow Sockatrice's URL construction:
the address (including any explicit port) is used verbatim, with the separate
WebSocket port field used only for hosts without paths.

Without a configured desktop port, Webatrice refuses the link and explains how
to enable it. A different hostname or TCP port is refused. WebSocket links
continue to require the exact endpoint, including port, path, scheme and query;
the desktop-port setting cannot authorize a different WebSocket endpoint.
