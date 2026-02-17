#!/usr/bin/env bash
# Start Android emulator and wait for boot
# Exit 0 on success, 1 on failure

set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

EMULATOR_TIMEOUT=180

# Pre-checks
log "Checking emulator prerequisites..."

# Check AVD exists
if ! emulator -list-avds 2>/dev/null | grep -q "^${AVD_NAME}$"; then
  log_error "AVD '$AVD_NAME' not found"
  log_error "Available AVDs:"
  emulator -list-avds 2>/dev/null || echo "  (none)"
  exit 1
fi

# Check if emulator already running
if adb devices 2>/dev/null | grep -q "emulator-5554"; then
  log "Emulator already running, checking boot status..."
  if adb shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then
    log "Emulator already booted and ready"
    exit 0
  else
    log_error "Emulator running but not booted, please restart"
    exit 1
  fi
fi

# Start emulator
cd "$PROJECT_DIR"
start_daemon "emulator" "emulator -avd $AVD_NAME -gpu swiftshader -no-window -wipe-data -no-boot-anim" || {
  print_failure "emulator"
  exit 1
}

# Wait for device to appear
log "Waiting for adb device..."
if ! timeout 60 adb wait-for-device; then
  log_error "Timeout waiting for adb device"
  print_failure "emulator"
  exit 1
fi

# Wait for boot completion
wait_for "emulator boot" "$EMULATOR_TIMEOUT" \
  "adb shell getprop sys.boot_completed 2>/dev/null | grep -q 1" || {
  print_failure "emulator"
  exit 1
}

# Final verification
verify_still_alive "emulator" || {
  print_failure "emulator"
  exit 1
}

log "Emulator started successfully"
exit 0
