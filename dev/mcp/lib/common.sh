#!/usr/bin/env bash
# Shared utilities for MCP service orchestration
# Source this file: source "$(dirname "$0")/../lib/common.sh"

set -euo pipefail

# Resolve paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[1]}")" && pwd)"
MCP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_DIR="$(cd "$MCP_DIR/../.." && pwd)"
MCP_STATE_DIR="$PROJECT_DIR/.mcp"
PID_DIR="$MCP_STATE_DIR/pids"
LOG_DIR="$MCP_STATE_DIR/logs"
READY_MARKER="$MCP_STATE_DIR/ready"

# Config
export APPIUM_HOME="${APPIUM_HOME:-$HOME/.appium}"
export QT_QPA_PLATFORM="${QT_QPA_PLATFORM:-offscreen}"  # Headless by default
AVD_NAME="${AVD_NAME:-Pixel_API_35}"
APP_PACKAGE="com.galoyapp"
APK_PATH="$PROJECT_DIR/android/app/build/outputs/apk/debug/app-universal-debug.apk"

# Logging
log() {
  echo "[$(date +%H:%M:%S)] $*"
}

log_error() {
  echo "[$(date +%H:%M:%S)] ERROR: $*" >&2
}

die() {
  log_error "$*"
  exit 1
}

# Directory setup
ensure_dirs() {
  mkdir -p "$MCP_STATE_DIR" "$PID_DIR" "$LOG_DIR" "$APPIUM_HOME"
}

# PID management
save_pid() {
  local name=$1
  local pid=$2
  echo "$pid" > "$PID_DIR/${name}.pid"
  log "Saved PID $pid for $name"
}

get_pid() {
  local name=$1
  local pidfile="$PID_DIR/${name}.pid"
  [[ -f "$pidfile" ]] && cat "$pidfile" || echo ""
}

check_pid_alive() {
  local pid=$1
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

# Port checking
port_in_use() {
  local port=$1
  lsof -ti:"$port" &>/dev/null
}

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti:"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    log "Killing processes on port $port: $pids"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 1
  fi
}

# Health check with timeout
# Usage: wait_for "service_name" timeout_seconds "check_command"
wait_for() {
  local name=$1
  local timeout=$2
  local check_cmd=$3
  local elapsed=0

  log "Waiting for $name (timeout ${timeout}s)..."

  while (( elapsed < timeout )); do
    if eval "$check_cmd" >/dev/null 2>&1; then
      log "$name is ready"
      return 0
    fi
    sleep 1
    ((elapsed++))
  done

  log_error "$name failed to start within ${timeout}s"
  return 1
}

# Start daemon process with verification
# Usage: start_daemon "name" "command" "log_file"
start_daemon() {
  local name=$1
  local cmd=$2
  local log_file="$LOG_DIR/${name}.log"

  log "Starting $name..."

  # Add timestamp separator to log
  echo "" >> "$log_file"
  echo "=== $name started at $(date) ===" >> "$log_file"

  # Start with nohup, redirect output
  nohup bash -c "$cmd" >> "$log_file" 2>&1 &
  local pid=$!
  save_pid "$name" "$pid"
  disown "$pid"

  # Brief pause to catch immediate crashes
  sleep 2

  # Verify still alive
  if ! check_pid_alive "$pid"; then
    log_error "$name (PID $pid) crashed immediately"
    log_error "Last 20 lines of $log_file:"
    tail -20 "$log_file" >&2 || true
    return 1
  fi

  log "$name started (PID $pid)"
  return 0
}

# Verify PID still alive after health check
verify_still_alive() {
  local name=$1
  local pid
  pid=$(get_pid "$name")

  if [[ -z "$pid" ]]; then
    log_error "$name has no PID file"
    return 1
  fi

  if ! check_pid_alive "$pid"; then
    log_error "$name (PID $pid) is no longer running"
    return 1
  fi

  return 0
}

# Full cleanup - calls mcp-stop.sh
cleanup_all() {
  log "Cleaning up all services..."
  "$PROJECT_DIR/dev/mcp-stop.sh" 2>/dev/null || true
  rm -f "$READY_MARKER"
}

# Pre-flight cleanup (run at start of orchestrator)
preflight_cleanup() {
  log "Pre-flight cleanup..."

  # Remove stale marker
  rm -f "$READY_MARKER"

  # Remove stale PID files
  rm -f "$PID_DIR"/*.pid 2>/dev/null || true

  # Ensure adb server is running
  log "Starting adb server..."
  adb start-server >/dev/null 2>&1 || true

  # Kill processes on required ports
  for port in 8081 4723; do
    if port_in_use "$port"; then
      log "Port $port in use, killing..."
      kill_port "$port"
    fi
  done

  ensure_dirs
}

# Print failure diagnostics
print_failure() {
  local name=$1
  local log_file="$LOG_DIR/${name}.log"

  log_error "=== $name FAILED ==="
  if [[ -f "$log_file" ]]; then
    log_error "Last 20 lines of $log_file:"
    tail -20 "$log_file" >&2 || true
  fi
  log_error "====================="
}
