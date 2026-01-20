/**
 * Appium client wrapper for CLI commands.
 * Provides fast element operations using Appium instead of slow ADB dumps.
 */

import { AppiumClient } from "../appium/client.js";
import { buildSelector } from "../utils/selectors.js";
import { parsePageSource, collectTestIds, ElementNode } from "../utils/xml-parser.js";
import { getConfig } from "../appium/config.js";

let client: AppiumClient | null = null;

// Lazy-init singleton client
async function getClient(): Promise<AppiumClient> {
  if (!client) {
    client = new AppiumClient();
  }
  return client;
}

// Check if Appium is available
export async function checkAppium(): Promise<boolean> {
  try {
    const c = await getClient();
    await c.getSession();
    return true;
  } catch {
    return false;
  }
}

// Get browser session for raw operations
export async function getBrowser() {
  const c = await getClient();
  return c.getSession();
}

// --- Element Operations (fast) ---

export async function hasElement(testId: string): Promise<boolean> {
  const browser = await getBrowser();
  const el = await browser.$(buildSelector(testId));
  return el.isExisting();
}

export async function tapElement(testId: string, waitMs = 500): Promise<boolean> {
  const browser = await getBrowser();
  const el = await browser.$(buildSelector(testId));
  if (!(await el.isExisting())) return false;
  await el.click();
  if (waitMs > 0) await browser.pause(waitMs);
  return true;
}

export async function waitForElement(testId: string, timeoutMs = 10000): Promise<boolean> {
  const browser = await getBrowser();
  const el = await browser.$(buildSelector(testId));
  try {
    await el.waitForDisplayed({ timeout: timeoutMs });
    return true;
  } catch {
    return false;
  }
}

export async function waitForAny(testIds: string[], timeoutMs = 10000): Promise<string | null> {
  const browser = await getBrowser();
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    for (const testId of testIds) {
      const el = await browser.$(buildSelector(testId));
      if (await el.isExisting()) {
        return testId;
      }
    }
    await browser.pause(100);
  }
  return null;
}

export async function tapAndWait(
  tapTarget: string,
  waitTarget: string,
  timeoutMs = 5000,
): Promise<boolean> {
  if (!(await tapElement(tapTarget, 200))) return false;
  return waitForElement(waitTarget, timeoutMs);
}

export async function typeText(text: string): Promise<void> {
  const browser = await getBrowser();
  // Type into currently focused element
  const el = await browser.$("//android.widget.EditText[@focused='true']");
  if (await el.isExisting()) {
    await el.setValue(text);
  } else {
    // Fallback: use shell input
    const escaped = text.replace(/ /g, "%s").replace(/'/g, "\\'");
    await browser.execute("mobile: shell", {
      command: "input",
      args: ["text", escaped],
    });
  }
}

export async function typeInto(testId: string, text: string, clear = true): Promise<void> {
  const browser = await getBrowser();
  const el = await browser.$(buildSelector(testId));
  await el.waitForDisplayed({ timeout: 5000 });
  if (clear) {
    await el.clearValue();
  }
  await el.setValue(text);
}

export async function clearInput(testId?: string): Promise<void> {
  const browser = await getBrowser();
  if (testId) {
    const el = await browser.$(buildSelector(testId));
    await el.clearValue();
  } else {
    // Clear focused input
    const el = await browser.$("//android.widget.EditText[@focused='true']");
    if (await el.isExisting()) {
      await el.clearValue();
    }
  }
}

export async function getElementText(testId: string): Promise<string | null> {
  const browser = await getBrowser();
  const el = await browser.$(buildSelector(testId));
  if (!(await el.isExisting())) return null;
  return el.getText();
}

// --- Navigation ---

export async function pressBack(): Promise<void> {
  const browser = await getBrowser();
  await browser.execute("mobile: shell", {
    command: "input",
    args: ["keyevent", "KEYCODE_BACK"],
  });
}

export async function goHome(): Promise<boolean> {
  if (await hasElement("home-screen")) return true;

  if (await tapElement("Home", 500)) {
    if (await hasElement("home-screen")) return true;
  }

  for (let i = 0; i < 5; i++) {
    await pressBack();
    await pause(500);
    if (await hasElement("home-screen")) return true;
    if (await tapElement("Home", 500)) {
      if (await hasElement("home-screen")) return true;
    }
  }

  return false;
}

// --- Swipe/Scroll ---

export async function swipe(
  direction: "up" | "down" | "left" | "right",
  distance = 0.75,
  duration = 500,
): Promise<void> {
  const browser = await getBrowser();
  const { width, height } = await browser.getWindowSize();

  const centerX = Math.round(width / 2);
  const centerY = Math.round(height / 2);

  let startX = centerX, startY = centerY, endX = centerX, endY = centerY;
  const distPx = Math.round(Math.min(width, height) * distance * 0.4);

  switch (direction) {
    case "up":
      startY = centerY + distPx;
      endY = centerY - distPx;
      break;
    case "down":
      startY = centerY - distPx;
      endY = centerY + distPx;
      break;
    case "left":
      startX = centerX + distPx;
      endX = centerX - distPx;
      break;
    case "right":
      startX = centerX - distPx;
      endX = centerX + distPx;
      break;
  }

  await browser
    .action("pointer", { parameters: { pointerType: "touch" } })
    .move({ x: startX, y: startY })
    .down()
    .pause(duration)
    .move({ x: endX, y: endY })
    .up()
    .perform();
}

// --- App Control ---

export async function launchApp(): Promise<void> {
  const browser = await getBrowser();
  const config = getConfig();
  await browser.activateApp(config.appPackage);
}

export async function killApp(): Promise<void> {
  const browser = await getBrowser();
  const config = getConfig();
  await browser.terminateApp(config.appPackage, {});
}

export async function restartApp(): Promise<void> {
  await killApp();
  await pause(500);
  await launchApp();
}

export async function clearApp(): Promise<void> {
  const browser = await getBrowser();
  const config = getConfig();
  await browser.execute("mobile: clearApp", { appId: config.appPackage });
}

export async function reloadApp(full = false): Promise<void> {
  const c = await getClient();
  await c.reloadApp(full);
}

// --- Screen/UI ---

export async function getPageSource(): Promise<string> {
  const c = await getClient();
  return c.getPageSource();
}

export async function getUiHierarchy(): Promise<ElementNode | null> {
  const xml = await getPageSource();
  return parsePageSource(xml);
}

export async function getTestIds(): Promise<string[]> {
  const root = await getUiHierarchy();
  return collectTestIds(root);
}

export async function takeScreenshot(): Promise<string> {
  const c = await getClient();
  return c.takeScreenshot();
}

// --- Utility ---

export async function pause(ms: number): Promise<void> {
  const browser = await getBrowser();
  await browser.pause(ms);
}

export function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

// Run shell command on device
export async function shell(command: string, args: string[] = []): Promise<string> {
  const browser = await getBrowser();
  const result = await browser.execute("mobile: shell", { command, args });
  return String(result || "");
}

// Get app info via dumpsys
export async function getAppInfo(): Promise<string> {
  const config = getConfig();
  return shell("dumpsys", ["package", config.appPackage]);
}
