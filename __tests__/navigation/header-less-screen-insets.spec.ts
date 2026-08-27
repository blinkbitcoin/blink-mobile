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

type HeaderLessScreen = { label: string; component: string }

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

const BAILOUT_RENDER = /return\s*\(?\s*<([A-Z]\w*)(?![\w.])[^<>]*\/>/g

/**
 * A component the file hands the whole screen over to before any header is in play: the
 * navigator bails out to it instead of mounting its tree, or a header-less route
 * delegates to it. It draws with no toolbar above it, so the same rule reaches it.
 */
const bailoutRenders = (source: string): string[] =>
  [...source.matchAll(BAILOUT_RENDER)].map((match) => match[1])

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    const isSource = entry.name.endsWith(".tsx") || entry.name.endsWith(".ts")
    return isSource ? [full] : []
  })

let appSources: string[] | null = null

const componentFile = (component: string): string | null => {
  const declaration = new RegExp(
    `export (?:const|function) ${component}\\b|const ${component}: React\\.FC`,
  )
  appSources = appSources ?? sourceFiles(APP_DIR)
  for (const file of appSources) {
    if (declaration.test(readSource(file))) return file
  }
  return null
}

/**
 * Every screen that renders without a header: the header-less routes, the components a
 * navigator bails out to, and whatever those in turn delegate to.
 */
const headerLessScreens = (): HeaderLessScreen[] => {
  const screens: HeaderLessScreen[] = []
  const queued = new Set<string>()
  const pending: HeaderLessScreen[] = []

  const enqueue = (screen: HeaderLessScreen) => {
    if (queued.has(screen.component)) return
    queued.add(screen.component)
    pending.push(screen)
  }

  for (const route of headerLessRoutes()) {
    enqueue({ label: route.name, component: route.component })
  }
  for (const file of navigationSources()) {
    for (const component of bailoutRenders(readSource(file))) {
      enqueue({ label: `${path.basename(file)} bail-out`, component })
    }
  }

  const enqueueDelegates = (screen: HeaderLessScreen) => {
    /** An accepted exception already answers for everything it draws, delegates included. */
    if (HANDLES_ITS_OWN_INSETS.has(screen.component)) return
    const file = componentFile(screen.component)
    if (!file) return
    for (const component of bailoutRenders(readSource(file))) {
      enqueue({ label: `${screen.component} bail-out`, component })
    }
  }

  while (pending.length > 0) {
    const screen = pending.shift() as HeaderLessScreen
    screens.push(screen)
    enqueueDelegates(screen)
  }

  return screens
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

/**
 * The opening tag of every `<Name ...>` in the file, ending at the `>` that closes it
 * rather than at one nested inside a prop like `header={<Close />}` or an arrow.
 */
const openingTags = (source: string, name: string): string[] => {
  const tags: string[] = []
  for (const match of source.matchAll(new RegExp(`<${name}\\b`, "g"))) {
    const start = match.index as number
    let depth = 0
    for (let i = start; i < source.length; i += 1) {
      if (source[i] === "<") depth += 1
      if (source[i] === ">" && source[i - 1] !== "=") depth -= 1
      if (depth === 0) {
        tags.push(source.slice(start, i + 1))
        break
      }
    }
  }
  return tags
}

const HEADER_PASSTHROUGH = /<Screen\b[^>]*headerShown=\{headerShown\}/
const LAYOUT_EXPORT = /export const (\w+): React\.FC/g

/**
 * A layout that takes a `headerShown` prop and hands it straight to `Screen`. A screen
 * built on one never writes `<Screen>` itself, so the rule has to reach through it. A
 * screen that passes some other flag, like `getStarted`, is answering for itself.
 *
 * Every component the file exports counts, not just the first: naming the wrong one would
 * take the layout out of the rule without failing anything.
 */
let insetLayouts: string[] | null = null

const layoutComponents = (): string[] => {
  appSources = appSources ?? sourceFiles(APP_DIR)
  insetLayouts =
    insetLayouts ??
    appSources.flatMap((file) => {
      const source = readSource(file)
      if (!HEADER_PASSTHROUGH.test(source)) return []
      return [...source.matchAll(LAYOUT_EXPORT)].map((exported) => exported[1])
    })
  return insetLayouts
}

const declaresTopInset = (source: string): boolean => {
  const screenTags = ["Screen", ...layoutComponents()].flatMap((name) =>
    openingTags(source, name),
  )
  if (screenTags.length === 0) return true
  return screenTags.every((tag) => {
    const optsOut = /\bunsafe\b/.test(tag)
    const overridesEdges = /edges=\{\[[^\]]*"top"/.test(tag)
    return declaresHeaderHidden(tag) || optsOut || overridesEdges
  })
}

describe("header-less routes and the top inset", () => {
  const screens = headerLessScreens()

  it("finds the header-less screens to check", () => {
    expect(screens.length).toBeGreaterThan(0)
  })

  /** Screens built on a layout carry no `<Screen>` of their own, so losing the layouts
   *  would wave them through on nothing rather than fail. */
  it("finds the layouts that forward headerShown", () => {
    expect(layoutComponents().length).toBeGreaterThan(0)
  })

  it("keeps no stale entries in the exception list", () => {
    const headerLess = new Set(screens.map((screen) => screen.component))
    const stale = [...HANDLES_ITS_OWN_INSETS].filter(
      (component) => !headerLess.has(component),
    )
    expect(stale).toEqual([])
  })

  screens
    .filter((screen) => !HANDLES_ITS_OWN_INSETS.has(screen.component))
    .forEach((screen) => {
      it(`${screen.label} (${screen.component}) asks Screen for the top inset`, () => {
        const file = componentFile(screen.component)
        expect(file).not.toBeNull()
        expect(declaresTopInset(readSource(file as string))).toBe(true)
      })
    })
})
