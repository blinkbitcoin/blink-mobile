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

/**
 * The local name a React Native component carries in this file, or null if it imports none.
 * Both of these render text the theme cannot reach: the label and the field the user types
 * into, placeholder included.
 */
const reactNativeName = (source: string, component: string): string | null => {
  /** Every react-native import, not the first: a file may split its values across two, and
   *  reading only one silently exempts the rest of the file from the walk. */
  const rnImports = [...source.matchAll(/import\s*\{([^}]*)\}\s*from\s*"react-native"/gs)]

  const imported = new RegExp(
    `(?:^|,)\\s*${component}(?:\\s+as\\s+(\\w+))?\\s*(?:,|$)`,
    "s",
  )

  for (const rnImport of rnImports) {
    const match = imported.exec(rnImport[1])
    if (match) return match[1] ?? component
  }

  return null
}

/**
 * Every JSX opening tag of that component. A type position names the same component
 * without rendering anything (`useRef<TextInput>`, `Array<TextInput | null>`), and the
 * difference is what sits before the angle bracket: a generic is always opened by the
 * identifier it belongs to, where JSX never is.
 */
const openingTags = (source: string, name: string): string[] => {
  const starts = new RegExp(`(^|[^\\w.])<${name}(?=[\\s/>])`, "gs")

  return [...source.matchAll(starts)].flatMap((start) => {
    const from = start.index + start[0].length

    /**
     * Scanned rather than matched to the next `>`: a prop can hold one of its own, and an
     * arrow in a handler would end the tag early and hide every prop after it, reporting a
     * capped component as uncapped. Braces are what tell them apart.
     */
    let depth = 0
    for (let at = from; at < source.length; at += 1) {
      const char = source[at]
      if (char === "{") depth += 1
      else if (char === "}") depth -= 1
      else if (char === ">" && depth === 0) return [source.slice(from, at)]
    }

    return []
  })
}

/**
 * The theme reaches components imported from `@rn-vui/themed` and nothing else, so the same
 * component taken from `@rn-vui/base` renders outside the policy: a Button drawn from there
 * grows its title past the ceiling, and a SearchBar its placeholder. They carry it as props
 * instead, which is what these two look for.
 */
const uncappedFromBase = (): string[] =>
  sourceFiles(APP_DIR).flatMap((file) => {
    const source = fs.readFileSync(file, "utf8")
    const baseImport = /import\s*\{([^}]*)\}\s*from\s*"@rn-vui\/base"/s.exec(source)
    if (!baseImport) return []

    const uncapped = ["Button", "SearchBar"]
      .filter((component) => new RegExp(`\\b${component}\\b`).test(baseImport[1]))
      .flatMap((component) => openingTags(source, component))
      .filter((tag) => !tag.includes("maxFontSizeMultiplier"))

    return uncapped.length > 0 ? [path.relative(APP_DIR, file)] : []
  })

const uncappedIn = (component: string): string[] =>
  sourceFiles(APP_DIR).flatMap((file) => {
    const source = fs.readFileSync(file, "utf8")
    const name = reactNativeName(source, component)
    if (!name) return []

    const uncapped = openingTags(source, name).filter(
      (tag) => !tag.includes("maxFontSizeMultiplier"),
    )
    return uncapped.length > 0 ? [path.relative(APP_DIR, file)] : []
  })

describe("text scaling coverage", () => {
  const offenders = [
    ...uncappedIn("Text"),
    ...uncappedIn("TextInput"),
    ...uncappedFromBase(),
  ]

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

/**
 * The walk is only worth what it reads: a tag it cuts short hides the props that follow,
 * and a component it never recognises is exempt without anyone noticing. Both failures
 * are silent in the walk above, so they are pinned here.
 */
describe("the walk's own reading", () => {
  it("keeps a tag whole past an arrow in one of its props", () => {
    const source = `<Text onPress={() => close()} maxFontSizeMultiplier={CAP}>hi</Text>`

    expect(openingTags(source, "Text")[0]).toContain("maxFontSizeMultiplier")
  })

  it("reads a tag broken across lines", () => {
    const source = `<Text\n  style={styles.a}\n  maxFontSizeMultiplier={CAP}\n>\n  hi\n</Text>`

    expect(openingTags(source, "Text")[0]).toContain("maxFontSizeMultiplier")
  })

  /** A type position renders nothing; counting it would report a file that has no tag. */
  it("passes over the component named as a type", () => {
    const source = `const ref = useRef<TextInput>(null)`

    expect(openingTags(source, "TextInput")).toEqual([])
  })

  it("finds the component however the file spreads its react-native imports", () => {
    const source = `import { View } from "react-native"\nimport { Text as RNText } from "react-native"`

    expect(reactNativeName(source, "Text")).toBe("RNText")
  })

  it("names nothing for a file that imports no such component", () => {
    const source = `import { View } from "react-native"`

    expect(reactNativeName(source, "Text")).toBeNull()
  })
})
