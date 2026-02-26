import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { AppiumClient } from "./appium/client.js"
import { registerTools } from "./tools/index.js"

async function main() {
  const server = new McpServer({
    name: "blink-dev",
    version: "1.0.0",
  })

  // Single shared Appium client for Blink-specific tools
  const appiumClient = new AppiumClient()

  // Register Blink-specific tools
  // Generic Appium operations (tap, type, swipe, screenshot, etc.)
  // are handled by the official appium-mcp server
  registerTools(server, appiumClient)

  // Use stdio transport for Claude Code/Desktop
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error("blink-dev MCP server running (Blink-specific tools)")
}

main().catch(console.error)
