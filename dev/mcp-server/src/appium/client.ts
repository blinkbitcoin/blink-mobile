import { remote } from "webdriverio"
import { getConfig } from "./config.js"

type WdioBrowser = Awaited<ReturnType<typeof remote>>

/**
 * Minimal Appium client for Blink-specific tools.
 *
 * Generic Appium operations (tap, type, swipe, screenshot, find element,
 * launch app) are handled by the official `appium/appium-mcp` server.
 *
 * This client only exposes what the kept blink-dev tools need:
 * - getPageSource() — used by getScreen, reloadApp
 * - getSession() — used by waitFor (element waits), reloadApp (shell commands)
 * - disconnect() — cleanup
 */
export class AppiumClient {
  private browser: WdioBrowser | null = null
  private connecting: Promise<WdioBrowser> | null = null

  /** Get or create session — always returns a valid browser */
  async getSession(): Promise<WdioBrowser> {
    if (this.browser?.sessionId) return this.browser
    if (this.connecting) return this.connecting

    this.connecting = this.connect()
    try {
      this.browser = await this.connecting
      return this.browser
    } finally {
      this.connecting = null
    }
  }

  /** Create new Appium session */
  private async connect(): Promise<WdioBrowser> {
    const config = getConfig()
    const capabilities = {
      "platformName": "Android",
      "appium:deviceName": config.deviceName,
      "appium:appPackage": config.appPackage,
      "appium:appActivity": ".MainActivity",
      "appium:automationName": "UiAutomator2",
      "appium:snapshotMaxDepth": 500,
      "appium:noReset": true,
      "appium:skipUnlock": true,
    } as WebdriverIO.Capabilities
    return remote({
      hostname: config.host,
      port: config.port,
      path: "/",
      capabilities,
      logLevel: "silent",
    })
  }

  /** Trigger hot reload via Metro dev menu */
  async reloadApp(fullReload: boolean = false): Promise<void> {
    const browser = await this.getSession()
    const config = getConfig()

    if (fullReload) {
      await browser.terminateApp(config.appPackage, {})
      await browser.activateApp(config.appPackage)
    } else {
      // Open dev menu (keycode 82 opens the dev menu on Android)
      await browser.execute("mobile: shell", {
        command: "input",
        args: ["keyevent", "82"],
      })
      await browser.pause(500)
      // Tap "Reload" in dev menu
      const reloadBtn = await browser.$("~Reload")
      if (await reloadBtn.isExisting()) {
        await reloadBtn.click()
      }
    }
  }

  /** Get page source as XML */
  async getPageSource(): Promise<string> {
    const browser = await this.getSession()
    return browser.getPageSource()
  }

  /** Disconnect session */
  async disconnect(): Promise<void> {
    if (this.browser) {
      await this.browser.deleteSession()
      this.browser = null
    }
  }
}
