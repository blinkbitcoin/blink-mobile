import fs from "fs"
import path from "path"

import { MAX_FONT_SIZE_MULTIPLIER } from "@app/rne-theme/text-scaling"

/**
 * The ceiling reaches every themed `Text` through the theme, but React Native's own `Text`
 * is outside that reach: a component built on it follows the OS text size without limit
 * unless it carries the ceiling itself. That is how the app kept growing new screens that
 * clip and truncate at the larger accessibility sizes, one component at a time.
 *
 * So this walks the source rather than a rendered tree: it is the check that makes the
 * policy hold for screens nobody has written yet, which no per-component test can do.
 */
const APP_DIR = path.join(__dirname, "..", "..", "app")

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(entryPath)
    return entry.isFile() && entry.name.endsWith(".tsx") ? [entryPath] : []
  })

/** The local name React Native's `Text` carries in this file, or null if it imports none. */
const reactNativeTextName = (source: string): string | null => {
  const rnImport = /import\s*\{([^}]*)\}\s*from\s*"react-native"/s.exec(source)
  if (!rnImport) return null

  const imported = /(?:^|,)\s*Text(?:\s+as\s+(\w+))?\s*(?:,|$)/s.exec(rnImport[1])
  if (!imported) return null

  return imported[1] ?? "Text"
}

/** Every opening tag of that component, with the props it was given. */
const openingTags = (source: string, name: string): string[] => {
  const tags = new RegExp(`<${name}(\\s[^>]*)?>`, "gs")
  return [...source.matchAll(tags)].map((match) => match[0])
}

describe("text scaling coverage", () => {
  const offenders = sourceFiles(APP_DIR).flatMap((file) => {
    const source = fs.readFileSync(file, "utf8")
    const name = reactNativeTextName(source)
    if (!name) return []

    const uncapped = openingTags(source, name).filter(
      (tag) => !tag.includes("maxFontSizeMultiplier"),
    )
    return uncapped.length > 0 ? [path.relative(APP_DIR, file)] : []
  })

  /**
   * Fails with the files to fix rather than a bare boolean: whoever adds the next screen
   * reads the failure, not this test.
   */
  it("caps every text the theme cannot reach", () => {
    expect(offenders).toEqual([])
  })

  /** The walk itself has to be looking at something, or an empty list proves nothing. */
  it("reads the app's own sources", () => {
    expect(sourceFiles(APP_DIR).length).toBeGreaterThan(100)
  })

  it("holds a ceiling to cap them to", () => {
    expect(MAX_FONT_SIZE_MULTIPLIER).toBeGreaterThan(1)
  })
})
