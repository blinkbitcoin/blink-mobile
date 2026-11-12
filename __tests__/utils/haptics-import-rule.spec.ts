/**
 * @jest-environment node
 */
import { join } from "path"

/** The slice of ESLint's Node API used here; the repo has no @types/eslint. */
type LintMessage = { ruleId: string | null; message: string }
type ESLintApi = new (options: { cwd: string }) => {
  lintText: (
    code: string,
    options: { filePath: string },
  ) => Promise<Array<{ messages: LintMessage[] }>>
}
const { ESLint } = jest.requireActual<{ ESLint: ESLintApi }>("eslint")

/**
 * Every haptic goes through app/utils/haptics.ts, so each intent keeps one feel and one
 * silent-mode rule (blinkbitcoin/blink-wip#2041). The lint rule is what keeps a new
 * screen from calling the library directly again.
 */

const ROOT = join(__dirname, "..", "..")
const DIRECT_IMPORT = `import ReactNativeHapticFeedback from "react-native-haptic-feedback"
export const buzz = () => ReactNativeHapticFeedback.trigger("impactLight")
`

const restrictedImportErrors = async (filePath: string) => {
  const eslint = new ESLint({ cwd: ROOT })
  const [result] = await eslint.lintText(DIRECT_IMPORT, {
    filePath: join(ROOT, filePath),
  })
  return result.messages.filter((m) => m.ruleId === "no-restricted-imports")
}

describe("react-native-haptic-feedback import rule", () => {
  jest.setTimeout(60_000)

  it("refuses the library in a screen", async () => {
    const errors = await restrictedImportErrors("app/screens/some-screen/some-screen.tsx")

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain("app/utils/haptics.ts")
  })

  it("refuses the library in a component or hook", async () => {
    expect(await restrictedImportErrors("app/components/some/some.tsx")).toHaveLength(1)
    expect(await restrictedImportErrors("app/hooks/use-some.ts")).toHaveLength(1)
  })

  it("allows it in the haptics helper", async () => {
    expect(await restrictedImportErrors("app/utils/haptics.ts")).toHaveLength(0)
  })

  it("allows it in specs, which mock and assert on the library", async () => {
    expect(await restrictedImportErrors("__tests__/utils/some.spec.ts")).toHaveLength(0)
  })

  it("still refuses Crashlytics in the files exempt from the haptics path", async () => {
    const eslint = new ESLint({ cwd: ROOT })
    const [result] = await eslint.lintText(
      'import crashlytics from "@react-native-firebase/crashlytics"\nexport const c = crashlytics\n',
      { filePath: join(ROOT, "app/utils/haptics.ts") },
    )

    expect(result.messages.map((m) => m.ruleId)).toContain("no-restricted-imports")
  })
})
