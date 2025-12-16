#!/usr/bin/env bash
# Install and launch the Blink app
# Exit 0 on success, 1 on failure

set -euo pipefail
source "$(dirname "$0")/../lib/common.sh"

INSTALL_TIMEOUT=30

# Pre-checks
log "Checking app prerequisites..."

# Check APK exists
if [[ ! -f "$APK_PATH" ]]; then
  log_error "APK not found: $APK_PATH"
  log_error "Build with: cd android && ./gradlew assembleDebug"
  exit 1
fi

# Check emulator is connected
if ! adb devices 2>/dev/null | grep -q "emulator"; then
  log_error "No emulator connected"
  exit 1
fi

# Check emulator is booted
if ! adb shell getprop sys.boot_completed 2>/dev/null | grep -q "1"; then
  log_error "Emulator not fully booted"
  exit 1
fi

# Install app
log "Installing app from $APK_PATH..."
if ! timeout "$INSTALL_TIMEOUT" adb install -r "$APK_PATH" > "$LOG_DIR/install.log" 2>&1; then
  log_error "App installation failed"
  print_failure "install"
  exit 1
fi

# Verify package installed
if ! adb shell pm list packages 2>/dev/null | grep -q "$APP_PACKAGE"; then
  log_error "Package $APP_PACKAGE not found after install"
  exit 1
fi
log "App installed successfully"

# Launch app
log "Launching app..."
if ! adb shell am start -n "${APP_PACKAGE}/.MainActivity" > "$LOG_DIR/launch.log" 2>&1; then
  log_error "Failed to launch app"
  print_failure "launch"
  exit 1
fi

# Wait briefly for app to start
sleep 3

# Verify app is running
if ! adb shell pidof "$APP_PACKAGE" > /dev/null 2>&1; then
  log_error "App crashed on launch"
  log_error "Checking logcat for crash..."
  adb logcat -d -s AndroidRuntime:E | tail -30 >&2 || true
  exit 1
fi

log "App launched successfully"
exit 0
