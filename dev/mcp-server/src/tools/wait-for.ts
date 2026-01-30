import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppiumClient } from "../appium/client.js";
import { buildSelector } from "../utils/selectors.js";

export function registerWaitForTool(server: McpServer, client: AppiumClient) {
  (server as any).tool(
    "waitFor",
    "Wait until element appears or reaches desired state",
    {
      id: z.string().describe("Element testID to wait for"),
      timeout: z.number().optional().describe("Max wait time in ms (default: 30000)"),
      state: z.enum(["displayed", "enabled", "clickable", "gone"]).optional().describe("State to wait for (default: displayed)"),
    } as never,
    async ({ id, timeout = 30000, state = "displayed" }: { id: string; timeout?: number; state?: string }) => {
      try {
        const browser = await client.getSession();
        const selector = buildSelector(id);
        const element = await browser.$(selector);

        switch (state) {
          case "displayed":
            await element.waitForDisplayed({ timeout });
            break;
          case "enabled":
            await element.waitForEnabled({ timeout });
            break;
          case "clickable":
            await element.waitForClickable({ timeout });
            break;
          case "gone":
            await element.waitForDisplayed({ timeout, reverse: true });
            break;
        }

        return {
          content: [{ type: "text", text: `Element ${id} is ${state}` }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Timeout waiting for ${id} to be ${state}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
