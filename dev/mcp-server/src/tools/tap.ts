import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppiumClient } from "../appium/client.js";
import { buildSelector } from "../utils/selectors.js";

export function registerTapTool(server: McpServer, client: AppiumClient) {
  server.tool(
    "tap",
    "Tap an element by its testID",
    {
      id: z.string().describe("Element testID to tap"),
      waitMs: z.number().optional().describe("Pause after tap (default: 500ms)"),
    },
    // @ts-expect-error - MCP SDK has complex recursive types for Zod schema inference
    async ({ id, waitMs = 500 }: { id: string; waitMs?: number }) => {
      try {
        const browser = await client.getSession();
        const selector = buildSelector(id);
        const element = await browser.$(selector);

        await element.waitForDisplayed({ timeout: 30000 });
        await element.click();
        await browser.pause(waitMs);

        return {
          content: [{ type: "text" as const, text: `Tapped: ${id}` }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error tapping ${id}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
