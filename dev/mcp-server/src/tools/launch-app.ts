import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { AppiumClient } from "../appium/client.js";
import { getConfig } from "../appium/config.js";

export function registerLaunchAppTool(server: McpServer, client: AppiumClient) {
  (server as any).tool(
    "launchApp",
    "Launch or restart the app from scratch",
    {
      fresh: z.boolean().optional().describe("Clear app data before launch (default: false)"),
    } as never,
    async ({ fresh = false }: { fresh?: boolean }) => {
      try {
        const browser = await client.getSession();
        const config = getConfig();

        if (fresh) {
          // Clear app data and restart
          await browser.execute("mobile: clearApp", {
            appId: config.appPackage,
          });
        }

        // Terminate and relaunch
        await browser.terminateApp(config.appPackage, {});
        await browser.activateApp(config.appPackage);

        // Wait for app to stabilize
        await browser.pause(2000);

        return {
          content: [
            {
              type: "text",
              text: fresh ? "App launched with fresh data" : "App launched",
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error launching app: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
