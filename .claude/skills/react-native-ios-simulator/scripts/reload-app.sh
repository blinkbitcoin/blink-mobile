#!/bin/bash
# Reload the JS of the app(s) connected to this session's Metro - the fast
# before/after flip.
#
# A checkout-flip changes only JS, so a dev-server reload (what pressing `r`
# in Metro's terminal does) replaces terminate + launch + splash: ~35s saved
# per flip. Unlike Fast Refresh, a full reload re-runs the JS entry point, so
# TEMP `initialRouteName` edits take effect - the exact case that used to
# force a cold relaunch.
#
# The mechanism is the dev server's /message websocket: a broadcast frame
# `{"version":2,"method":"reload"}` reaches every connected app. That
# broadcast *succeeds silently when no app is connected* (the "No apps
# connected" warning lands in Metro's stdout, not here), and a flip that
# silently didn't happen produces a before/after pair whose sides are
# identical - indistinguishable from "no visual change". So this script
# only trusts what it can observe: it watches the sibling /events websocket
# and exits 0 only after Metro reports the re-requested bundle was served
# (`bundle_build_done` - emitted for cache-hit serves too). Waiting for that
# event also closes the race where a screenshot's settle-wait declares the
# screen "settled" before the reload has torn it down.
#
# Talks to Metro only - platform-neutral, no simctl, works for Android flips
# unchanged. Dependency-free: the websocket client is python3 stdlib.
#
# Usage: reload-app.sh [--port P] [--timeout S] [--no-wait]
#   --port     defaults to $DEMO_PORT (from claim-session.sh); REQUIRED one
#              way or the other - a guessed port would reload the user's app
#   --timeout  seconds to wait for bundle confirmation (default 30,
#              env: RELOAD_TIMEOUT)
#   --no-wait  fire the broadcast and exit 0 without confirmation

set -euo pipefail

# Telemetry is best-effort - a broken lib must never block a reload.
TEL_LIB="$(dirname "${BASH_SOURCE[0]}")/../lib/telemetry.sh"
{ [ -f "$TEL_LIB" ] && . "$TEL_LIB"; } 2>/dev/null || true
type tel_emit >/dev/null 2>&1 || { tel_now() { echo 0; }; tel_emit() { :; }; tel_span() { while [ $# -gt 0 ] && [ "$1" != "--" ]; do shift; done; [ $# -gt 0 ] && shift; "$@"; }; }

die() { echo "FATAL: $*" >&2; exit 1; }

PORT="${DEMO_PORT:-}"
TIMEOUT="${RELOAD_TIMEOUT:-30}"
NO_WAIT=""

while [ $# -gt 0 ]; do
  case "$1" in
    --port)    PORT="${2:?--port needs a value}"; shift 2 ;;
    --timeout) TIMEOUT="${2:?--timeout needs a value}"; shift 2 ;;
    --no-wait) NO_WAIT=1; shift ;;
    *) die "unknown argument '$1' (usage: reload-app.sh [--port P] [--timeout S] [--no-wait])" ;;
  esac
done

# No default port, ever: 8081 is the user's Metro, and reloading whatever is
# connected there would yank the app out from under their live session.
[ -n "$PORT" ] || die "no port: eval claim-session.sh first (sets DEMO_PORT) or pass --port explicitly (a guessed port would reload the user's app on their 8081 bundler)"
case "$PORT" in
  ''|*[!0-9]*) die "port must be numeric, got '$PORT'" ;;
esac

T_RELOAD=$(tel_now)
RELOAD_RC=0
python3 - "$PORT" "$TIMEOUT" "${NO_WAIT:-0}" <<'PYEOF' || RELOAD_RC=$?
import base64, hashlib, json, os, socket, struct, sys, time

port, timeout, no_wait = int(sys.argv[1]), float(sys.argv[2]), sys.argv[3] == "1"


def ws_connect(path):
    """Minimal RFC 6455 client handshake; returns (socket, leftover bytes)."""
    s = socket.create_connection(("127.0.0.1", port), timeout=5)
    key = base64.b64encode(os.urandom(16)).decode()
    s.sendall((
        "GET %s HTTP/1.1\r\n"
        "Host: 127.0.0.1:%d\r\n"
        "Upgrade: websocket\r\n"
        "Connection: Upgrade\r\n"
        "Sec-WebSocket-Key: %s\r\n"
        "Sec-WebSocket-Version: 13\r\n\r\n" % (path, port, key)
    ).encode())
    buf = b""
    while b"\r\n\r\n" not in buf:
        chunk = s.recv(4096)
        if not chunk:
            raise ConnectionError("server closed during handshake on " + path)
        buf += chunk
    head, leftover = buf.split(b"\r\n\r\n", 1)
    status = head.split(b"\r\n", 1)[0]
    if b" 101" not in status:
        raise ConnectionError("handshake refused on %s: %s" % (path, status.decode(errors="replace")))
    return s, leftover


def masked_frame(opcode, payload):
    # Clients MUST mask (RFC 6455 5.1); a compliant server drops unmasked frames.
    mask = os.urandom(4)
    n = len(payload)
    if n < 126:
        head = bytes([0x80 | opcode, 0x80 | n])
    elif n < 65536:
        head = bytes([0x80 | opcode, 0x80 | 126]) + struct.pack(">H", n)
    else:
        head = bytes([0x80 | opcode, 0x80 | 127]) + struct.pack(">Q", n)
    return head + mask + bytes(b ^ mask[i % 4] for i, b in enumerate(payload))


def send_text(s, text):
    s.sendall(masked_frame(0x1, text.encode()))


def send_close(s):
    try:
        s.sendall(masked_frame(0x8, struct.pack(">H", 1000)))
        s.close()
    except OSError:
        pass


def parse_frame(buf):
    """One frame from buf -> (opcode, payload, rest), or None if incomplete."""
    if len(buf) < 2:
        return None
    opcode = buf[0] & 0x0F
    b2 = buf[1]
    n, off = b2 & 0x7F, 2
    if n == 126:
        if len(buf) < 4:
            return None
        n, off = struct.unpack(">H", buf[2:4])[0], 4
    elif n == 127:
        if len(buf) < 10:
            return None
        n, off = struct.unpack(">Q", buf[2:10])[0], 10
    if b2 & 0x80:  # a server frame should not be masked, but tolerate it
        if len(buf) < off + 4 + n:
            return None
        mask, payload = buf[off:off + 4], buf[off + 4:off + 4 + n]
        payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        rest = buf[off + 4 + n:]
    else:
        if len(buf) < off + n:
            return None
        payload, rest = buf[off:off + n], buf[off + n:]
    return opcode, payload, rest


def text_frames(s, leftover, deadline):
    """Yield text payloads from server frames until close, EOF or deadline."""
    buf = leftover
    s.settimeout(0.5)
    while time.time() < deadline:
        frame = parse_frame(buf)
        while frame:
            opcode, payload, buf = frame
            if opcode == 0x8:  # close
                return
            if opcode == 0x9:  # ping -> masked pong keeps the connection alive
                s.sendall(masked_frame(0xA, payload))
            elif opcode == 0x1:
                yield payload
            frame = parse_frame(buf)
        try:
            chunk = s.recv(4096)
        except socket.timeout:
            continue
        if not chunk:
            return
        buf += chunk


# Listener first: an event fired between "reload sent" and "listener open"
# would otherwise be missed and turn a successful flip into a timeout.
try:
    ev_sock, ev_leftover = ws_connect("/events")
    msg_sock, _ = ws_connect("/message")
except OSError as e:
    sys.stderr.write("FATAL: no Metro dev server on 127.0.0.1:%d (%s)\n" % (port, e))
    sys.exit(1)

# No "id", no "target": that is what makes the message socket treat this as a
# broadcast to every connected app (createMessageSocketEndpoint.isBroadcast).
send_text(msg_sock, json.dumps({"version": 2, "method": "reload"}))
send_close(msg_sock)

if no_wait:
    print("reload broadcast sent (unconfirmed: --no-wait)")
    send_close(ev_sock)
    sys.exit(0)

deadline = time.time() + timeout
for payload in text_frames(ev_sock, ev_leftover, deadline):
    try:
        event = json.loads(payload)
    except ValueError:
        continue
    etype = event.get("type", "")
    if etype == "bundle_build_done":
        print("reload confirmed: Metro served the bundle again")
        send_close(ev_sock)
        sys.exit(0)
    if etype == "bundle_build_failed":
        sys.stderr.write("FATAL: the reloaded bundle failed to build - fix the JS error and rerun\n")
        send_close(ev_sock)
        sys.exit(1)

sys.stderr.write(
    "FATAL: reload sent but no bundle request observed within %gs - "
    "no app may be connected to this Metro; fall back to terminate + launch\n" % timeout
)
send_close(ev_sock)
sys.exit(1)
PYEOF

# confirmed means the /events wait saw the bundle served; a --no-wait exit 0
# is fire-and-forget, so the no_wait flag keeps the two apart in reports.
tel_emit sim.reload.total "$T_RELOAD" port="$PORT" \
  confirmed="$([ "$RELOAD_RC" -eq 0 ] && echo 1 || echo 0)" \
  no_wait="$([ -n "$NO_WAIT" ] && echo 1 || echo 0)" \
  ok="$([ "$RELOAD_RC" -eq 0 ] && echo 1 || echo 0)"
exit "$RELOAD_RC"
