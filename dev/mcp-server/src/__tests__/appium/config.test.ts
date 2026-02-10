import { describe, it, expect, afterEach, vi } from "vitest"
import { getConfig } from "../../appium/config.js"

describe("getConfig", () => {
  const originalEnv = { ...process.env }

  afterEach(() => {
    // Restore original env
    process.env = { ...originalEnv }
  })

  it("returns default config when no env vars set", () => {
    delete process.env.APPIUM_HOST
    delete process.env.APPIUM_PORT
    delete process.env.TEST_DEVICE_ANDROID
    delete process.env.TEST_APK_PATH

    const config = getConfig()
    expect(config.host).toBe("127.0.0.1")
    expect(config.port).toBe(4723)
    expect(config.deviceName).toBe("emulator-5554")
    expect(config.appPackage).toBe("com.galoyapp")
    expect(config.appPath).toContain("app-universal-debug.apk")
  })

  it("uses APPIUM_HOST env var", () => {
    process.env.APPIUM_HOST = "192.168.1.100"
    const config = getConfig()
    expect(config.host).toBe("192.168.1.100")
  })

  it("uses APPIUM_PORT env var", () => {
    process.env.APPIUM_PORT = "4724"
    const config = getConfig()
    expect(config.port).toBe(4724)
  })

  it("uses TEST_DEVICE_ANDROID env var", () => {
    process.env.TEST_DEVICE_ANDROID = "Pixel_6"
    const config = getConfig()
    expect(config.deviceName).toBe("Pixel_6")
  })

  it("uses TEST_APK_PATH env var", () => {
    process.env.TEST_APK_PATH = "/custom/path/app.apk"
    const config = getConfig()
    expect(config.appPath).toBe("/custom/path/app.apk")
  })

  it("always returns com.galoyapp as appPackage", () => {
    const config = getConfig()
    expect(config.appPackage).toBe("com.galoyapp")
  })
})
