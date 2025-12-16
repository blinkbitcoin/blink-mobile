#!/usr/bin/env bash
# Wrapper for backwards compatibility - delegates to mcp-start.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/mcp-start.sh"
