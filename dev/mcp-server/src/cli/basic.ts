import { execSync } from "child_process";
import { Command } from "commander";
import { adb, tapElement, typeText, getUiHierarchy, collectTestIds, collectUiInfo } from "./helpers.js";

export function registerBasicCommands(program: Command) {
  program
    .command("tap <target>")
    .alias("t")
    .description("Tap element by testID or coordinates (x,y)")
    .action((target: string) => {
      if (!tapElement(target)) {
        console.error(`Element '${target}' not found`);
        process.exit(1);
      }
    });

  program
    .command("screen [path]")
    .alias("s")
    .description("Take screenshot")
    .action((path = "/tmp/screen.png") => {
      execSync(`adb exec-out screencap -p > ${path}`);
      console.log(path);
    });

  program
    .command("ui")
    .alias("u")
    .description("Show UI elements (testIDs and text content)")
    .option("-j, --json", "Output as JSON")
    .option("-v, --verbose", "Show element tags")
    .action((opts: { json?: boolean; verbose?: boolean }) => {
      const root = getUiHierarchy();
      if (!root) {
        console.error("Failed to get UI hierarchy");
        process.exit(1);
      }
      const items = collectUiInfo(root);

      // Dedupe by id, keep text-only items
      const seen = new Set<string>();
      const deduped = items.filter(i => {
        if (i.id) {
          if (seen.has(i.id)) return false;
          seen.add(i.id);
        }
        return i.id || i.text;
      });

      if (opts.json) {
        console.log(JSON.stringify(deduped, null, 2));
        return;
      }

      // Simple line format: id  "text"  (tag)
      for (const item of deduped) {
        const parts: string[] = [];
        if (item.id) parts.push(item.id);
        if (item.text) {
          const t = item.text.length > 40 ? item.text.slice(0, 40) + "..." : item.text;
          parts.push(`"${t}"`);
        }
        if (opts.verbose) parts.push(`(${item.tag})`);
        console.log(parts.join("  "));
      }
    });

  program
    .command("type <text...>")
    .description("Type text into focused input")
    .action((words: string[]) => typeText(words.join(" ")));

  program
    .command("back")
    .alias("b")
    .description("Press back button")
    .action(() => {
      adb("shell input keyevent KEYCODE_BACK");
      console.log("Back pressed");
    });

  program
    .command("swipe <direction>")
    .description("Swipe in direction (up|down|left|right)")
    .action((direction: string) => {
      const swipes: Record<string, string> = {
        up: "shell input swipe 540 1800 540 600 300",
        down: "shell input swipe 540 600 540 1800 300",
        left: "shell input swipe 900 1200 180 1200 300",
        right: "shell input swipe 180 1200 900 1200 300",
      };
      const cmd = swipes[direction];
      if (!cmd) {
        console.error(`Unknown direction: ${direction}. Use: up, down, left, right`);
        process.exit(1);
      }
      adb(cmd);
      console.log(`Swiped ${direction}`);
    });

  program
    .command("reload")
    .alias("r")
    .description("Hot reload app via Metro")
    .action(() => {
      const APP_PACKAGE = "com.galoyapp";
      const APP_ACTIVITY = `${APP_PACKAGE}/.MainActivity`;
      adb(`shell am start -n ${APP_ACTIVITY}`);
      try {
        execSync("curl -s http://localhost:8081/reload", { encoding: "utf-8", timeout: 5000 });
      } catch {
        console.error("Failed to reload - is Metro running on port 8081?");
        process.exit(1);
      }
      execSync("sleep 2");
      adb(`shell am start -n ${APP_ACTIVITY}`);
      console.log("Reload complete");
    });
}
