/**
 * @jest-environment node
 */
import path from "path"

import { describe, expect, it } from "@jest/globals"

// Runs the repo's real .eslintrc.json against small fixtures, so the account boundaries
// are pinned by what ESLint reports, not by what the config text looks like.

type Message = { ruleId: string | null; severity: number }
type Linter = {
  lintText: (
    code: string,
    options: { filePath: string },
  ) => Promise<{ messages: Message[] }[]>
}
// eslint ships no type declarations in this repo
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ESLint } = require("eslint") as {
  ESLint: new (options: { cwd: string }) => Linter
}

const repoRoot = path.resolve(__dirname, "..")
const eslint = new ESLint({ cwd: repoRoot })

const BOUNDARY_RULE = "import/no-restricted-paths"
const LEGACY_COLOR_RULE = "no-restricted-syntax"

const WARN = 1
const ERROR = 2

const severitiesOf = async (
  code: string,
  filePath: string,
  ruleId: string,
): Promise<number[]> => {
  const [result] = await eslint.lintText(code, {
    filePath: path.join(repoRoot, filePath),
  })
  return result.messages
    .filter((message) => message.ruleId === ruleId)
    .map(({ severity }) => severity)
}

/** Every way a module can reach another, so a boundary cannot be stepped around by
 *  writing the same dependency differently. */
const reachesOf = (aliased: string, relative: string): [string, string][] => [
  ["a static import", `import { a } from "${aliased}"`],
  ["a type import", `import type { A } from "${aliased}"`],
  ["a re-export", `export { a } from "${aliased}"`],
  ["a re-export of everything", `export * from "${aliased}"`],
  ["a dynamic import", `export const load = () => import("${aliased}")`],
  ["a require", `export const m = require("${aliased}")`],
  ["a relative path", `import { a } from "${relative}"`],
]

describe("account namespace boundaries", () => {
  const custodialFixture = "app/custodial/lint-fixture.ts"

  it.each(reachesOf("@app/self-custodial/bridge", "../self-custodial/bridge"))(
    "refuses custodial code reaching self-custodial code through %s",
    async (_case, code) => {
      expect(await severitiesOf(code, custodialFixture, BOUNDARY_RULE)).toEqual([ERROR])
    },
  )

  it.each(
    reachesOf(
      "@app/screens/self-custodial/mode-switch-success-screen",
      "../screens/self-custodial/mode-switch-success-screen",
    ),
  )(
    "refuses custodial code reaching a self-custodial screen through %s",
    async (_case, code) => {
      expect(await severitiesOf(code, custodialFixture, BOUNDARY_RULE)).toEqual([ERROR])
    },
  )

  const selfCustodialFixtures: [string, string][] = [
    ["app/self-custodial/lint-fixture.ts", "../custodial/two-factor-session"],
    ["app/screens/self-custodial/lint-fixture.tsx", "../../custodial/two-factor-session"],
    [
      "app/screens/settings-screen/self-custodial/lint-fixture.tsx",
      "../../../custodial/two-factor-session",
    ],
  ]

  describe.each(selfCustodialFixtures)("from %s", (fixture, relative) => {
    it.each(reachesOf("@app/custodial/two-factor-session", relative))(
      "refuses reaching custodial code through %s",
      async (_case, code) => {
        expect(await severitiesOf(code, fixture, BOUNDARY_RULE)).toEqual([ERROR])
      },
    )
  })

  it("lets self-custodial code reach its own namespace", async () => {
    const code = `import { a } from "@app/self-custodial/bridge"`

    expect(
      await severitiesOf(
        code,
        "app/screens/self-custodial/lint-fixture.tsx",
        BOUNDARY_RULE,
      ),
    ).toEqual([])
  })

  it("lets a shared screen render a namespace's component", async () => {
    const code = `import { A } from "@app/custodial/components/two-factor-home-card"`

    expect(
      await severitiesOf(code, "app/screens/home-screen/lint-fixture.tsx", BOUNDARY_RULE),
    ).toEqual([])
  })
})

/** The boundaries live in their own rule, so the design-token warning keeps reaching the
 *  account namespaces like every other tree. */
describe("legacy color tokens in the account namespaces", () => {
  it.each([
    "app/custodial/lint-fixture.tsx",
    "app/self-custodial/lint-fixture.tsx",
    "app/screens/self-custodial/lint-fixture.tsx",
    "app/screens/settings-screen/self-custodial/lint-fixture.tsx",
  ])("still warns in %s", async (fixture) => {
    expect(
      await severitiesOf("const c = colors.grey2", fixture, LEGACY_COLOR_RULE),
    ).toEqual([WARN])
  })
})
