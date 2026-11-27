import { readdirSync, readFileSync } from "fs"
import { join } from "path"

/**
 * The patch-package policy from docs/pr-review.md (Native / dependencies), for every file
 * in patches/:
 *
 * - The dependency is pinned to exactly the patched version, so an install can't resolve a
 *   release the patch wasn't written for. A git dependency counts when it names a commit.
 * - The patch links an issue or PR (in our org or upstream) whose resolution is the
 *   condition for deleting it, so no patch outlives its reason.
 *
 * KNOWN_EXCEPTIONS lists the patches that predate the rule, with the checks each one still
 * fails: https://github.com/blinkbitcoin/blink-wip/issues/2333. Never add a new patch to
 * it. An entry that starts passing fails the spec until it is removed, so the list only
 * shrinks.
 */

type Check = "exactPin" | "linkedIssue"

const KNOWN_EXCEPTIONS: Record<string, Check[]> = {
  "@react-native-firebase+crashlytics+23.3.1.patch": ["exactPin", "linkedIssue"],
  "react-native-camera-kit+18.0.0.patch": ["exactPin", "linkedIssue"],
  "react-native-fingerprint-scanner+6.0.0.patch": ["linkedIssue"],
  "react-native-image-picker+7.1.2.patch": ["exactPin", "linkedIssue"],
  "react-native-modal+13.0.2.patch": ["exactPin", "linkedIssue"],
  "react-native-nitro-modules+0.35.2.patch": ["linkedIssue"],
  "react-native-secure-key-store+2.0.10.patch": ["exactPin", "linkedIssue"],
}

const REPO_ROOT = join(__dirname, "..", "..")
const PATCHES_DIR = join(REPO_ROOT, "patches")

const ISSUE_OR_PR_URL = /https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/(issues|pull)\/\d+/
const GIT_COMMIT_PIN = /#[0-9a-f]{40}$/

const packageJson = JSON.parse(readFileSync(join(REPO_ROOT, "package.json"), "utf8"))
const declaredRanges: Record<string, string> = {
  ...packageJson.dependencies,
  ...packageJson.devDependencies,
}

/** `@scope+name+1.2.3.patch` → `@scope/name` and `1.2.3`. */
const parsePatchName = (file: string) => {
  const parts = file.slice(0, -".patch".length).split("+")
  const version = parts.pop() as string
  return { pkg: parts.join("/"), version }
}

const passes = (file: string): Record<Check, boolean> => {
  const { pkg, version } = parsePatchName(file)
  const range = declaredRanges[pkg] ?? ""
  return {
    exactPin: range === version || GIT_COMMIT_PIN.test(range),
    linkedIssue: ISSUE_OR_PR_URL.test(readFileSync(join(PATCHES_DIR, file), "utf8")),
  }
}

const patchFiles = readdirSync(PATCHES_DIR).filter((name) => name.endsWith(".patch"))

describe("patch-package policy", () => {
  it("finds the patches", () => {
    expect(patchFiles.length).toBeGreaterThan(0)
  })

  for (const file of patchFiles) {
    const { pkg } = parsePatchName(file)
    const waived = KNOWN_EXCEPTIONS[file] ?? []

    describe(file, () => {
      it("patches a dependency declared in package.json", () => {
        expect(declaredRanges[pkg]).toBeDefined()
      })

      for (const check of ["exactPin", "linkedIssue"] as const) {
        if (waived.includes(check)) {
          it(`still fails ${check}, so its exception is still needed`, () => {
            expect(passes(file)[check]).toBe(false)
          })
        } else {
          it(`passes ${check}`, () => {
            expect(passes(file)[check]).toBe(true)
          })
        }
      }
    })
  }

  it("lists no exception for a patch that is gone", () => {
    expect(Object.keys(KNOWN_EXCEPTIONS).filter((f) => !patchFiles.includes(f))).toEqual(
      [],
    )
  })
})
