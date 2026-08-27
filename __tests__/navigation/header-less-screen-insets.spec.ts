import fs from "fs"
import path from "path"

const APP_DIR = path.resolve(__dirname, "..", "..", "app")
const NAVIGATION_DIR = path.join(APP_DIR, "navigation")

/**
 * A route that hides the navigation header has no toolbar reserving the status bar, so
 * its screen has to ask for the top inset itself. `Screen` only adds that edge when it
 * is told the header is hidden, and from Android 15 the window runs edge to edge, so a
 * screen that stays silent draws its first row underneath the status bar.
 *
 * This walks the navigators rather than a hand-kept list, so a new header-less route
 * cannot be added without either handling its insets or being recorded below.
 */

type Route = { name: string; component: string; file: string }

const readSource = (file: string): string => fs.readFileSync(file, "utf8")

const navigationSources = (): string[] =>
  fs
    .readdirSync(NAVIGATION_DIR)
    .filter((name) => name.endsWith(".tsx"))
    .map((name) => path.join(NAVIGATION_DIR, name))

const SCREEN_ENTRY = /<\w+\.Screen\b([\s\S]*?)(?:\/>|<\/\w+\.Screen>)/g

const headerLessRoutes = (): Route[] => {
  const routes: Route[] = []
  for (const file of navigationSources()) {
    const source = readSource(file)
    for (const match of source.matchAll(SCREEN_ENTRY)) {
      const entry = match[1]
      const name = entry.match(/name="([^"]+)"/)
      const component = entry.match(/component=\{(\w+)\}/)
      const isHeaderLess = entry.includes("headerShown: false")
      if (name && component && isHeaderLess) {
        routes.push({ name: name[1], component: component[1], file })
      }
    }
  }
  return routes
}

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    const isSource = entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")
    return isSource ? [full] : []
  })

const componentFile = (component: string): string | null => {
  const declaration = new RegExp(
    `export (?:const|function) ${component}\\b|const ${component}: React\\.FC`,
  )
  for (const file of sourceFiles(APP_DIR)) {
    if (declaration.test(readSource(file))) return file
  }
  return null
}

/**
 * Screens that opt out of `Screen`'s safe area on purpose and pay the insets from their
 * own layout, or that render no chrome at all. Each is a deliberate exception, so the
 * list may shrink but should not grow without a reason recorded here.
 */
const HANDLES_ITS_OWN_INSETS = new Set([
  // Full-bleed camera preview; the controls read useSafeAreaInsets directly.
  "ScanningQRCodeGated",
  // Full-bleed detail sheet; reads useSafeAreaInsets directly.
  "TransactionDetailScreen",
  // Redirect-only, renders no UI of its own.
  "MigrationEntryScreen",
  // Full-bleed map; MapComponent offsets its own controls by insets.top.
  "MapScreen",
  // Decorative full-bleed maps and quiz backdrops, unchanged by this rule.
  "EarnMapScreen",
  "EarnQuiz",
  "SectionCompleted",
  // Nested navigators: their own routes carry the options.
  "PrimaryNavigator",
  "ContactNavigator",
  "OnboardingNavigator",
  "PhoneLoginNavigator",
])

/**
 * `Screen` only adds the top edge when it is told the header is hidden, so a hard
 * `headerShown={true}` leaves the status bar uncovered. A screen may still pass an
 * expression: `getStarted` shows its header only when there is somewhere to go back to,
 * and hands `Screen` the very flag it toggles the header with.
 */
const declaresHeaderHidden = (tag: string): boolean => {
  const headerShown = tag.match(/headerShown=\{([^}]*)\}/)
  if (!headerShown) return false
  return headerShown[1].trim() !== "true"
}

const declaresTopInset = (source: string): boolean => {
  const screenTags = source.match(/<Screen\b[^>]*>/g) ?? []
  if (screenTags.length === 0) return true
  return screenTags.every((tag) => {
    const optsOut = /\bunsafe\b/.test(tag)
    const overridesEdges = /edges=\{\[[^\]]*"top"/.test(tag)
    return declaresHeaderHidden(tag) || optsOut || overridesEdges
  })
}

describe("header-less routes and the top inset", () => {
  const routes = headerLessRoutes()

  it("finds the header-less routes to check", () => {
    expect(routes.length).toBeGreaterThan(0)
  })

  it("keeps no stale entries in the exception list", () => {
    const headerLess = new Set(routes.map((route) => route.component))
    const stale = [...HANDLES_ITS_OWN_INSETS].filter(
      (component) => !headerLess.has(component),
    )
    expect(stale).toEqual([])
  })

  routes
    .filter((route) => !HANDLES_ITS_OWN_INSETS.has(route.component))
    .forEach((route) => {
      it(`${route.name} (${route.component}) asks Screen for the top inset`, () => {
        const file = componentFile(route.component)
        expect(file).not.toBeNull()
        expect(declaresTopInset(readSource(file as string))).toBe(true)
      })
    })
})
