// @ts-nocheck - MCP SDK type inference is complex
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppiumClient } from "../appium/client.js";

export function registerSwipeTool(server: McpServer, client: AppiumClient) {
  server.tool(
    "swipe",
    "Perform swipe gestures to scroll or navigate. Note: 'up' scrolls content down (finger moves up).",
    {
      direction: z.enum(["up", "down", "left", "right"]).describe("Swipe direction"),
      duration: z.number().optional().describe("Swipe duration in ms (default: 500)"),
      distance: z.number().optional().describe("Distance as fraction 0-1 (default: 0.75)"),
    } as never,
    async ({ direction, duration = 500, distance = 0.75 }: { direction: string; duration?: number; distance?: number }) => {
      try {
        const browser = await client.getSession();

        // Get screen dimensions
        const { width, height } = await browser.getWindowSize();

        // Calculate start and end points
        const centerX = width / 2;
        const centerY = height / 2;
        const offsetX = (width * distance) / 2;
        const offsetY = (height * distance) / 2;

        let startX: number, startY: number, endX: number, endY: number;

        switch (direction) {
          case "up": // Scroll content down (finger moves up)
            startX = centerX;
            startY = centerY + offsetY;
            endX = centerX;
            endY = centerY - offsetY;
            break;
          case "down": // Scroll content up (finger moves down)
            startX = centerX;
            startY = centerY - offsetY;
            endX = centerX;
            endY = centerY + offsetY;
            break;
          case "left": // Swipe left
            startX = centerX + offsetX;
            startY = centerY;
            endX = centerX - offsetX;
            endY = centerY;
            break;
          case "right": // Swipe right
            startX = centerX - offsetX;
            startY = centerY;
            endX = centerX + offsetX;
            endY = centerY;
            break;
        }

        await browser
          .action("pointer", {
            parameters: { pointerType: "touch" },
          })
          .move({ x: Math.round(startX), y: Math.round(startY) })
          .down()
          .pause(duration)
          .move({ x: Math.round(endX), y: Math.round(endY) })
          .up()
          .perform();

        return {
          content: [{ type: "text", text: `Swiped ${direction}` }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error swiping ${direction}: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
