#!/usr/bin/env bash
# Start all MCP services as true daemons (survive script exit)
# Services persist after script exits. Use mcp-stop.sh to stop.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PID_DIR="$PROJECT_DIR/.mcp-pids"
LOG_DIR="$PROJECT_DIR/.mcp-logs"
AVD_NAME="Pixel_API_35"

# Use separate APPIUM_HOME to avoid npm conflicts
export APPIUM_HOME="${APPIUM_HOME:-$HOME/.appium}"

#######################################
# PREREQUISITE CHECKS - fail early
#######################################

echo "Checking prerequisites..."

# Check required commands
for cmd in emulator adb yarn curl; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "ERROR: '$cmd' not found. Run from nix shell (direnv allow)"
    exit 1
  fi
done

# Check AVD exists
if ! emulator -list-avds 2>/dev/null | grep -q "^${AVD_NAME}$"; then
  echo "ERROR: AVD '$AVD_NAME' not found"
  echo "Available AVDs:"
  emulator -list-avds 2>/dev/null || echo "  (none)"
  echo ""
  echo "Create with: avdmanager create avd -n $AVD_NAME -k 'system-images;android-35;google_apis;arm64-v8a'"
  exit 1
fi

# Check ports are free
for port in 8081 4723; do
  if lsof -ti:$port &>/dev/null; then
    echo "ERROR: Port $port already in use"
    echo "Run: ./dev/mcp-stop.sh"
    exit 1
  fi
done

# Check services not already running
if [[ -f "$PID_DIR/emulator.pid" ]] && kill -0 "$(cat "$PID_DIR/emulator.pid")" 2>/dev/null; then
  echo "ERROR: Services already running"
  echo "Run: ./dev/mcp-stop.sh"
  exit 1
fi

# Check APK exists (warn only)
APK_PATH="$PROJECT_DIR/android/app/build/outputs/apk/debug/app-universal-debug.apk"
if [[ ! -f "$APK_PATH" ]]; then
  echo "WARN: APK not found at $APK_PATH"
  echo "      Build first: cd android && ./gradlew assembleDebug"
  echo ""
fi

echo "Prerequisites OK"
echo ""

#######################################
# SETUP
#######################################

mkdir -p "$PID_DIR" "$LOG_DIR" "$APPIUM_HOME"
cd "$PROJECT_DIR"

# Install UiAutomator2 driver if needed
if ! yarn appium driver list --installed 2>&1 | grep -q "uiautomator2"; then
  echo "Installing UiAutomator2 driver..."
  yarn appium driver install uiautomator2
fi

#######################################
# START SERVICES
#######################################

# 1. Emulator - nohup prevents SIGHUP on shell exit
echo "Starting emulator..."
nohup emulator -avd "$AVD_NAME" -gpu swiftshader -wipe-data -no-boot-anim > "$LOG_DIR/emulator.log" 2>&1 &
EMU_PID=$!
echo $EMU_PID > "$PID_DIR/emulator.pid"
disown $EMU_PID

echo "Waiting for device boot (timeout 120s)..."
adb wait-for-device
timeout 120 adb shell 'while [[ -z $(getprop sys.boot_completed) ]]; do sleep 1; done' 2>/dev/null || {
  echo "ERROR: Emulator boot timeout"
  exit 1
}
echo "Device ready"

# 2. Metro bundler
echo "Starting Metro bundler..."
nohup yarn start > "$LOG_DIR/metro.log" 2>&1 &
METRO_PID=$!
echo $METRO_PID > "$PID_DIR/metro.pid"
disown $METRO_PID

echo "Waiting for Metro (timeout 30s)..."
for i in {1..30}; do
  if curl -s http://127.0.0.1:8081/status 2>/dev/null | grep -q "packager-status:running"; then
    echo "Metro ready"
    break
  fi
  sleep 1
done

# 3. Appium
echo "Starting Appium..."
nohup yarn appium --address 127.0.0.1 --relaxed-security > "$LOG_DIR/appium.log" 2>&1 &
APPIUM_PID=$!
echo $APPIUM_PID > "$PID_DIR/appium.pid"
disown $APPIUM_PID

echo "Waiting for Appium (timeout 30s)..."
for i in {1..30}; do
  if curl -s http://127.0.0.1:4723/status > /dev/null 2>&1; then
    echo "Appium ready"
    break
  fi
  sleep 1
done

# 4. Install app via adb (fast) instead of yarn react-native (slow)
APK_PATH="$PROJECT_DIR/android/app/build/outputs/apk/debug/app-universal-debug.apk"
if [[ -f "$APK_PATH" ]]; then
  echo "Installing app via adb..."
  adb install -r "$APK_PATH" > "$LOG_DIR/install.log" 2>&1 && echo "App installed" || echo "WARN: App install failed"

  # Launch app
  echo "Launching app..."
  adb shell am start -n io.galoy.bitcoinbeach/.MainActivity 2>/dev/null || true
else
  echo "WARN: APK not found at $APK_PATH"
  echo "      Build with: cd android && ./gradlew assembleDebug"
fi

echo ""
echo "=== All services started ==="
echo "Emulator: PID $EMU_PID"
echo "Metro:    PID $METRO_PID (http://localhost:8081)"
echo "Appium:   PID $APPIUM_PID (http://localhost:4723)"
echo "Logs:     $LOG_DIR/"
echo ""
echo "MCP server spawned by Claude Code via .mcp.json"
echo "Stop: ./dev/mcp-stop.sh"
