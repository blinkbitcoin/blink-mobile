#!/usr/bin/env bash
# Main orchestrator - starts all MCP services in sequence
# Exit 0 on full success, 1 on any failure (with cleanup)
#
# Usage: ./dev/mcp/orchestrator.sh
#
# Services started:
#   1. Android emulator (cold boot, headless)
#   2. Metro bundler (port 8081)
#   3. Appium server (port 4723)
#   4. Blink app (install + launch)

set -euo pipefail
source "$(dirname "$0")/lib/common.sh"

SERVICES_DIR="$(dirname "$0")/services"

# Track if we've completed successfully
SUCCESS=false

# Timing helpers
ORCHESTRATOR_START=$(date +%s)
declare -A SERVICE_TIMES

time_service() {
  local name=$1
  local start=$2
  local end=$(date +%s)
  local duration=$((end - start))
  SERVICE_TIMES[$name]=$duration
  log "$name completed in ${duration}s"
}

# Cleanup on any failure or exit
cleanup_on_exit() {
  if [[ "$SUCCESS" != "true" ]]; then
    log_error "Orchestrator failed - cleaning up..."
    cleanup_all
  fi
}
trap cleanup_on_exit EXIT

# Main
main() {
  log "=========================================="
  log "MCP Service Orchestrator"
  log "=========================================="
  log "Mode: headless (QT_QPA_PLATFORM=$QT_QPA_PLATFORM)"

  # Pre-flight cleanup
  local preflight_start=$(date +%s)
  preflight_cleanup
  time_service "preflight" "$preflight_start"

  # Start services in order
  log ""
  log "=== Starting Emulator ==="
  local emulator_start=$(date +%s)
  "$SERVICES_DIR/emulator.sh" || {
    log_error "Emulator startup failed"
    return 1
  }
  time_service "emulator" "$emulator_start"

  log ""
  log "=== Starting Metro ==="
  local metro_start=$(date +%s)
  "$SERVICES_DIR/metro.sh" || {
    log_error "Metro startup failed"
    return 1
  }
  time_service "metro" "$metro_start"

  log ""
  log "=== Starting Appium ==="
  local appium_start=$(date +%s)
  "$SERVICES_DIR/appium.sh" || {
    log_error "Appium startup failed"
    return 1
  }
  time_service "appium" "$appium_start"

  log ""
  log "=== Installing App ==="
  local app_start=$(date +%s)
  "$SERVICES_DIR/app.sh" || {
    log_error "App installation failed"
    return 1
  }
  time_service "app" "$app_start"

  # All services started successfully
  SUCCESS=true

  # Calculate total time
  local total_time=$(($(date +%s) - ORCHESTRATOR_START))

  # Write ready marker with status
  {
    echo "ready=true"
    echo "timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "total_time=${total_time}s"
    echo "emulator_time=${SERVICE_TIMES[emulator]}s"
    echo "metro_time=${SERVICE_TIMES[metro]}s"
    echo "appium_time=${SERVICE_TIMES[appium]}s"
    echo "app_time=${SERVICE_TIMES[app]}s"
    echo "emulator_pid=$(get_pid emulator)"
    echo "metro_pid=$(get_pid metro)"
    echo "appium_pid=$(get_pid appium)"
  } > "$READY_MARKER"

  log ""
  log "=========================================="
  log "All services started successfully!"
  log "=========================================="
  log ""
  log "Timing breakdown:"
  log "  Preflight: ${SERVICE_TIMES[preflight]}s"
  log "  Emulator:  ${SERVICE_TIMES[emulator]}s"
  log "  Metro:     ${SERVICE_TIMES[metro]}s"
  log "  Appium:    ${SERVICE_TIMES[appium]}s"
  log "  App:       ${SERVICE_TIMES[app]}s"
  log "  ─────────────────"
  log "  Total:     ${total_time}s"
  log ""
  log "Status:"
  log "  Emulator: PID $(get_pid emulator)"
  log "  Metro:    PID $(get_pid metro) - http://localhost:8081"
  log "  Appium:   PID $(get_pid appium) - http://localhost:4723"
  log "  App:      Running"
  log ""
  log "Logs: $LOG_DIR/"
  log "Stop: ./dev/mcp-stop.sh"
  log ""
  log "MCP server will be spawned by Claude Code via .mcp.json"

  return 0
}

main "$@"
