#!/usr/bin/env bash
# Start Metro bundler and wait for ready
# Exit 0 on success, 1 on failure

set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

METRO_TIMEOUT=60
METRO_PORT=8081

# Pre-checks
log "Checking Metro prerequisites..."

# Check port available
if port_in_use "$METRO_PORT"; then
  log_error "Port $METRO_PORT already in use"
  log_error "Run: ./dev/mcp-stop.sh"
  exit 1
fi

# Check yarn available
if ! command -v yarn &>/dev/null; then
  log_error "yarn not found - run from nix shell"
  exit 1
fi

# Start Metro
cd "$PROJECT_DIR"
start_daemon "metro" "yarn start" || {
  print_failure "metro"
  exit 1
}

# Wait for Metro to be ready
wait_for "Metro bundler" "$METRO_TIMEOUT" \
  "curl -sf http://127.0.0.1:${METRO_PORT}/status | grep -q packager-status:running" || {
  print_failure "metro"
  exit 1
}

# Final verification
verify_still_alive "metro" || {
  print_failure "metro"
  exit 1
}

log "Metro bundler started successfully"
exit 0
