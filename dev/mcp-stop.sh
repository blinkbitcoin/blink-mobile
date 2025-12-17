#!/usr/bin/env bash
# Stop all MCP services started by mcp-start.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
MCP_STATE_DIR="$PROJECT_DIR/.mcp"
PID_DIR="$MCP_STATE_DIR/pids"
LOG_DIR="$MCP_STATE_DIR/logs"

echo "Stopping MCP services..."

# Stop by PID files first (clean shutdown)
if [[ -d "$PID_DIR" ]]; then
  for pidfile in "$PID_DIR"/*.pid; do
    [[ -f "$pidfile" ]] || continue
    pid=$(cat "$pidfile")
    name=$(basename "$pidfile" .pid)
    if kill -0 "$pid" 2>/dev/null; then
      echo "  Stopping $name (PID $pid)..."
      kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  done
fi

# Give processes time to exit gracefully
sleep 2

# Kill any orphaned processes by pattern
echo "  Cleaning up orphaned processes..."
pkill -f "emulator.*Pixel_API_35" 2>/dev/null || true
pkill -f "qemu-system" 2>/dev/null || true
pkill -f "@react-native/community-cli-plugin" 2>/dev/null || true
pkill -f "appium --relaxed-security" 2>/dev/null || true

# Force kill anything holding ports
for port in 8081 4723; do
  pid=$(lsof -ti:$port 2>/dev/null || true)
  if [[ -n "$pid" ]]; then
    echo "  Killing process on port $port (PID $pid)..."
    kill -9 $pid 2>/dev/null || true
  fi
done

# Clean up PID directory
rm -rf "$PID_DIR"

echo "All services stopped"
echo "Logs preserved at: $LOG_DIR/"
