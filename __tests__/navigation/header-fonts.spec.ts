import { readFileSync } from "fs"

// The native header and tab bar draw their own text, in the platform font unless their
// style names a face. Rendering the full RootNavigator would require mocking dozens of
// screens and providers, so the styles are pinned at source level instead.
describe("navigation text faces in root-navigator", () => {
  const source = readFileSync(require.resolve("@app/navigation/root-navigator"), "utf8")

  const styleBlocks = (name: string) => {
    const blocks = [
      ...source.matchAll(new RegExp(`\\n  ${name}: \\{([^}]*)\\}`, "g")),
    ].map((match) => match[1])
    expect(blocks.length).toBeGreaterThan(0)
    return blocks
  }

  const navigators = source.split(/<\w+\.Navigator\b/).slice(1)
  const stacks = navigators.filter((options) => options.includes("headerTitleStyle"))

  it("draws header titles in the bold face at 20 (Heading 2/Bold)", () => {
    styleBlocks("title").forEach((title) => {
      expect(title).toContain("fontFamily: fonts.bold")
      expect(title).toContain("fontSize: 20")
      expect(title).not.toContain("fontWeight")
    })
  })

  // A `headerTitle` function is handed no `headerTitleStyle`, so the face has to travel
  // with the element it returns.
  it("gives the rendered header title the bold face", () => {
    const renderer = /const renderHeaderTitle = [\s\S]*?\n\)\n/.exec(source)?.[0]

    expect(renderer).toContain("style={headerTitleStyles.title}")
  })

  it("draws the iOS back title in the regular face", () => {
    styleBlocks("backTitle").forEach((backTitle) => {
      expect(backTitle).toContain("fontFamily: fonts.regular")
    })
  })

  it("gives every stack navigator the title and back title styles", () => {
    expect(stacks).toHaveLength(4)
    stacks.forEach((options) => {
      expect(options).toContain("headerTitleStyle: styles.title")
      expect(options).toContain("headerTitle: renderHeaderTitle")
      expect(options).toContain("headerBackTitleStyle: styles.backTitle")
    })
  })

  it("draws tab bar labels in the bold face", () => {
    expect(source).toContain("tabBarLabel: renderTabBarLabel")
    styleBlocks("label").forEach((label) => {
      expect(label).toContain("fontFamily: fonts.bold")
      expect(label).not.toContain("fontWeight")
    })
  })
})
