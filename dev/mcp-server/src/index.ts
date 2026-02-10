import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { AppiumClient } from "./appium/client.js"
import { registerTools } from "./tools/index.js"

async function main() {
  const server = new McpServer({
    name: "blink-appium",
    version: "1.0.0",
  })

  // Single shared Appium client
  const appiumClient = new AppiumClient()

  // Register all tools
  registerTools(server, appiumClient)

  // Use stdio transport for Claude Code/Desktop
  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error("Blink Appium MCP server running")
}

main().catch(console.error)
