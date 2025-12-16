// @ts-nocheck - MCP SDK type inference is complex
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppiumClient } from "../appium/client.js";
import { parsePageSource, type FilterType } from "../utils/xml-parser.js";

export function registerGetScreenTool(server: McpServer, client: AppiumClient) {
  server.tool(
    "getScreen",
    "Get structured representation of all visible elements as JSON. Primary tool for understanding app state.",
    {
      maxDepth: z.number().optional().describe("Max nesting depth (default: 10)"),
      filter: z.enum(["all", "interactive", "text"]).optional().describe("Filter: all, interactive, or text"),
    } as never,
    async ({ maxDepth = 10, filter = "all" }: { maxDepth?: number; filter?: string }) => {
      try {
        const xml = await client.getPageSource();
        const tree = parsePageSource(xml, {
          maxDepth,
          filter: filter as FilterType,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(tree, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error getting screen: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
