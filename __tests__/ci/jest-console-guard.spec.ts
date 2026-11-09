import { spawnSync } from "child_process"
import { join } from "path"

import { it } from "@jest/globals"

/**
 * The console guard in jest.setup.js and the GitHub reporters in jest.config.js only show
 * their worth on a run that goes wrong, and a run that goes wrong in CI, where failed tests
 * are retried. So this runs the repo's own Jest config in a child process, under CI=true,
 * over fixture files the normal test pattern never picks up, and asserts on what that run
 * reports and how it exits. A retry that passes must not hide a console call made once, and
 * output from a later hook must not be blamed on the next test.
 */

const ROOT = join(__dirname, "..", "..")
const FIXTURES = join(__dirname, "jest-console-guard-fixtures")
const JEST = require.resolve("jest/bin/jest")
const CHILD_RUN_TIMEOUT_MS = 120_000

type FileResult = {
  name: string
  status: "passed" | "failed"
  message: string
  assertionResults: ReadonlyArray<{ title: string; status: string }>
}

const runJest = (
  fixtures: ReadonlyArray<string>,
  env: Record<string, string>,
  output: "json" | "reporters",
) => {
  const childEnv: NodeJS.ProcessEnv = { ...process.env }
  // The child decides these from what each case passes, not from the parent run.
  delete childEnv.CI
  delete childEnv.GITHUB_ACTIONS
  delete childEnv.JEST_ALLOW_CONSOLE
  delete childEnv.JEST_WORKER_ID

  const result = spawnSync(
    process.execPath,
    [
      JEST,
      "--config",
      join(ROOT, "jest.config.js"),
      "--roots",
      FIXTURES,
      "--testRegex",
      "\\.fixture\\.ts$",
      "--runInBand",
      "--forceExit",
      ...(output === "json" ? ["--json"] : []),
      ...fixtures.map((fixture) => `/${fixture}\\.fixture\\.ts$`),
    ],
    { cwd: ROOT, env: { ...childEnv, ...env }, encoding: "utf8" },
  )
  return { status: result.status, stdout: result.stdout, stderr: result.stderr }
}

const fileResults = (stdout: string): Record<string, FileResult> => {
  const { testResults } = JSON.parse(stdout) as { testResults: FileResult[] }
  return Object.fromEntries(
    testResults.map((file) => [
      file.name.slice(FIXTURES.length + 1).replace(/\.fixture\.ts$/, ""),
      file,
    ]),
  )
}

describe("console guard, under CI retries", () => {
  let status: number | null
  let results: Record<string, FileResult>

  beforeAll(() => {
    const run = runJest(
      ["import-time", "warn-once", "teardown-hook", "in-test", "spied", "library-noise"],
      { CI: "true" },
      "json",
    )
    status = run.status
    results = fileResults(run.stdout)
  }, CHILD_RUN_TIMEOUT_MS)

  it("fails the run", () => {
    expect(status).not.toBe(0)
  })

  it("fails a file whose only console call ran at import", () => {
    expect(results["import-time"].status).toBe("failed")
    expect(results["import-time"].message).toContain("while the spec file loaded")
    expect(results["import-time"].message).toContain("import-time log")
  })

  it("fails a file whose one-time warning was gone by the retry", () => {
    expect(results["warn-once"].status).toBe("failed")
    expect(results["warn-once"].message).toContain("already failed a test in this file")
  })

  it("reports a later hook's output against the test it ran after, not the next one", () => {
    const file = results["teardown-hook"]

    expect(file.status).toBe("failed")
    expect(file.message).toContain('in a hook after "first test" finished')
    expect(file.assertionResults.map(({ title, status }) => [title, status])).toEqual([
      ["first test", "passed"],
      ["second test", "passed"],
    ])
  })

  it("fails the test that logged in its own body", () => {
    expect(results["in-test"].status).toBe("failed")
    expect(results["in-test"].assertionResults[0].status).toBe("failed")
    expect(results["in-test"].message).toContain(
      'console.error in "warns in its own body"',
    )
  })

  it("passes a spec that spies on the call it expects", () => {
    expect(results.spied.status).toBe("passed")
  })

  it("passes the listed library noise", () => {
    expect(results["library-noise"].status).toBe("passed")
  })
})

describe("console guard, with JEST_ALLOW_CONSOLE=1", () => {
  it(
    "fails nothing",
    () => {
      const run = runJest(
        ["import-time", "warn-once", "in-test"],
        { CI: "true", JEST_ALLOW_CONSOLE: "1" },
        "json",
      )

      expect(run.status).toBe(0)
      expect(Object.values(fileResults(run.stdout)).map(({ status }) => status)).toEqual([
        "passed",
        "passed",
        "passed",
      ])
    },
    CHILD_RUN_TIMEOUT_MS,
  )
})

describe("GitHub Actions reporters", () => {
  it(
    "annotates each failure and failed retry, and prints the failure once",
    () => {
      const run = runJest(
        ["reporter"],
        { CI: "true", GITHUB_ACTIONS: "true" },
        "reporters",
      )
      const output = run.stdout + run.stderr
      const lines = output.split("\n")

      expect(run.status).not.toBe(0)
      expect(lines.filter((line) => line.startsWith("::error "))).toHaveLength(1)
      expect(
        lines.filter((line) => line.startsWith("::warning ") && line.includes("RETRY")),
      ).toHaveLength(3)
      // Outside the annotations, the failure is printed once: in the per-file group at the end.
      expect(
        lines.filter((line) => !line.startsWith("::") && line.includes("Expected: 3")),
      ).toHaveLength(1)
      expect(output).not.toMatch(/^PASS /m)
      expect(output).toContain("Tests:       1 failed, 1 passed, 2 total")
    },
    CHILD_RUN_TIMEOUT_MS,
  )
})
