// @ts-nocheck - MCP SDK type inference is complex
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppiumClient } from "../appium/client.js";
import { parsePageSource } from "../utils/xml-parser.js";

export function registerReloadAppTool(server: McpServer, client: AppiumClient) {
  server.tool(
    "reloadApp",
    "Trigger Metro hot reload after code changes. Returns current screen state after reload.",
    {
      waitMs: z.number().optional().describe("Wait time for reload in ms (default: 2000)"),
      fullReload: z.boolean().optional().describe("Full reload vs hot reload (default: false)"),
    } as never,
    async ({ waitMs = 2000, fullReload = false }: { waitMs?: number; fullReload?: boolean }) => {
      try {
        await client.reloadApp(fullReload);

        // Wait for reload to complete
        const browser = await client.getSession();
        await browser.pause(waitMs);

        // Get current screen state
        const xml = await client.getPageSource();
        const screen = parsePageSource(xml, { maxDepth: 10, filter: "all" });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: fullReload ? "full_reloaded" : "hot_reloaded",
                  screen,
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error reloading app: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
