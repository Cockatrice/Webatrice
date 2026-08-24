/**
 * Safely terminate a WebSocket without abruptly aborting a still-`CONNECTING`
 * one.
 *
 * `close()` on a `CONNECTING` socket *fails* the WebSocket connection — the peer
 * observes an abnormal 1006, not a clean 1000, with no close frame / prompt FIN.
 * A reverse proxy that byte-tunnels or terminates the upgraded connection then
 * holds the half-dead upstream open until its idle read timeout (~60s), and that
 * upstream counts against Servatrice's per-IP connection cap
 * (`security/max_users_per_address`). Repeated aborts pile up and get the client
 * refused with `TOO_MANY_CONNECTIONS`.
 *
 * So: if the socket is still `CONNECTING`, defer a clean `close()` until it opens
 * (arming `onopen`); if it is already `OPEN`, close cleanly now; if it is already
 * `CLOSING`/`CLOSED`, do nothing. A socket that never opens (a genuinely stuck /
 * refused connect) established nothing to strand, so the deferred close simply
 * never fires — that case must be abandoned by the caller's own connect timeout,
 * not here.
 *
 * This overwrites `onopen`. A caller retiring a socket it no longer owns (e.g.
 * superseding it) must first detach any other lifecycle handlers whose side
 * effects should not run for the orphan — this helper owns only the close timing.
 */
export function terminateSocket(socket: WebSocket): void {
  if (socket.readyState === WebSocket.CONNECTING) {
    socket.onopen = () => socket.close();
    return;
  }
  if (socket.readyState === WebSocket.OPEN) {
    socket.close();
  }
}
