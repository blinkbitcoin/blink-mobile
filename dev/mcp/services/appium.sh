#!/usr/bin/env bash
# Start Appium server and wait for ready
# Exit 0 on success, 1 on failure

set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

APPIUM_TIMEOUT=30
APPIUM_PORT=4723

# Pre-checks
log "Checking Appium prerequisites..."

# Check port available
if port_in_use "$APPIUM_PORT"; then
  log_error "Port $APPIUM_PORT already in use"
  log_error "Run: ./dev/mcp-stop.sh"
  exit 1
fi

# Check emulator is running (Appium needs it)
if ! adb devices 2>/dev/null | grep -q "emulator"; then
  log_error "No emulator connected - start emulator first"
  exit 1
fi

# Ensure UiAutomator2 driver is installed
log "Checking UiAutomator2 driver..."
if ! yarn appium driver list --installed 2>&1 | grep -q "uiautomator2"; then
  log "Installing UiAutomator2 driver..."
  yarn appium driver install uiautomator2 || {
    log_error "Failed to install UiAutomator2 driver"
    exit 1
  }
fi

# Start Appium
cd "$PROJECT_DIR"
start_daemon "appium" "yarn appium --relaxed-security" || {
  print_failure "appium"
  exit 1
}

# Wait for Appium to be ready
wait_for "Appium server" "$APPIUM_TIMEOUT" \
  "curl -sf http://127.0.0.1:${APPIUM_PORT}/status" || {
  print_failure "appium"
  exit 1
}

# Final verification
verify_still_alive "appium" || {
  print_failure "appium"
  exit 1
}

log "Appium server started successfully"
exit 0
