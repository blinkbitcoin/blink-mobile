# Machine-wide reservations shared by every demo session, on every platform.
# Source this; never execute it.
#
# The registry is the one place that knows which Metro ports, emulator console
# ports and AVDs are spoken for. It has to be shared across platforms: an iOS
# session on 8192 and an Android session on 8192 is exactly the collision the
# registry exists to prevent, and two implementations of "reserve a port" would
# be two chances to get the atomicity wrong.
#
# Unlike lib/telemetry.sh, this lib is load-bearing: a caller that cannot source
# it must fail loudly rather than degrade, because an unreserved port is a
# session that silently steals another agent's bundler.
#
#   reserve_metro_port <registry> <owner> <seed>   -> echoes the port, or fails
#   reclaim_metro_port <registry> <owner> <port>   -> 0 re-taken, 1 held by another
#   release_metro_port <registry> <port> <owner>   -> frees it if still ours
#   reserve_slot <registry> <namespace> <name> <owner>  -> 0 won, 1 taken
#   release_slot <registry> <namespace> <name> <owner>
#
# `owner` is the session's stable label (the iOS device name, the Android
# session name) - the same string release checks before freeing anything.

# port_listeners <port>: the PIDs listening on it (one per line), or nothing.
# The one place that asks "is this port busy"; every reservation path uses it.
port_listeners() {
  lsof -nP -t -iTCP:"$1" -sTCP:LISTEN 2>/dev/null || true
}

# foreign_listener <registry> <owner> <port>: 0 when something other than the
# owner's own Metro listens on the port. The owner's session dir is keyed by
# the same label; its metro.pid vouches only if that PID is itself one of the
# listeners - a merely alive metro.pid (a recycled PID) proves nothing.
foreign_listener() {
  local pids own
  pids=$(port_listeners "$3")
  [ -n "$pids" ] || return 1
  own=$(cat "$1/$2/metro.pid" 2>/dev/null || echo "")
  [ -n "$own" ] && printf '%s\n' "$pids" | grep -qx "$own" && return 1
  return 0
}

# Reserve one Metro port. Deterministic starting point per seed (so re-runs are
# stable), then walk upward. mkdir is atomic on every filesystem we care about:
# whoever creates the directory owns the port. 8081 is never in range - that is
# the user's Metro.
reserve_metro_port() {
  local registry="${1:?reserve_metro_port needs a registry}"
  local owner="${2:?reserve_metro_port needs an owner}"
  local seed="${3:?reserve_metro_port needs a numeric seed}"
  local base=$((8100 + (seed % 400)))
  local candidate
  mkdir -p "$registry/ports" 2>/dev/null || true
  for offset in $(seq 0 60); do
    candidate=$((base + offset))
    [ "$candidate" -eq 8081 ] && continue
    if mkdir "$registry/ports/$candidate" 2>/dev/null; then
      echo "$owner" > "$registry/ports/$candidate/owner"
      # Re-check after winning the reservation: another process outside this
      # registry (a stray Metro, an unrelated dev server) may already hold it.
      if [ -n "$(port_listeners "$candidate")" ]; then
        rm -rf "$registry/ports/$candidate"
        continue
      fi
      echo "$candidate"; return 0
    fi
    # A reservation this owner already holds is ours to reuse, whether or not
    # Metro ever started on it - otherwise a claim that died before recording
    # its port leaks the reservation forever. Another session's reservation is
    # never ours to judge.
    # Still re-checked for a listener: an orphaned reservation's port may
    # have been taken by an unrelated server since.
    if [ "$(cat "$registry/ports/$candidate/owner" 2>/dev/null)" = "$owner" ]; then
      if foreign_listener "$registry" "$owner" "$candidate"; then
        rm -rf "$registry/ports/$candidate"   # ours, but unusable: free it, move on
        continue
      fi
      echo "$candidate"; return 0
    fi
  done
  echo "FATAL: no free port in $base..$((base + 60))" >&2
  return 1
}

# Re-take a specific port a session recorded earlier: 0 if it is (again) ours,
# 1 if another session or an outside process holds it now. Release frees the
# reservation while the session dir keeps its port file for retakes, so the
# file alone never proves ownership.
reclaim_metro_port() {
  local registry="${1:?}" owner="${2:?}" port="${3:-}"
  case "$port" in ''|*[!0-9]*) return 1 ;; esac
  if [ "$(cat "$registry/ports/$port/owner" 2>/dev/null)" = "$owner" ]; then
    if foreign_listener "$registry" "$owner" "$port"; then
      rm -rf "$registry/ports/$port"   # ours, but unusable: free it before moving on
      return 1
    fi
    return 0
  fi
  mkdir -p "$registry/ports" 2>/dev/null || true
  mkdir "$registry/ports/$port" 2>/dev/null || return 1
  echo "$owner" > "$registry/ports/$port/owner"
  if [ -n "$(port_listeners "$port")" ]; then
    rm -rf "$registry/ports/$port"
    return 1
  fi
  return 0
}

release_metro_port() {
  local registry="${1:?}" port="${2:-}" owner="${3:?}"
  [ -n "$port" ] || return 0
  if [ "$(cat "$registry/ports/$port/owner" 2>/dev/null)" = "$owner" ]; then
    rm -rf "$registry/ports/$port"
  fi
  return 0
}

# Reserve a named slot (an emulator console port, an AVD). Same atomic-mkdir
# rule; the caller loops over candidates when it wants "any free one".
reserve_slot() {
  local registry="${1:?}" ns="${2:?}" name="${3:?}" owner="${4:?}"
  mkdir -p "$registry/$ns" 2>/dev/null || true
  if mkdir "$registry/$ns/$name" 2>/dev/null; then
    echo "$owner" > "$registry/$ns/$name/owner"
    return 0
  fi
  # An idempotent re-claim by the same owner is not a collision.
  [ "$(cat "$registry/$ns/$name/owner" 2>/dev/null)" = "$owner" ] && return 0
  return 1
}

release_slot() {
  local registry="${1:?}" ns="${2:?}" name="${3:?}" owner="${4:?}"
  if [ "$(cat "$registry/$ns/$name/owner" 2>/dev/null)" = "$owner" ]; then
    rm -rf "$registry/$ns/$name"
  fi
  return 0
}
