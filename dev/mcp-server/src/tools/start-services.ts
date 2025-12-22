// @ts-nocheck - MCP SDK type inference is complex
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { spawn } from "child_process";
import { existsSync, unlinkSync } from "fs";
import { join } from "path";

const PROJECT_ROOT = join(import.meta.dirname, "../../../..");
const MCP_STATE_DIR = join(PROJECT_ROOT, ".mcp");
const READY_MARKER = join(MCP_STATE_DIR, "ready");
const ORCHESTRATOR = join(PROJECT_ROOT, "dev/mcp/orchestrator.sh");

export function registerStartServicesTool(server: McpServer) {
  server.tool(
    "startServices",
    "Start all MCP infrastructure services (emulator, Metro, Appium, app). Waits for completion. Use checkInfrastructure first to see if services are already running.",
    {} as never,
    async () => {
      // Remove stale marker
      if (existsSync(READY_MARKER)) {
        unlinkSync(READY_MARKER);
      }

      return new Promise((resolve) => {
        const proc = spawn(ORCHESTRATOR, [], {
          cwd: PROJECT_ROOT,
          stdio: ["ignore", "pipe", "pipe"],
        });

        let stdout = "";
        let stderr = "";

        proc.stdout?.on("data", (data) => {
          stdout += data.toString();
        });

        proc.stderr?.on("data", (data) => {
          stderr += data.toString();
        });

        // Timeout after 5 minutes
        const timeout = setTimeout(() => {
          proc.kill();
          resolve({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Timeout after 5 minutes",
                  output: stdout.slice(-2000),
                }, null, 2),
              },
            ],
            isError: true,
          });
        }, 300000);

        proc.on("close", (code) => {
          clearTimeout(timeout);

          const success = code === 0 && existsSync(READY_MARKER);

          resolve({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success,
                  exitCode: code,
                  output: success ? "All services started" : stdout.slice(-2000),
                  error: stderr.slice(-500) || undefined,
                }, null, 2),
              },
            ],
            isError: !success,
          });
        });

        proc.on("error", (error) => {
          clearTimeout(timeout);
          resolve({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: error.message,
                }, null, 2),
              },
            ],
            isError: true,
          });
        });
      });
    }
  );
}
