#!/usr/bin/env bash
# Injects a "load blink-figma-to-code" reminder when a Figma design link shows up:
#   UserPromptSubmit — in the developer's message
#   PostToolUse      — in a ticket/PR/page fetched with gh (Bash) or WebFetch
# Fires at most once per session per event, so a long ticket thread doesn't repeat it.
set -euo pipefail

input="$(cat)"
event="$(jq -r '.hook_event_name // empty' <<<"$input")"
session="$(jq -r '.session_id // "nosession"' <<<"$input")"

case "$event" in
  UserPromptSubmit) text="$(jq -r '.prompt // empty' <<<"$input")" ;;
  PostToolUse) text="$(jq -r '(.tool_response | tostring) + " " + (.tool_input | tostring)' <<<"$input")" ;;
  *) exit 0 ;;
esac

grep -qE 'figma\.com/(design|file|proto)/' <<<"$text" || exit 0

marker="${TMPDIR:-/tmp}/blink-figma-to-code-${session}-${event}"
[ -e "$marker" ] && exit 0
touch "$marker"

msg='A Figma design link is present. If this task builds, modifies or checks app UI, load the blink-figma-to-code skill (Skill tool) before reading the design or editing code, and follow it.'
jq -n --arg e "$event" --arg m "$msg" '{hookSpecificOutput: {hookEventName: $e, additionalContext: $m}}'
