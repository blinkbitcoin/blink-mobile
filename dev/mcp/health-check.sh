#!/usr/bin/env bash
# Standalone health check - verifies all services are running
# Exit 0 if all healthy, non-zero otherwise
#
# Usage: ./dev/mcp/health-check.sh
#        ./dev/mcp/health-check.sh --json   # Output as JSON

set -euo pipefail

JSON_OUTPUT=false
[[ "${1:-}" == "--json" ]] && JSON_OUTPUT=true

# Check functions
check_emulator() {
  adb shell getprop sys.boot_completed 2>/dev/null | grep -q "1"
}

check_metro() {
  curl -sf http://127.0.0.1:8081/status 2>/dev/null | grep -q "packager-status:running"
}

check_appium() {
  curl -sf http://127.0.0.1:4723/status >/dev/null 2>&1
}

check_app() {
  adb shell pidof com.galoyapp >/dev/null 2>&1
}

# Run checks
emulator_ok=false; check_emulator && emulator_ok=true
metro_ok=false; check_metro && metro_ok=true
appium_ok=false; check_appium && appium_ok=true
app_ok=false; check_app && app_ok=true

# Count failures
failed=0
$emulator_ok || ((failed++))
$metro_ok || ((failed++))
$appium_ok || ((failed++))
$app_ok || ((failed++))

all_ok=false
[[ $failed -eq 0 ]] && all_ok=true

if $JSON_OUTPUT; then
  cat <<EOF
{
  "ready": $all_ok,
  "services": {
    "emulator": {"ready": $emulator_ok, "check": "adb boot_completed"},
    "metro": {"ready": $metro_ok, "check": "http://localhost:8081/status"},
    "appium": {"ready": $appium_ok, "check": "http://localhost:4723/status"},
    "app": {"ready": $app_ok, "check": "pidof com.galoyapp"}
  }
}
EOF
else
  echo "MCP Infrastructure Health Check"
  echo "================================"
  $emulator_ok && echo "Emulator: OK" || echo "Emulator: FAILED"
  $metro_ok && echo "Metro:    OK" || echo "Metro:    FAILED"
  $appium_ok && echo "Appium:   OK" || echo "Appium:   FAILED"
  $app_ok && echo "App:      OK" || echo "App:      FAILED"
  echo ""
  $all_ok && echo "Status: ALL HEALTHY" || echo "Status: $failed service(s) unhealthy"
fi

exit $failed
