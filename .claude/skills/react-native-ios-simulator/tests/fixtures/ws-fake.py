#!/usr/bin/env python3
"""Fake Metro dev-server websocket endpoints for reload-app.sh tests.

Serves /message and /events like @react-native-community/cli-server-api does,
records what the client actually sent, and emits events per FAKE_WS_MODE:

  bundle-done   after a reload broadcast arrives on /message, emit
                bundle_build_started then bundle_build_done on /events
  silent        never emit anything on /events (models "no app connected")
  bundle-fail   emit bundle_build_failed instead

Env:
  FAKE_WS_PORT_FILE  where to write the chosen port (bound on 127.0.0.1:0)
  FAKE_WS_LOG        append-only observation log the assertions read:
                       connect <path>
                       frame path=<path> masked=<0|1> payload=<raw json>
  FAKE_WS_MODE       see above (default bundle-done)

Enforces what the real `ws` server enforces where it matters for the tests:
frame contents and mask bits are *recorded* rather than rejected, so a
non-compliant client shows up as a red assertion instead of a hang.
"""
import base64
import hashlib
import json
import os
import socket
import struct
import sys
import threading
import time

GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
MODE = os.environ.get("FAKE_WS_MODE", "bundle-done")
LOG = os.environ["FAKE_WS_LOG"]
PORT_FILE = os.environ["FAKE_WS_PORT_FILE"]

log_lock = threading.Lock()
reload_seen = threading.Event()


def log(line):
    with log_lock:
        with open(LOG, "a") as f:
            f.write(line + "\n")


def text_frame(payload_text):
    data = payload_text.encode()
    n = len(data)
    if n < 126:
        head = bytes([0x81, n])
    else:
        head = bytes([0x81, 126]) + struct.pack(">H", n)
    return head + data


def read_exact(conn, n):
    buf = b""
    while len(buf) < n:
        chunk = conn.recv(n - len(buf))
        if not chunk:
            raise ConnectionError("client closed")
        buf += chunk
    return buf


def read_frame(conn):
    head = read_exact(conn, 2)
    opcode = head[0] & 0x0F
    masked = bool(head[1] & 0x80)
    n = head[1] & 0x7F
    if n == 126:
        n = struct.unpack(">H", read_exact(conn, 2))[0]
    elif n == 127:
        n = struct.unpack(">Q", read_exact(conn, 8))[0]
    mask = read_exact(conn, 4) if masked else b""
    payload = read_exact(conn, n)
    if masked:
        payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
    return opcode, masked, payload


def handshake(conn):
    buf = b""
    while b"\r\n\r\n" not in buf:
        chunk = conn.recv(4096)
        if not chunk:
            raise ConnectionError("client closed during handshake")
        buf += chunk
    head = buf.split(b"\r\n\r\n", 1)[0].decode(errors="replace")
    request_line = head.split("\r\n")[0]
    path = request_line.split(" ")[1]
    key = ""
    for line in head.split("\r\n")[1:]:
        if line.lower().startswith("sec-websocket-key:"):
            key = line.split(":", 1)[1].strip()
    accept = base64.b64encode(hashlib.sha1((key + GUID).encode()).digest()).decode()
    conn.sendall(
        (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            "Sec-WebSocket-Accept: %s\r\n\r\n" % accept
        ).encode()
    )
    return path


def handle(conn):
    try:
        path = handshake(conn)
        log("connect %s" % path)
        if path == "/events":
            # The real events socket pushes reporter events; it never needs to
            # read. Emit per mode once a reload broadcast has been observed.
            if MODE in ("bundle-done", "bundle-fail"):
                if reload_seen.wait(timeout=20):
                    time.sleep(0.1)
                    conn.sendall(text_frame(json.dumps({"type": "bundle_build_started"})))
                    if MODE == "bundle-done":
                        conn.sendall(text_frame(json.dumps({"type": "bundle_build_done"})))
                    else:
                        conn.sendall(text_frame(json.dumps({"type": "bundle_build_failed"})))
            # silent mode: hold the connection open, send nothing
            while True:
                opcode, _, _ = read_frame(conn)
                if opcode == 0x8:
                    break
        else:
            while True:
                opcode, masked, payload = read_frame(conn)
                if opcode == 0x8:
                    break
                if opcode == 0x1:
                    log("frame path=%s masked=%d payload=%s" % (path, int(masked), payload.decode(errors="replace")))
                    try:
                        if json.loads(payload.decode()).get("method") == "reload":
                            reload_seen.set()
                    except ValueError:
                        pass
    except (ConnectionError, OSError):
        pass
    finally:
        conn.close()


def main():
    server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    server.bind(("127.0.0.1", 0))
    server.listen(8)
    with open(PORT_FILE, "w") as f:
        f.write(str(server.getsockname()[1]))
    while True:
        conn, _ = server.accept()
        threading.Thread(target=handle, args=(conn,), daemon=True).start()


if __name__ == "__main__":
    main()
