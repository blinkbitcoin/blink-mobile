#!/usr/bin/env npx tsx
/**
 * CLI for app interactions - shares XML parser with MCP server
 * Usage: npx tsx dev/mcp-server/src/cli.ts <command> [args]
 */

import { execSync } from "child_process";
import { XMLParser } from "fast-xml-parser";

interface UiElement {
  tag: string;
  id?: string;
  text?: string;
  bounds?: string;
  clickable?: boolean;
  children?: UiElement[];
}

function adb(cmd: string): string {
  try {
    return execSync(`adb ${cmd}`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
  } catch {
    return "";
  }
}

// Parse uiautomator dump XML (uses <node> elements with attributes)
function parseUiDump(xml: string): UiElement | null {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "",
  });

  try {
    const parsed = parser.parse(xml);
    const hierarchy = parsed.hierarchy;
    if (!hierarchy) return null;

    function convertNode(node: Record<string, unknown>): UiElement | null {
      if (!node) return null;

      const el: UiElement = {
        tag: ((node["class"] as string) || "View").replace(/^android\.(widget|view)\./, ""),
      };

      // content-desc is the testID
      const contentDesc = node["content-desc"] as string;
      if (contentDesc) el.id = contentDesc;

      // resource-id as fallback
      const resourceId = node["resource-id"] as string;
      if (!el.id && resourceId) {
        const parts = resourceId.split("/");
        el.id = parts[parts.length - 1];
      }

      const text = node["text"] as string;
      if (text) el.text = text;

      const bounds = node["bounds"] as string;
      if (bounds) el.bounds = bounds;

      if (node["clickable"] === "true") el.clickable = true;

      // Process child nodes
      const childNodes = node["node"];
      if (childNodes) {
        const children: UiElement[] = [];
        const nodeArray = Array.isArray(childNodes) ? childNodes : [childNodes];
        for (const child of nodeArray) {
          const converted = convertNode(child as Record<string, unknown>);
          if (converted) children.push(converted);
        }
        if (children.length > 0) el.children = children;
      }

      return el;
    }

    // Start from first node in hierarchy
    const firstNode = hierarchy.node;
    return convertNode(firstNode as Record<string, unknown>);
  } catch (e) {
    console.error("Parse error:", e);
    return null;
  }
}

function getUiHierarchy(): UiElement | null {
  adb("shell uiautomator dump /sdcard/ui.xml");
  const xml = adb("shell cat /sdcard/ui.xml");
  if (!xml) return null;
  return parseUiDump(xml);
}

function findElement(root: UiElement, testId: string): UiElement | null {
  if (root.id === testId) return root;
  for (const child of root.children || []) {
    const found = findElement(child, testId);
    if (found) return found;
  }
  return null;
}

// Parse bounds string "[x1,y1][x2,y2]" to numbers
function parseBounds(bounds: string): [number, number, number, number] | null {
  const match = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!match) return null;
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseInt(match[4])];
}

function tap(target: string) {
  // Check if coordinates
  if (/^\d+,\d+$/.test(target)) {
    const [x, y] = target.split(",");
    adb(`shell input tap ${x} ${y}`);
    console.log(`Tapped at ${x},${y}`);
    return;
  }

  // Find by testID
  const root = getUiHierarchy();
  if (!root) {
    console.error("Failed to get UI hierarchy");
    process.exit(1);
  }

  const el = findElement(root, target);
  if (!el || !el.bounds) {
    console.error(`Element '${target}' not found`);
    process.exit(1);
  }

  const coords = parseBounds(el.bounds);
  if (!coords) {
    console.error(`Invalid bounds for '${target}': ${el.bounds}`);
    process.exit(1);
  }

  const [x1, y1, x2, y2] = coords;
  const x = Math.round((x1 + x2) / 2);
  const y = Math.round((y1 + y2) / 2);
  adb(`shell input tap ${x} ${y}`);
  console.log(`Tapped '${target}' at ${x},${y}`);
}

function screenshot(path = "/tmp/screen.png") {
  execSync(`adb exec-out screencap -p > ${path}`);
  console.log(path);
}

function ui() {
  const root = getUiHierarchy();
  if (!root) {
    console.error("Failed to get UI hierarchy");
    process.exit(1);
  }

  // Collect all testIDs
  const testIds: string[] = [];
  function collectIds(node: UiElement) {
    if (node.id) testIds.push(node.id);
    node.children?.forEach(collectIds);
  }
  collectIds(root);

  console.log("=== TestIDs ===");
  [...new Set(testIds)].sort().forEach(id => console.log(`  ${id}`));
}

function typeText(text: string) {
  // Escape for adb
  const escaped = text.replace(/ /g, "%s").replace(/'/g, "\\'");
  adb(`shell input text '${escaped}'`);
  console.log(`Typed: ${text}`);
}

function back() {
  adb("shell input keyevent KEYCODE_BACK");
  console.log("Back pressed");
}

function swipe(direction: string) {
  const swipes: Record<string, string> = {
    up: "shell input swipe 540 1800 540 600 300",
    down: "shell input swipe 540 600 540 1800 300",
    left: "shell input swipe 900 1200 180 1200 300",
    right: "shell input swipe 180 1200 900 1200 300",
  };
  const cmd = swipes[direction];
  if (!cmd) {
    console.error(`Unknown direction: ${direction}. Use: up, down, left, right`);
    process.exit(1);
  }
  adb(cmd);
  console.log(`Swiped ${direction}`);
}

// Main
const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "tap":
  case "t":
    tap(args[0]);
    break;
  case "screen":
  case "s":
    screenshot(args[0]);
    break;
  case "ui":
  case "u":
    ui();
    break;
  case "type":
    typeText(args.join(" "));
    break;
  case "back":
  case "b":
    back();
    break;
  case "swipe":
    swipe(args[0] || "up");
    break;
  default:
    console.log(`
App CLI - interact with running app

Usage: npx tsx dev/mcp-server/src/cli.ts <command> [args]

Commands:
  tap <testID|x,y>   Tap element by testID or coordinates
  screen [path]      Take screenshot (default: /tmp/screen.png)
  ui [filter]        Show UI hierarchy (all|interactive|text)
  type <text>        Type text
  back               Press back button
  swipe <dir>        Swipe (up|down|left|right)
`);
}
