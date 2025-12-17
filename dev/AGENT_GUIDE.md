# MCP Mobile App Agent Guide

Guide for AI agents interacting with the Blink mobile app via MCP tools.

## Quick Start

```
1. Start infrastructure:  ./dev/mcp/orchestrator.sh
2. Wait for ready:        .mcp/ready file appears (~40s)
3. Use MCP tools:         checkInfrastructure, getScreen, tap, etc.
   Or CLI:                ./dev/app tap "Login"
4. Stop when done:        ./dev/mcp-stop.sh
```

## Infrastructure

### Starting Services

**Option A: Shell (before MCP available)**
```bash
./dev/mcp/orchestrator.sh
# Wait for "All services started successfully!" or .mcp-ready file
```

**Option B: MCP tool (if MCP server running)**
```
startServices()  # Runs orchestrator, waits up to 5 min
```

### Verifying Services

Always verify before interacting with app:

```
checkInfrastructure()
```

Returns:
```json
{
  "ready": true,
  "services": {
    "emulator": {"ready": true, "message": "OK"},
    "metro": {"ready": true, "message": "OK"},
    "appium": {"ready": true, "message": "OK"},
    "app": {"ready": true, "message": "OK"}
  }
}
```

If `ready: false`, run `startServices()` or `./dev/mcp/orchestrator.sh`.

### Stopping Services

```bash
./dev/mcp-stop.sh
```

## Core Tools

### getScreen

**Purpose**: Understand current app state. Primary tool for orientation.

```
getScreen()
getScreen({ filter: "interactive" })  # Only tappable elements
getScreen({ filter: "text" })         # Only text elements
getScreen({ maxDepth: 5 })            # Limit nesting
```

Returns:
```json
{
  "testIds": ["Accept", "Back", "View Terms and Conditions", ...],
  "tree": {
    "tag": "FrameLayout",
    "children": [...]
  }
}
```

**Best Practice**: Check `testIds` array first - these are your tap targets.

### tap

**Purpose**: Tap element by testID.

```
tap({ id: "Accept" })
tap({ id: "login-button", waitMs: 1000 })  # Wait 1s after tap
```

**Important**:
- Uses accessibility ID selector (`~id`)
- Waits up to 30s for element to appear
- Default 500ms pause after tap for UI to settle

### type

**Purpose**: Enter text into focused input field.

```
type({ text: "user@example.com" })
type({ text: "password123", submit: true })  # Press enter after
```

**Workflow**:
1. `tap({ id: "email-input" })` - Focus the field
2. `type({ text: "user@example.com" })` - Enter text

### swipe

**Purpose**: Scroll or swipe gestures.

```
swipe({ direction: "up" })     # Scroll down (content moves up)
swipe({ direction: "down" })   # Scroll up
swipe({ direction: "left" })   # Next carousel item
swipe({ direction: "right" })  # Previous carousel item
```

### waitFor

**Purpose**: Wait for element to appear.

```
waitFor({ id: "home-screen", timeoutMs: 10000 })
```

Returns success/failure. Use before tapping elements that may take time to load.

### screenshot

**Purpose**: Visual confirmation of app state.

```
screenshot()
screenshot({ path: "/tmp/debug.png" })
```

Returns base64-encoded PNG. Use sparingly - `getScreen` is more efficient for understanding state.

### getElement

**Purpose**: Get details about specific element.

```
getElement({ id: "balance-display" })
```

Returns element properties including text content, bounds, clickability.

### launchApp / reloadApp

**Purpose**: App lifecycle control.

```
launchApp()   # Cold start app
reloadApp()   # Hot reload (keeps JS state, reloads bundle)
```

## CLI Tool

For shell-based interaction (useful when MCP tools unavailable):

```bash
# Take screenshot
./dev/app screen /tmp/shot.png

# List all testIDs on screen
./dev/app ui

# Tap by testID
./dev/app tap "Accept"

# Tap by coordinates
./dev/app tap 540,1200

# Type text
./dev/app type "hello world"

# Navigate back
./dev/app back

# Swipe
./dev/app swipe up
```

## Common Workflows

### Navigate to Screen

```
1. getScreen()                    # See current state and testIds
2. tap({ id: "target-button" })   # Navigate
3. getScreen()                    # Confirm arrival
```

### Fill Form

```
1. getScreen()                           # Find input testIds
2. tap({ id: "email-input" })            # Focus field
3. type({ text: "user@example.com" })    # Enter text
4. tap({ id: "password-input" })         # Next field
5. type({ text: "secret123" })
6. tap({ id: "submit-button" })          # Submit
```

### Scroll to Find Element

```
1. getScreen()                    # Check if element visible
2. If not found in testIds:
   swipe({ direction: "up" })     # Scroll down
   getScreen()                    # Check again
3. Repeat until found or max attempts
```

### Handle Modals/Alerts

```
1. getScreen()                    # Modal testIds appear at top level
2. tap({ id: "modal-confirm" })   # Or "modal-dismiss"
```

## TestID Patterns

Common patterns in this codebase:

| Pattern | Example | Purpose |
|---------|---------|---------|
| `Back` | Navigation back button |
| `Accept`, `Confirm`, `Cancel` | Action buttons |
| `{Screen}Screen` | `HomeScreen` | Screen identifiers |
| `{field}-input` | `email-input` | Input fields |
| `RNE_BUTTON_WRAPPER` | React Native Elements wrapper (tap child instead) |

## Troubleshooting

### "Element not found"

1. `getScreen()` to see available testIds
2. Check spelling (case-sensitive)
3. Element may need scroll: `swipe({ direction: "up" })`
4. Element may be loading: `waitFor({ id: "target" })`

### "Infrastructure not ready"

```
checkInfrastructure()  # See which service failed
startServices()        # Restart all
```

Or manually:
```bash
./dev/mcp-stop.sh
./dev/mcp/orchestrator.sh
```

### App Crashed

```
launchApp()  # Restart app
```

### Stale UI State

After navigation, always `getScreen()` to refresh understanding.

### Tap Not Working

1. Verify element is `clickable: true` in getScreen output
2. Check if element is obscured (modal, overlay)
3. Try `waitFor` before tap
4. Increase `waitMs` parameter

## Performance Tips

1. **Prefer getScreen over screenshot** - JSON is faster to process than images
2. **Use filter parameter** - `getScreen({ filter: "interactive" })` reduces noise
3. **Batch understanding** - One getScreen call, then multiple taps
4. **Check testIds first** - Don't parse full tree if testIds has what you need

## Architecture

```
┌─────────────────┐
│  Claude Code    │
│  (MCP Client)   │
└────────┬────────┘
         │ stdio
┌────────▼────────┐
│   MCP Server    │
│  (TypeScript)   │
└────────┬────────┘
         │ WebDriver
┌────────▼────────┐
│     Appium      │
│   (port 4723)   │
└────────┬────────┘
         │ UiAutomator2
┌────────▼────────┐
│    Emulator     │
│  (Blink App)    │
└─────────────────┘
```

## State Directory

All MCP runtime state lives in `.mcp/`:

```
.mcp/
  ready           # Marker file - exists when infrastructure ready
  logs/           # Service logs (emulator.log, metro.log, appium.log, install.log)
  pids/           # PID files for running services
```

| Path | Purpose |
|------|---------|
| `.mcp/ready` | Created when all services healthy. Check existence to verify infrastructure. |
| `.mcp/logs/` | Per-service logs. Check on failures. |
| `.mcp/pids/` | PID files. Used by stop script. |

## Service Ports

| Service | Port | Health Check |
|---------|------|--------------|
| Metro | 8081 | `curl http://localhost:8081/status` |
| Appium | 4723 | `curl http://localhost:4723/status` |
| Emulator | 5554 | `adb devices` |

## Files Reference

```
dev/mcp-server/
  src/
    index.ts              # MCP server entry
    cli.ts                # Shell CLI tool
    tools/
      get-screen.ts       # getScreen tool
      tap.ts              # tap tool
      type.ts             # type tool
      swipe.ts            # swipe tool
      wait-for.ts         # waitFor tool
      screenshot.ts       # screenshot tool
      get-element.ts      # getElement tool
      launch-app.ts       # launchApp tool
      reload-app.ts       # reloadApp tool
      check-infrastructure.ts  # checkInfrastructure tool
      start-services.ts   # startServices tool
    appium/
      client.ts           # Appium WebDriver client
      config.ts           # Connection config
    utils/
      xml-parser.ts       # UI hierarchy parser
      selectors.ts        # Element selector builders

dev/mcp/
  orchestrator.sh         # Start all services
  health-check.sh         # Verify services
  lib/common.sh           # Shared utilities
  services/
    emulator.sh           # Emulator management
    metro.sh              # Metro bundler
    appium.sh             # Appium server
    app.sh                # App install/launch

dev/app                   # CLI wrapper (./dev/app tap "Login")
dev/mcp-stop.sh           # Stop all services
.mcp.json                 # MCP server config for Claude Code
.mcp/                     # Runtime state directory
  ready                   # Marker file (exists when ready)
  logs/                   # Service logs
  pids/                   # Process ID files
```
