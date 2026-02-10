import { remote } from "webdriverio"
import { getConfig } from "./config.js"

type WdioBrowser = Awaited<ReturnType<typeof remote>>

export class AppiumClient {
  private browser: WdioBrowser | null = null
  private connecting: Promise<WdioBrowser> | null = null

  // Get or create session - always returns a valid browser
  async getSession(): Promise<WdioBrowser> {
    if (this.browser?.sessionId) return this.browser
    if (this.connecting) return this.connecting

    this.connecting = this.connect()
    this.browser = await this.connecting
    this.connecting = null
    return this.browser
  }

  // Create new Appium session
  private async connect(): Promise<WdioBrowser> {
    const config = getConfig()
    // Appium capabilities use vendor-prefixed keys not in WebDriverIO base types
    // Use appPackage instead of app to avoid reinstalling the 226MB APK every time
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

  // Trigger hot reload via Metro dev menu
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

  // Get page source as XML
  async getPageSource(): Promise<string> {
    const browser = await this.getSession()
    return browser.getPageSource()
  }

  // Take screenshot
  async takeScreenshot(): Promise<string> {
    const browser = await this.getSession()
    return browser.takeScreenshot()
  }

  // Disconnect session
  async disconnect(): Promise<void> {
    if (this.browser) {
      await this.browser.deleteSession()
      this.browser = null
    }
  }
}
