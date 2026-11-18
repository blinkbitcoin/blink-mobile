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

/**
 * Reanimated's `Animated.Text` is React Native's `Text` under another name, so the theme
 * never reaches it. The same is true of a local alias (`import Reanimated`) and of a
 * `createAnimatedComponent(TextInput)` binding. The walk has to name those or dropping the
 * ceiling on the slider label stays green.
 */
const animatedQualifiers = (source: string): string[] => {
  const names = new Set<string>()

  for (const match of source.matchAll(
    /import\s+(\w+)\s*(?:,\s*\{[^}]*\})?\s*from\s*"react-native-reanimated"/gs,
  )) {
    names.add(match[1])
  }

  for (const match of source.matchAll(
    /import\s*\*\s*as\s+(\w+)\s*from\s*"react-native-reanimated"/gs,
  )) {
    names.add(match[1])
  }

  for (const imported of source.matchAll(
    /import\s*\{([^}]*)\}\s*from\s*"react-native"/gs,
  )) {
    const named = /(?:^|,)\s*Animated(?:\s+as\s+(\w+))?\s*(?:,|$)/s.exec(imported[1])
    if (named) names.add(named[1] ?? "Animated")
  }

  return [...names]
}

const memberTags = (source: string, qualifier: string, member: string): string[] => {
  const starts = new RegExp(`(^|[^\\w.])<${qualifier}\\.${member}(?=[\\s/>])`, "gs")

  return [...source.matchAll(starts)].flatMap((start) => {
    const from = start.index + start[0].length
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

const animatedHosts = (source: string): string[] =>
  [
    ...source.matchAll(
      /\b(\w+)\s*=\s*\w+\.createAnimatedComponent\(\s*(Text|TextInput)\s*\)/g,
    ),
  ].map((match) => match[1])

const uncappedAnimatedTags = (source: string): string[] => {
  const members = animatedQualifiers(source).flatMap((qualifier) => [
    ...memberTags(source, qualifier, "Text"),
    ...memberTags(source, qualifier, "TextInput"),
  ])
  const hosts = animatedHosts(source).flatMap((name) => openingTags(source, name))

  return [...members, ...hosts].filter((tag) => !tag.includes("maxFontSizeMultiplier"))
}

const uncappedAnimated = (): string[] =>
  sourceFiles(APP_DIR).flatMap((file) => {
    const uncapped = uncappedAnimatedTags(fs.readFileSync(file, "utf8"))
    return uncapped.length > 0 ? [path.relative(APP_DIR, file)] : []
  })

describe("text scaling coverage", () => {
  const offenders = [
    ...uncappedIn("Text"),
    ...uncappedIn("TextInput"),
    ...uncappedFromBase(),
    ...uncappedAnimated(),
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

  /** The slider label is this tag. Dropping the prop has to fail the walk, not pass it. */
  it("reports an Animated.Text that drops the ceiling", () => {
    const source = `import Animated from "react-native-reanimated"\n<Animated.Text>Slide</Animated.Text>`

    expect(uncappedAnimatedTags(source)).toHaveLength(1)
  })

  it("accepts an Animated.Text that carries the ceiling", () => {
    const source = `import Animated from "react-native-reanimated"\n<Animated.Text maxFontSizeMultiplier={CAP}>Slide</Animated.Text>`

    expect(uncappedAnimatedTags(source)).toEqual([])
  })

  it("follows a renamed reanimated import", () => {
    const source = `import Reanimated from "react-native-reanimated"\n<Reanimated.Text>Slide</Reanimated.Text>`

    expect(uncappedAnimatedTags(source)).toHaveLength(1)
  })

  it("follows Animated imported from react-native under another name", () => {
    const source = `import { Animated as Motion } from "react-native"\n<Motion.Text>Slide</Motion.Text>`

    expect(uncappedAnimatedTags(source)).toHaveLength(1)
  })

  it("reports a createAnimatedComponent host that drops the ceiling", () => {
    const source = `const AnimText = Reanimated.createAnimatedComponent(TextInput)\n<AnimText value="" />`

    expect(uncappedAnimatedTags(source)).toHaveLength(1)
  })

  /**
   * The production tag, not a toy: stripping the multiplier from the slider label is the
   * edit that used to leave this suite green.
   */
  it("fails when the slider label drops the ceiling", () => {
    const source = fs.readFileSync(
      path.join(APP_DIR, "components/atomic/galoy-slider-button/galoy-slider-button.tsx"),
      "utf8",
    )
    const stripped = source.replace(
      "maxFontSizeMultiplier={MAX_FONT_SIZE_MULTIPLIER}\n",
      "",
    )

    expect(stripped).not.toBe(source)
    expect(uncappedAnimatedTags(source)).toEqual([])
    expect(uncappedAnimatedTags(stripped)).toHaveLength(1)
  })
})
