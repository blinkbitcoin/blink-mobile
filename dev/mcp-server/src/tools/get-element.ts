// @ts-nocheck - MCP SDK type inference is complex
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppiumClient } from "../appium/client.js";
import { buildSelector } from "../utils/selectors.js";

export function registerGetElementTool(server: McpServer, client: AppiumClient) {
  server.tool(
    "getElement",
    "Get detailed info about one specific element by testID",
    {
      id: z.string().describe("Element testID"),
    } as never,
    async ({ id }: { id: string }) => {
      try {
        const browser = await client.getSession();
        const selector = buildSelector(id);
        const element = await browser.$(selector);

        const exists = await element.isExisting();
        if (!exists) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({ id, exists: false }, null, 2),
              },
            ],
          };
        }

        const [displayed, enabled, location, size, text] = await Promise.all([
          element.isDisplayed().catch(() => false),
          element.isEnabled().catch(() => false),
          element.getLocation().catch(() => ({ x: 0, y: 0 })),
          element.getSize().catch(() => ({ width: 0, height: 0 })),
          element.getText().catch(() => ""),
        ]);

        const result = {
          id,
          exists: true,
          displayed,
          enabled,
          text: text || undefined,
          location,
          size,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting element ${id}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
