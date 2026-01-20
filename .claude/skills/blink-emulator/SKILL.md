---
name: blink-emulator
description: Interact with Blink mobile app via Android emulator. Use when testing app behavior, reproducing bugs, automating UI interactions, or using MCP tools like tap, getScreen, type. Covers emulator setup, CLI commands, and troubleshooting.
---

# Blink Mobile Emulator

This skill helps you interact with the Blink mobile app using the Android emulator.

## Documentation

For complete instructions, read: [dev/AGENTS.md](../../../dev/AGENTS.md)

This includes:
- Quick start guide
- All CLI commands (`./dev/app`)
- MCP tools reference
- Key TestIDs
- Troubleshooting and adb commands

## Quick Reference

```bash
# Start (in nix develop)
./dev/mcp/orchestrator.sh

# Essential commands
./dev/app ui              # List elements
./dev/app tap "Login"     # Tap element
./dev/app screen          # Screenshot

# Stop (ALWAYS do this)
./dev/mcp-stop.sh
```

## Current Limitations

- **Login not automated** - Captcha/SMS verification not supported
- **Android only** - No iOS emulator
- **Staging backend** - Some production bugs won't reproduce
