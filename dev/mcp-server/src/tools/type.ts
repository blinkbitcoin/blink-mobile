import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppiumClient } from "../appium/client.js";
import { buildSelector } from "../utils/selectors.js";

export function registerTypeTool(server: McpServer, client: AppiumClient) {
  (server as any).tool(
    "type",
    "Enter text into an input field",
    {
      id: z.string().describe("Input element testID"),
      text: z.string().describe("Text to enter"),
      clear: z.boolean().optional().describe("Clear existing text first (default: true)"),
      submit: z.boolean().optional().describe("Press enter/submit after typing (default: false)"),
    } as never,
    async ({ id, text, clear = true, submit = false }: { id: string; text: string; clear?: boolean; submit?: boolean }) => {
      try {
        const browser = await client.getSession();
        const selector = buildSelector(id);
        const element = await browser.$(selector);

        await element.waitForDisplayed({ timeout: 30000 });

        if (clear) {
          await element.clearValue();
        }

        await element.setValue(text);

        if (submit) {
          // Press Enter key
          await browser.execute("mobile: shell", {
            command: "input",
            args: ["keyevent", "66"], // KEYCODE_ENTER
          });
        }

        return {
          content: [{ type: "text", text: `Typed '${text}' into ${id}` }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error typing into ${id}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
