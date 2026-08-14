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
#   release_metro_port <registry> <port> <owner>   -> frees it if still ours
#   reserve_slot <registry> <namespace> <name> <owner>  -> 0 won, 1 taken
#   release_slot <registry> <namespace> <name> <owner>
#
# `owner` is the session's stable label (the iOS device name, the Android
# session name) - the same string release checks before freeing anything.

# Reserve one Metro port. Deterministic starting point per seed (so re-runs are
# stable), then walk upward. mkdir is atomic on every filesystem we care about:
# whoever creates the directory owns the port. 8081 is never in range - that is
# the user's Metro.
reserve_metro_port() {
  local registry="${1:?reserve_metro_port needs a registry}"
  local owner="${2:?reserve_metro_port needs an owner}"
  local seed="${3:?reserve_metro_port needs a numeric seed}"
  local base=$((8100 + (seed % 400)))
  local candidate stale_pid
  mkdir -p "$registry/ports" 2>/dev/null || true
  for offset in $(seq 0 60); do
    candidate=$((base + offset))
    [ "$candidate" -eq 8081 ] && continue
    if mkdir "$registry/ports/$candidate" 2>/dev/null; then
      echo "$owner" > "$registry/ports/$candidate/owner"
      # Re-check after winning the reservation: another process outside this
      # registry (a stray Metro, an unrelated dev server) may already hold it.
      if lsof -nP -iTCP:"$candidate" -sTCP:LISTEN >/dev/null 2>&1; then
        rm -rf "$registry/ports/$candidate"
        continue
      fi
      echo "$candidate"; return 0
    fi
    # Reclaim a reservation whose owning session no longer exists - but only
    # ever our own: another session's dead-looking reservation is not ours to
    # judge.
    stale_pid=$(cat "$registry/ports/$candidate/metro.pid" 2>/dev/null || echo "")
    if [ -n "$stale_pid" ] && ! kill -0 "$stale_pid" 2>/dev/null; then
      if [ "$(cat "$registry/ports/$candidate/owner" 2>/dev/null)" = "$owner" ]; then
        echo "$candidate"; return 0
      fi
    fi
  done
  echo "FATAL: no free port in $base..$((base + 60))" >&2
  return 1
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
