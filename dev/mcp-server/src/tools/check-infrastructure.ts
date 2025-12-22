// @ts-nocheck - MCP SDK type inference is complex
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface ServiceStatus {
  name: string;
  ready: boolean;
  message: string;
}

async function checkService(
  name: string,
  cmd: string,
  timeoutMs: number = 5000
): Promise<ServiceStatus> {
  try {
    await execAsync(cmd, { timeout: timeoutMs });
    return { name, ready: true, message: "OK" };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return { name, ready: false, message: msg };
  }
}

export function registerCheckInfrastructureTool(server: McpServer) {
  server.tool(
    "checkInfrastructure",
    "Verify all MCP infrastructure services (emulator, Metro, Appium, app) are running. Call this before using other tools to ensure the environment is ready.",
    {} as never,
    async () => {
      const checks = await Promise.all([
        checkService(
          "emulator",
          "adb shell getprop sys.boot_completed 2>/dev/null | grep -q 1"
        ),
        checkService(
          "metro",
          "curl -sf http://127.0.0.1:8081/status | grep -q packager-status:running"
        ),
        checkService("appium", "curl -sf http://127.0.0.1:4723/status"),
        checkService(
          "app",
          "adb shell pidof com.galoyapp >/dev/null 2>&1"
        ),
      ]);

      const allReady = checks.every((c) => c.ready);
      const services = checks.reduce(
        (acc, c) => ({
          ...acc,
          [c.name]: { ready: c.ready, message: c.message },
        }),
        {} as Record<string, { ready: boolean; message: string }>
      );

      const text = allReady
        ? "All infrastructure services are ready."
        : `Infrastructure not ready. Failed services: ${checks
            .filter((c) => !c.ready)
            .map((c) => c.name)
            .join(", ")}. Run: ./dev/mcp/orchestrator.sh`;

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ ready: allReady, services, hint: text }, null, 2),
          },
        ],
        isError: !allReady,
      };
    }
  );
}
