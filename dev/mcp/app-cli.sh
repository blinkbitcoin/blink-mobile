#!/usr/bin/env bash
# Quick CLI for app interactions during development
# Usage: ./dev/mcp/app-cli.sh <command> [args]

set -euo pipefail

cmd="${1:-help}"
shift || true

case "$cmd" in
  screen|s)
    # Take screenshot and show path
    out="${1:-/tmp/screen.png}"
    adb exec-out screencap -p > "$out"
    echo "$out"
    ;;

  ui|u)
    # Get UI hierarchy, extract testIDs and clickable elements
    adb shell uiautomator dump /sdcard/ui.xml 2>/dev/null
    adb pull /sdcard/ui.xml /tmp/ui.xml 2>/dev/null
    echo "=== TestIDs (content-desc) ==="
    grep -oP 'content-desc="\K[^"]+' /tmp/ui.xml | grep -v '^$' | sort -u
    echo ""
    echo "=== Clickable Elements ==="
    grep -oP 'clickable="true"[^>]*content-desc="\K[^"]+' /tmp/ui.xml 2>/dev/null | sort -u || true
    grep -oP 'clickable="true"[^>]*resource-id="\K[^"]+' /tmp/ui.xml 2>/dev/null | sort -u || true
    ;;

  tap|t)
    # Tap by testID or coordinates
    target="$1"
    if [[ "$target" =~ ^[0-9]+,[0-9]+$ ]]; then
      # Coordinates: tap 540,1200
      IFS=',' read -r x y <<< "$target"
      adb shell input tap "$x" "$y"
    else
      # TestID: find and tap
      adb shell uiautomator dump /sdcard/ui.xml 2>/dev/null
      adb pull /sdcard/ui.xml /tmp/ui.xml 2>/dev/null
      # XML is one line; use perl to find element and its bounds
      bounds=$(perl -ne 'while (/content-desc="'"$target"'"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g) { print "$1 $2 $3 $4\n"; exit }' /tmp/ui.xml)
      if [[ -z "$bounds" ]]; then
        bounds=$(perl -ne 'while (/resource-id="'"$target"'"[^>]*bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/g) { print "$1 $2 $3 $4\n"; exit }' /tmp/ui.xml)
      fi
      if [[ -n "$bounds" ]]; then
        read -r x1 y1 x2 y2 <<< "$bounds"
        x=$(( (x1 + x2) / 2 ))
        y=$(( (y1 + y2) / 2 ))
        echo "Tapping $target at $x,$y"
        adb shell input tap "$x" "$y"
      else
        echo "Element '$target' not found"
        exit 1
      fi
    fi
    ;;

  type|input)
    # Type text
    text="$1"
    adb shell input text "${text// /%s}"
    ;;

  back|b)
    adb shell input keyevent KEYCODE_BACK
    ;;

  home)
    adb shell input keyevent KEYCODE_HOME
    ;;

  swipe)
    # swipe up/down/left/right
    dir="${1:-up}"
    case "$dir" in
      up)    adb shell input swipe 540 1800 540 600 300 ;;
      down)  adb shell input swipe 540 600 540 1800 300 ;;
      left)  adb shell input swipe 900 1200 180 1200 300 ;;
      right) adb shell input swipe 180 1200 900 1200 300 ;;
    esac
    ;;

  help|*)
    echo "Usage: app-cli.sh <command> [args]"
    echo ""
    echo "Commands:"
    echo "  screen [path]     Take screenshot"
    echo "  ui                Show testIDs and clickable elements"
    echo "  tap <id|x,y>      Tap element by testID or coordinates"
    echo "  type <text>       Type text"
    echo "  back              Press back button"
    echo "  swipe <dir>       Swipe up/down/left/right"
    ;;
esac
