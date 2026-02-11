import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { AppiumClient } from "../appium/client.js"

// Blink-specific tools (not covered by official appium-mcp)
import { registerGetScreenTool } from "./get-screen.js"
import { registerWaitForTool } from "./wait-for.js"
import { registerReloadAppTool } from "./reload-app.js"
import { registerCheckInfrastructureTool } from "./check-infrastructure.js"
import { registerStartServicesTool } from "./start-services.js"

export function registerTools(server: McpServer, client: AppiumClient) {
  // Screen analysis (parsed JSON page source with testIDs)
  registerGetScreenTool(server, client)

  // Element wait tool
  registerWaitForTool(server, client)

  // App reload (Metro hot reload)
  registerReloadAppTool(server, client)

  // Infrastructure tools
  registerCheckInfrastructureTool(server)
  registerStartServicesTool(server)
}
