import { describe, it, expect, vi, beforeEach } from "vitest"
import { AppiumClient } from "../../appium/client.js"

// Mock webdriverio
vi.mock("webdriverio", () => ({
  remote: vi.fn(),
}))

describe("AppiumClient", () => {
  let client: AppiumClient

  beforeEach(() => {
    vi.clearAllMocks()
    client = new AppiumClient()
  })

  it("creates new instance without error", () => {
    expect(client).toBeInstanceOf(AppiumClient)
  })

  it("getSession creates connection on first call", async () => {
    const { remote } = await import("webdriverio")
    const mockBrowser = {
      sessionId: "test-session-123",
      getPageSource: vi.fn().mockResolvedValue("<hierarchy></hierarchy>"),
      takeScreenshot: vi.fn().mockResolvedValue("base64data"),
      deleteSession: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(remote).mockResolvedValue(mockBrowser as any)

    const browser = await client.getSession()
    expect(browser.sessionId).toBe("test-session-123")
    expect(remote).toHaveBeenCalledOnce()
  })

  it("getSession reuses existing session", async () => {
    const { remote } = await import("webdriverio")
    const mockBrowser = {
      sessionId: "test-session-123",
      getPageSource: vi.fn(),
      takeScreenshot: vi.fn(),
      deleteSession: vi.fn(),
    }
    vi.mocked(remote).mockResolvedValue(mockBrowser as any)

    const browser1 = await client.getSession()
    const browser2 = await client.getSession()
    expect(browser1).toBe(browser2)
    expect(remote).toHaveBeenCalledOnce()
  })

  it("getPageSource delegates to browser", async () => {
    const { remote } = await import("webdriverio")
    const mockXml = "<hierarchy><android.widget.Button /></hierarchy>"
    const mockBrowser = {
      sessionId: "test-session",
      getPageSource: vi.fn().mockResolvedValue(mockXml),
      takeScreenshot: vi.fn(),
      deleteSession: vi.fn(),
    }
    vi.mocked(remote).mockResolvedValue(mockBrowser as any)

    const result = await client.getPageSource()
    expect(result).toBe(mockXml)
    expect(mockBrowser.getPageSource).toHaveBeenCalledOnce()
  })

  it("takeScreenshot delegates to browser", async () => {
    const { remote } = await import("webdriverio")
    const mockBrowser = {
      sessionId: "test-session",
      getPageSource: vi.fn(),
      takeScreenshot: vi.fn().mockResolvedValue("iVBORw0KGgo="),
      deleteSession: vi.fn(),
    }
    vi.mocked(remote).mockResolvedValue(mockBrowser as any)

    const result = await client.takeScreenshot()
    expect(result).toBe("iVBORw0KGgo=")
  })

  it("disconnect cleans up session", async () => {
    const { remote } = await import("webdriverio")
    const mockBrowser = {
      sessionId: "test-session",
      getPageSource: vi.fn(),
      takeScreenshot: vi.fn(),
      deleteSession: vi.fn().mockResolvedValue(undefined),
    }
    vi.mocked(remote).mockResolvedValue(mockBrowser as any)

    await client.getSession()
    await client.disconnect()
    expect(mockBrowser.deleteSession).toHaveBeenCalledOnce()
  })

  it("getSession passes correct capabilities", async () => {
    const { remote } = await import("webdriverio")
    vi.mocked(remote).mockResolvedValue({
      sessionId: "test",
      getPageSource: vi.fn(),
      takeScreenshot: vi.fn(),
      deleteSession: vi.fn(),
    } as any)

    await client.getSession()

    const call = vi.mocked(remote).mock.calls[0][0]
    expect(call).toMatchObject({
      hostname: "127.0.0.1",
      port: 4723,
      path: "/",
      logLevel: "silent",
    })
    expect(call.capabilities).toMatchObject({
      "platformName": "Android",
      "appium:automationName": "UiAutomator2",
      "appium:appPackage": "com.galoyapp",
      "appium:noReset": true,
    })
  })
})
