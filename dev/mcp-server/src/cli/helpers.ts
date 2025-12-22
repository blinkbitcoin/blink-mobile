import { execSync } from "child_process";
import { XMLParser } from "fast-xml-parser";

export interface UiElement {
  tag: string;
  id?: string;
  text?: string;
  bounds?: string;
  clickable?: boolean;
  children?: UiElement[];
}

export function sleep(ms: number) {
  execSync(`sleep ${ms / 1000}`);
}

export function adb(cmd: string): string {
  return execSync(`adb ${cmd}`, { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] });
}

export function adbSafe(cmd: string): string {
  try {
    return adb(cmd);
  } catch {
    return "";
  }
}

function stripEmoji(str: string): string {
  return str
    .replace(/[\u{1F1E0}-\u{1F1FF}]|[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]/gu, "")
    .replace(/&#\d{5,6};/g, "")
    .replace(/^[,\s]+/, "")
    .trim();
}

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

      const contentDesc = node["content-desc"] as string;
      if (contentDesc) el.id = contentDesc;

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

    const firstNode = hierarchy.node;
    return convertNode(firstNode as Record<string, unknown>);
  } catch (e) {
    console.error("Parse error:", e);
    return null;
  }
}

export function getUiHierarchy(): UiElement | null {
  adbSafe("shell uiautomator dump /sdcard/ui.xml");
  const xml = adbSafe("shell cat /sdcard/ui.xml");
  if (!xml) return null;
  return parseUiDump(xml);
}

export function findElement(root: UiElement, testId: string): UiElement | null {
  if (root.id === testId) return root;
  if (root.id && stripEmoji(root.id) === testId) return root;
  for (const child of root.children || []) {
    const found = findElement(child, testId);
    if (found) return found;
  }
  return null;
}

export function hasElement(testId: string): boolean {
  const root = getUiHierarchy();
  return root ? findElement(root, testId) !== null : false;
}

export function getElementText(testId: string): string | null {
  const root = getUiHierarchy();
  if (!root) return null;
  const el = findElement(root, testId);
  return el?.text ?? null;
}

export function verifyScreen(expectedIds: string[], errorMsg: string): boolean {
  const root = getUiHierarchy();
  if (!root) {
    console.error(`VERIFY FAILED: ${errorMsg} - could not get UI`);
    return false;
  }
  for (const id of expectedIds) {
    if (!findElement(root, id)) {
      console.error(`VERIFY FAILED: ${errorMsg} - missing '${id}'`);
      return false;
    }
  }
  return true;
}

function parseBounds(bounds: string): [number, number, number, number] | null {
  const match = bounds.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
  if (!match) return null;
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3]), parseInt(match[4])];
}

export function tapElement(target: string, silent = false): boolean {
  if (/^\d+,\d+$/.test(target)) {
    const [x, y] = target.split(",");
    adb(`shell input tap ${x} ${y}`);
    if (!silent) console.log(`Tapped at ${x},${y}`);
    return true;
  }

  const root = getUiHierarchy();
  if (!root) return false;

  const el = findElement(root, target);
  if (!el?.bounds) return false;

  const coords = parseBounds(el.bounds);
  if (!coords) return false;

  const [x1, y1, x2, y2] = coords;
  const x = Math.round((x1 + x2) / 2);
  const y = Math.round((y1 + y2) / 2);
  adb(`shell input tap ${x} ${y}`);
  if (!silent) console.log(`Tapped '${target}' at ${x},${y}`);
  return true;
}

export function waitForElement(testId: string, timeoutMs = 10000): boolean {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (hasElement(testId)) return true;
    sleep(200);
  }
  return false;
}

// Wait for any of the given testIds, returns which one was found (or null)
export function waitForAny(testIds: string[], timeoutMs = 10000): string | null {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const root = getUiHierarchy();
    if (root) {
      for (const id of testIds) {
        if (findElement(root, id)) return id;
      }
    }
    sleep(200);
  }
  return null;
}

export function tapAndWait(tapTarget: string, waitTarget: string, timeoutMs = 5000): boolean {
  if (!tapElement(tapTarget, true)) return false;
  return waitForElement(waitTarget, timeoutMs);
}

export function typeText(text: string, silent = false) {
  const escaped = text.replace(/ /g, "%s").replace(/'/g, "\\'");
  adb(`shell input text '${escaped}'`);
  if (!silent) console.log(`Typed: ${text}`);
}

export function clearInput() {
  // Select all (Ctrl+A) then delete
  adb("shell input keyevent 123"); // KEYCODE_MOVE_END
  for (let i = 0; i < 20; i++) {
    adb("shell input keyevent 67"); // KEYCODE_DEL
  }
}

export function goHome(): boolean {
  if (hasElement("home-screen")) return true;

  if (tapElement("Home", true)) {
    sleep(500);
    if (hasElement("home-screen")) return true;
  }

  for (let i = 0; i < 5; i++) {
    adb("shell input keyevent KEYCODE_BACK");
    sleep(500);
    if (hasElement("home-screen")) return true;
    if (tapElement("Home", true)) {
      sleep(500);
      if (hasElement("home-screen")) return true;
    }
  }

  return false;
}

export function collectTestIds(root: UiElement): string[] {
  const testIds: string[] = [];
  function collect(node: UiElement) {
    if (node.id) testIds.push(stripEmoji(node.id));
    node.children?.forEach(collect);
  }
  collect(root);
  return [...new Set(testIds)].sort();
}

export interface UiInfo {
  id?: string;
  text?: string;
  tag: string;
}

export function collectUiInfo(root: UiElement): UiInfo[] {
  const items: UiInfo[] = [];
  function collect(node: UiElement) {
    if (node.id || node.text) {
      items.push({
        id: node.id ? stripEmoji(node.id) : undefined,
        text: node.text,
        tag: node.tag,
      });
    }
    node.children?.forEach(collect);
  }
  collect(root);
  return items;
}
