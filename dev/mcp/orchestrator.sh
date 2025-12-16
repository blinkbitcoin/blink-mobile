#!/usr/bin/env bash
# Main orchestrator - starts all MCP services in sequence
# Exit 0 on full success, 1 on any failure (with cleanup)
#
# Usage: ./dev/mcp/orchestrator.sh
#
# Services started:
#   1. Android emulator (cold boot)
#   2. Metro bundler (port 8081)
#   3. Appium server (port 4723)
#   4. Blink app (install + launch)

set -euo pipefail
source "$(dirname "$0")/lib/common.sh"

SERVICES_DIR="$(dirname "$0")/services"

# Track if we've completed successfully
SUCCESS=false

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

  # Pre-flight cleanup
  preflight_cleanup

  # Start services in order
  log ""
  log "=== Starting Emulator ==="
  "$SERVICES_DIR/emulator.sh" || {
    log_error "Emulator startup failed"
    return 1
  }

  log ""
  log "=== Starting Metro ==="
  "$SERVICES_DIR/metro.sh" || {
    log_error "Metro startup failed"
    return 1
  }

  log ""
  log "=== Starting Appium ==="
  "$SERVICES_DIR/appium.sh" || {
    log_error "Appium startup failed"
    return 1
  }

  log ""
  log "=== Installing App ==="
  "$SERVICES_DIR/app.sh" || {
    log_error "App installation failed"
    return 1
  }

  # All services started successfully
  SUCCESS=true

  # Write ready marker with status
  {
    echo "ready=true"
    echo "timestamp=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "emulator_pid=$(get_pid emulator)"
    echo "metro_pid=$(get_pid metro)"
    echo "appium_pid=$(get_pid appium)"
  } > "$READY_MARKER"

  log ""
  log "=========================================="
  log "All services started successfully!"
  log "=========================================="
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
