# AGENTS.md - MCP Mobile App Automation

Guide for AI agents interacting with the Blink mobile app via MCP tools.

## Architecture: Dual MCP Server Setup

This project uses **two MCP servers** that work together:

### `appium-mcp` — Official Appium MCP Server
Handles all **generic Appium operations**:
- `appium_click` — Tap elements
- `appium_set_value` — Enter text into fields
- `appium_swipe` — Scroll and swipe gestures
- `appium_screenshot` — Capture screen images
- `appium_find_element` — Find elements by selector
- `appium_activate_app` — Launch/switch apps

### `blink-dev` — Blink-Specific Tools
Handles **Blink app-specific operations** not covered by the official server:
- `getScreen` — Parsed JSON page source with testIDs (much more useful than raw XML)
- `waitFor` — Wait for element to reach a desired state
- `reloadApp` — Trigger Metro hot reload after code changes
- `checkInfrastructure` — Verify dev environment health (emulator, Metro, Appium, app)
- `startServices` — Start emulator + Metro + Appium + app orchestration

```
┌─────────────────┐
│  Claude Code    │
│  (MCP Client)   │
└───┬─────────┬───┘
    │         │
    │ stdio   │ stdio
    │         │
┌───▼───┐ ┌──▼──────────┐
│appium │ │  blink-dev   │
│ -mcp  │ │  (TS server) │
└───┬───┘ └──┬───────────┘
    │        │
    └───┬────┘
        │ WebDriver
┌───────▼─────────┐
│     Appium      │
│   (port 4723)   │
└───────┬─────────┘
        │ UiAutomator2
┌───────▼─────────┐
│    Emulator     │
│  (Blink App)    │
└─────────────────┘
```

## Prerequisites

**Nix Environment Required**: All commands must be run inside the Nix development shell.

```bash
# Enter the nix environment first
nix develop

# Or prefix commands with nix develop --command
nix develop --command ./dev/mcp/orchestrator.sh
```

The Nix flake provides: Android SDK, emulator, adb, Node.js, and all required dependencies.

## Quick Start

```
1. Enter nix shell:       nix develop
2. Start infrastructure:  ./dev/mcp/orchestrator.sh
3. Wait for ready:        .mcp/ready file appears (check timing in output)
4. Use MCP tools:         checkInfrastructure, getScreen, appium_click, etc.
   Or CLI:                ./dev/app tap "Login"
5. Stop when done:        ./dev/mcp-stop.sh
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

## Blink-Specific MCP Tools (blink-dev server)

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

### waitFor

**Purpose**: Wait for element to appear or reach a desired state.

```
waitFor({ id: "home-screen", timeout: 10000 })
waitFor({ id: "loading-spinner", timeout: 5000, state: "gone" })
```

Returns success/failure. Use before interacting with elements that may take time to load.

### reloadApp

**Purpose**: Trigger Metro hot reload after code changes.

```
reloadApp()                        # Hot reload
reloadApp({ fullReload: true })    # Full reload (kill + restart)
reloadApp({ waitMs: 3000 })        # Wait longer for reload
```

Returns current screen state after reload.

### checkInfrastructure

**Purpose**: Verify all dev services are running.

```
checkInfrastructure()
```

### startServices

**Purpose**: Start all infrastructure services.

```
startServices()  # Runs orchestrator.sh, waits up to 5 min
```

## Generic Appium Tools (appium-mcp server)

These tools are provided by the official `appium/appium-mcp` server:

### appium_click
```
appium_click({ elementId: "..." })
```

### appium_set_value
```
appium_set_value({ elementId: "...", text: "hello" })
```

### appium_swipe
```
appium_swipe({ direction: "up" })
```

### appium_screenshot
```
appium_screenshot()
```

### appium_find_element
```
appium_find_element({ strategy: "accessibility id", selector: "loginButton" })
```

### appium_activate_app
```
appium_activate_app({ appId: "com.galoyapp" })
```

Refer to the [appium-mcp documentation](https://github.com/nickhudkins/appium-mcp) for full tool details.

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

1. **Prefer `getScreen` over screenshot** - JSON is faster and cheaper than images
2. **Use `-j` for parsing** - JSON output is machine-friendly
3. **Use UX commands** - `ux login` handles timing/waiting
4. **Local backend** - Faster, no captcha, deterministic codes
5. **Use `appium-mcp` for interactions** - Official tools for tap/type/swipe

## Files Reference

```
.mcp.json                 # Dual MCP server config (appium-mcp + blink-dev)

dev/mcp-server/
  src/
    index.ts              # blink-dev MCP server entry
    cli.ts                # CLI entry point
    cli/
      basic.ts            # Basic commands (tap, ui, type, etc.)
      ux.ts               # UX flows (login, send, etc.)
      helpers.ts          # Shared utilities (adb, element finding)
      config.ts           # Config file loading
    tools/                # Blink-specific MCP tool implementations
    appium/               # Minimal Appium client (page source + reload)
    utils/
      xml-parser.ts       # XML → JSON page source parser
  config.yaml             # User config (gitignored)
  config.example.yaml     # Example config

dev/mcp/
  orchestrator.sh         # Start all services
  health-check.sh         # Verify services
  services/               # Per-service scripts

dev/app                   # CLI wrapper
dev/mcp-stop.sh           # Stop all services
dev/AGENTS.md             # This file - agent guide
.mcp/                     # Runtime state (ready, logs/, pids/)
```

## Service Ports

| Service | Port | Health Check |
|---------|------|--------------|
| Metro | 8081 | `curl http://localhost:8081/status` |
| Appium | 4723 | `curl http://localhost:4723/status` |
| Emulator | 5554 | `adb devices` |

---

## Appendix: Deep Troubleshooting

### "System UI isn't responding" dialog
Common Android emulator issue during cold boot. Dismiss via adb:
```bash
# Find button coordinates
adb shell uiautomator dump /sdcard/ui.xml
adb shell cat /sdcard/ui.xml | grep -i "wait"
# Look for bounds like [70,1302][1010,1428], tap center
adb shell input tap 540 1365
```

### App stuck on splash screen
Check Metro for bundling errors:
```bash
tail -50 .mcp/logs/metro.log | grep -E "ERROR|BUNDLE"
```
If missing modules, run `yarn install` then restart orchestrator.

### Bypass CLI - use adb directly
When CLI isn't working, use adb:
```bash
adb exec-out screencap -p > screenshot.png           # Screenshot
adb shell uiautomator dump /sdcard/ui.xml            # UI hierarchy
adb shell input tap <x> <y>                          # Tap coordinates
adb shell input keyevent KEYCODE_BACK                # Press back
adb shell am force-stop com.galoyapp                 # Kill app
adb shell am start -n com.galoyapp/.MainActivity     # Launch app
```

### Log Locations
All logs in `.mcp/logs/`: `emulator.log`, `metro.log`, `appium.log`, `install.log`, `launch.log`
