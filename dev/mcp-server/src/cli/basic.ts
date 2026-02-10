import { writeFileSync } from "fs"
import { Command } from "commander"
import {
  tapElement,
  typeText,
  getUiHierarchy,
  pressBack,
  swipe,
  reloadApp,
  launchApp,
  killApp,
  restartApp,
  clearApp,
  getAppInfo,
  takeScreenshot,
  checkAppium,
  fail,
} from "./appium.js"
import { collectUiInfo } from "../utils/xml-parser.js"

export function registerBasicCommands(program: Command) {
  program
    .command("tap <target>")
    .alias("t")
    .description("Tap element by testID or coordinates (x,y)")
    .action(async (target: string) => {
      if (!(await tapElement(target))) {
        fail(`Element '${target}' not found`)
      }
      console.log(`Tapped '${target}'`)
    })

  program
    .command("screen [path]")
    .alias("s")
    .description("Take screenshot")
    .action(async (path = "/tmp/screen.png") => {
      const base64 = await takeScreenshot()
      writeFileSync(path, Buffer.from(base64, "base64"))
      console.log(path)
    })

  program
    .command("ui")
    .alias("u")
    .description("Show UI elements (testIDs and text content)")
    .option("-j, --json", "Output as JSON")
    .option("-v, --verbose", "Show element tags")
    .action(async (opts: { json?: boolean; verbose?: boolean }) => {
      const root = await getUiHierarchy()
      if (!root) {
        fail("Failed to get UI hierarchy")
      }
      const items = collectUiInfo(root)

      // Dedupe by id, keep text-only items
      const seen = new Set<string>()
      const deduped = items.filter((i) => {
        if (i.id) {
          if (seen.has(i.id)) return false
          seen.add(i.id)
        }
        return i.id || i.text
      })

      if (opts.json) {
        console.log(JSON.stringify(deduped, null, 2))
        return
      }

      // Simple line format: id  "text"  (tag)
      for (const item of deduped) {
        const parts: string[] = []
        if (item.id) parts.push(item.id)
        if (item.text) {
          const t = item.text.length > 40 ? item.text.slice(0, 40) + "..." : item.text
          parts.push(`"${t}"`)
        }
        if (opts.verbose) parts.push(`(${item.tag})`)
        console.log(parts.join("  "))
      }
    })

  program
    .command("type <text...>")
    .description("Type text into focused input")
    .action(async (words: string[]) => {
      await typeText(words.join(" "))
      console.log(`Typed: ${words.join(" ")}`)
    })

  program
    .command("back")
    .alias("b")
    .description("Press back button")
    .action(async () => {
      await pressBack()
      console.log("Back pressed")
    })

  program
    .command("swipe <direction>")
    .description("Swipe in direction (up|down|left|right)")
    .action(async (direction: string) => {
      if (!["up", "down", "left", "right"].includes(direction)) {
        fail(`Unknown direction: ${direction}. Use: up, down, left, right`)
      }
      await swipe(direction as "up" | "down" | "left" | "right")
      console.log(`Swiped ${direction}`)
    })

  program
    .command("reload")
    .alias("r")
    .description("Hot reload app via Metro")
    .action(async () => {
      await reloadApp(false)
      console.log("Reload complete")
    })

  // App lifecycle commands
  const appCmd = program.command("app").description("App lifecycle commands")

  appCmd
    .command("launch")
    .alias("l")
    .description("Launch the app")
    .action(async () => {
      await launchApp()
      console.log("App launched")
    })

  appCmd
    .command("kill")
    .alias("k")
    .description("Force stop the app")
    .action(async () => {
      await killApp()
      console.log("App killed")
    })

  appCmd
    .command("restart")
    .description("Kill and relaunch the app")
    .action(async () => {
      await restartApp()
      console.log("App restarted")
    })

  appCmd
    .command("clear")
    .description("Clear app data (full reset)")
    .action(async () => {
      await clearApp()
      console.log("App data cleared")
    })

  appCmd
    .command("info")
    .description("Show app package info")
    .action(async () => {
      const info = await getAppInfo()
      const lines = info
        .split("\n")
        .filter((l) => /versionName|versionCode|firstInstallTime|lastUpdateTime/.test(l))
      if (lines.length) {
        console.log(lines.map((l) => l.trim()).join("\n"))
      } else {
        fail("App not installed")
      }
    })

  // Check command to verify Appium is running
  program
    .command("check")
    .description("Check if Appium is available")
    .action(async () => {
      if (await checkAppium()) {
        console.log("Appium is available")
      } else {
        fail("Appium not available at localhost:4723\nRun: ./dev/mcp/orchestrator.sh")
      }
    })
}
