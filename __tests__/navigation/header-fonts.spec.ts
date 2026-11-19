import { readFileSync } from "fs"

// The native header and tab bar draw their own text, in the platform font unless their
// style names a face. Rendering the full RootNavigator would require mocking dozens of
// screens and providers, so the styles are pinned at source level instead.
describe("navigation text faces in root-navigator", () => {
  const source = readFileSync(require.resolve("@app/navigation/root-navigator"), "utf8")

  const styleBlock = (name: string) => {
    const match = new RegExp(`\\n  ${name}: \\{([^}]*)\\}`).exec(source)
    expect(match).not.toBeNull()
    return match?.[1] ?? ""
  }

  const navigators = source.split(/<\w+\.Navigator\b/).slice(1)

  it("draws header titles in the bold face at 20 (Heading 2/Bold)", () => {
    const title = styleBlock("title")

    expect(title).toContain("fontFamily: fonts.bold")
    expect(title).toContain("fontSize: 20")
    expect(title).not.toContain("fontWeight")
  })

  it("draws the iOS back title in the regular face", () => {
    expect(styleBlock("backTitle")).toContain("fontFamily: fonts.regular")
  })

  it("gives every stack navigator the title and back title styles", () => {
    const stacks = navigators.filter((options) => options.includes("headerTitleStyle"))

    expect(stacks).toHaveLength(4)
    stacks.forEach((options) => {
      expect(options).toContain("headerTitleStyle: styles.title")
      expect(options).toContain("headerBackTitleStyle: styles.backTitle")
    })
  })

  it("draws tab bar labels in the bold face", () => {
    const tabLabel = /tabBarLabelStyle: \{([^}]*)\}/.exec(source)?.[1]

    expect(tabLabel).toContain("fontFamily: fonts.bold")
    expect(tabLabel).not.toContain("fontWeight")
  })
})
