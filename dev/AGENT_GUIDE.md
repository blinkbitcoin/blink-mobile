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

## Core MCP Tools

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

Shell-based interaction via `./dev/app`:

### Basic Commands

```bash
./dev/app ui                    # List testIDs and text (flat format)
./dev/app ui -v                 # Include element tags
./dev/app ui -j                 # JSON output (machine-readable)

./dev/app tap "Login"           # Tap by testID
./dev/app tap 540,1200          # Tap by coordinates
./dev/app t "Login"             # Alias

./dev/app screen /tmp/shot.png  # Screenshot
./dev/app s                     # Alias (saves to /tmp/screen.png)

./dev/app type "hello world"    # Type into focused input
./dev/app back                  # Press back button
./dev/app swipe up              # Swipe direction (up/down/left/right)
./dev/app reload                # Hot reload via Metro
```

### UX Flows (High-Level Automation)

```bash
./dev/app ux home               # Navigate to home screen
./dev/app ux settings           # Open settings menu

./dev/app ux send <dest> <amt>  # Send money flow
  -w, --wallet <btc|usd>        # Wallet to send from
  -n, --note <text>             # Add memo

./dev/app ux login              # Full SMS login
  -p, --phone <number>          # Override phone
  -c, --code <code>             # Override verification code
  --country <name>              # Override country

./dev/app ux backend <name>     # Switch backend (staging|main|local|custom)
```

### App Lifecycle

```bash
./dev/app app launch            # Start the app
./dev/app app kill              # Force stop
./dev/app app restart           # Kill + launch
./dev/app app clear             # Clear app data (full reset)
./dev/app app info              # Show version info
```

### Configuration

Create `dev/mcp-server/config.yaml` (see `config.example.yaml`):

```yaml
login:
  country: Germany
  phone: "1234567890"
  code: "000000"

backend: staging
```

**Local backend**: Use code `000000` - bypasses SMS verification.

## Key TestIDs

| Screen | TestID | Purpose |
|--------|--------|---------|
| Entry | `logo-button` | Logo (tap 3x for dev menu) |
| Entry | `Login` | Login button |
| Entry | `Create new account` | Registration button |
| Login | `SMS` | SMS login option |
| Login | `Use SMS` | Confirm SMS method |
| Phone | `telephoneNumber` | Phone input field |
| Phone | `Country Picker` | Country selector |
| Phone | `Send via SMS` | Submit phone |
| Code | `oneTimeCode` | Verification code input |
| Captcha | `Geetest` | GeeTest captcha (if shown) |
| Home | `home-screen` | Home screen identifier |
| Home | `menu` | Settings/menu button |
| Home | `Send` | Send money button |
| Warning | `icon-warning` | Error indicator |

## Backend Switching

Switch between environments from the entry screen:

```bash
# Must be on entry screen (not logged in)
./dev/app ux backend staging    # Production-like
./dev/app ux backend main       # Production
./dev/app ux backend local      # Local galoy-quickstart
./dev/app ux backend custom     # Custom endpoint
```

**Local backend benefits**:
- Code `000000` always works (no real SMS)
- No real GeeTest captcha
- Fast iteration for testing

## Captcha Handling

GeeTest captcha may appear during login (staging/main backends).

**Automated flow** (`ux login`):
1. Detects captcha via `Geetest` testID
2. Prints "Captcha detected - please solve it..."
3. Polls every 500ms waiting for captcha to disappear
4. Auto-continues once solved (up to 2 min timeout)

**Manual handling**:
```bash
./dev/app ui              # Check for "Geetest" in output
# Solve captcha manually on device
./dev/app ui              # Verify captcha gone
```

## Common Workflows

### Login Flow (Staging)

```bash
./dev/app ux backend staging    # If needed
./dev/app ux login -p "1234567890" -c "actual-sms-code"
# Solve captcha if prompted
```

### Login Flow (Local - No Captcha)

```bash
./dev/app ux backend local
./dev/app ux login -p "1234567890" -c "000000"
```

### Navigate and Send

```bash
./dev/app ux home
./dev/app ux send "username" "100" -w btc -n "Test payment"
# Stops before final confirmation
```

### Debug Current State

```bash
./dev/app ui -j | jq '.[] | select(.id)'   # All elements with testIDs
./dev/app screen /tmp/debug.png             # Visual check
```

## Troubleshooting

### "Element not found"

1. `./dev/app ui` to see available testIds
2. Check spelling (case-sensitive)
3. Element may need scroll: `./dev/app swipe up`
4. Screen may be loading: add `sleep 1`

### Rate Limited

```
Too many requests. Please wait before retrying.
```

Switch to local backend or wait before retrying.

### Captcha Won't Solve

- Ensure you're interacting with the emulator directly
- Check if it's a slider puzzle (slide to complete)
- May need to wait for animation to finish

### App Exited to Launcher

```bash
./dev/app app launch
```

### "Infrastructure not ready"

```bash
./dev/mcp-stop.sh
./dev/mcp/orchestrator.sh
```

## Performance Tips

1. **Prefer `ui` over screenshot** - Text is faster than images
2. **Use `-j` for parsing** - JSON output is machine-friendly
3. **Use UX commands** - `ux login` handles timing/waiting
4. **Local backend** - Faster, no captcha, deterministic codes

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

## Files Reference

```
dev/mcp-server/
  src/
    index.ts              # MCP server entry
    cli.ts                # CLI entry point
    cli/
      basic.ts            # Basic commands (tap, ui, type, etc.)
      ux.ts               # UX flows (login, send, etc.)
      helpers.ts          # Shared utilities (adb, element finding)
      config.ts           # Config file loading
    tools/                # MCP tool implementations
    appium/               # Appium WebDriver client
  config.yaml             # User config (gitignored)
  config.example.yaml     # Example config

dev/mcp/
  orchestrator.sh         # Start all services
  health-check.sh         # Verify services
  services/               # Per-service scripts

dev/app                   # CLI wrapper
dev/mcp-stop.sh           # Stop all services
.mcp.json                 # MCP server config
.mcp/                     # Runtime state (ready, logs/, pids/)
```

## Service Ports

| Service | Port | Health Check |
|---------|------|--------------|
| Metro | 8081 | `curl http://localhost:8081/status` |
| Appium | 4723 | `curl http://localhost:4723/status` |
| Emulator | 5554 | `adb devices` |
