// @ts-nocheck - MCP SDK type inference is complex
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AppiumClient } from "../appium/client.js";

// Core tools
import { registerGetScreenTool } from "./get-screen.js";
import { registerTapTool } from "./tap.js";
import { registerTypeTool } from "./type.js";
import { registerWaitForTool } from "./wait-for.js";

// Additional tools
import { registerSwipeTool } from "./swipe.js";
import { registerGetElementTool } from "./get-element.js";
import { registerScreenshotTool } from "./screenshot.js";
import { registerLaunchAppTool } from "./launch-app.js";
import { registerReloadAppTool } from "./reload-app.js";
import { registerCheckInfrastructureTool } from "./check-infrastructure.js";

export function registerTools(server: McpServer, client: AppiumClient) {
  // Core viewing tools
  registerGetScreenTool(server, client);
  registerGetElementTool(server, client);
  registerScreenshotTool(server, client);

  // Interaction tools
  registerTapTool(server, client);
  registerTypeTool(server, client);
  registerSwipeTool(server, client);

  // Control flow tools
  registerWaitForTool(server, client);
  registerLaunchAppTool(server, client);
  registerReloadAppTool(server, client);

  // Infrastructure tools
  registerCheckInfrastructureTool(server);
}
