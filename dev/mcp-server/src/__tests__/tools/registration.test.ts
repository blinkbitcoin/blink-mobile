/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-types, max-params */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { AppiumClient } from "../../appium/client.js"
import { registerTools } from "../../tools/index.js"

// Mock webdriverio to avoid real connections
vi.mock("webdriverio", () => ({
  remote: vi.fn(),
}))

describe("registerTools", () => {
  let server: McpServer
  let client: AppiumClient
  const registeredTools: Map<
    string,
    { description: string; handler: (...args: unknown[]) => unknown }
  > = new Map()

  beforeEach(() => {
    registeredTools.clear()

    // Create a real McpServer but intercept tool registrations
    server = new McpServer({ name: "test", version: "1.0.0" })

    // Spy on tool registration
    vi.spyOn(server as any, "tool").mockImplementation(
      (
        name: string,
        description: string,
        _schema: unknown,
        handler?: (...args: unknown[]) => unknown,
      ) => {
        // Handle both 3-arg and 4-arg signatures
        const actualHandler = handler || (_schema as (...args: unknown[]) => unknown)
        registeredTools.set(name, { description, handler: actualHandler })
      },
    )

    client = new AppiumClient()
  })

  it("registers all expected tools", () => {
    registerTools(server, client)

    const expectedTools = [
      "getScreen",
      "getElement",
      "screenshot",
      "tap",
      "type",
      "swipe",
      "waitFor",
      "launchApp",
      "reloadApp",
      "checkInfrastructure",
      "startServices",
    ]

    for (const tool of expectedTools) {
      expect(
        registeredTools.has(tool),
        `Tool '${tool}' should be registered`,
      ).toBe(true)
    }
  })

  it("registers exactly 11 tools", () => {
    registerTools(server, client)
    expect(registeredTools.size).toBe(11)
  })

  it("each tool has a description", () => {
    registerTools(server, client)
    for (const [name, { description }] of registeredTools) {
      expect(description, `Tool '${name}' should have a description`).toBeTruthy()
      expect(typeof description).toBe("string")
    }
  })

  it("each tool has a handler function", () => {
    registerTools(server, client)
    for (const [name, { handler }] of registeredTools) {
      expect(typeof handler, `Tool '${name}' handler should be a function`).toBe(
        "function",
      )
    }
  })
})
