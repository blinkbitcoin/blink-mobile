// @ts-nocheck - MCP SDK type inference is complex
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { AppiumClient } from "../appium/client.js";

export function registerScreenshotTool(server: McpServer, client: AppiumClient) {
  server.tool(
    "screenshot",
    "Capture actual screen as base64 PNG image. Use sparingly - prefer getScreen for token efficiency.",
    {} as never,
    async () => {
      try {
        const base64Image = await client.takeScreenshot();

        return {
          content: [
            {
              type: "image",
              data: base64Image,
              mimeType: "image/png",
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error taking screenshot: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
