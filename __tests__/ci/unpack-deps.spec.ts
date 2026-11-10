import { execFileSync, spawnSync } from "child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

/**
 * unpack_deps lays a prebuilt node_modules over the checkout, and that tree only
 * matches the checkout if both were built from the same yarn.lock and the same
 * patch-package patches. A bundle from before a patch change unpacks fine and then
 * fails the patch specs at the end of the suite, so the task has to refuse it up
 * front, whether the patch set changed by a modified, an added or a deleted file.
 */

const HELPERS = join(__dirname, "..", "..", "ci", "tasks", "helpers.sh")

type Tree = Record<string, string>

const BASE: Tree = {
  "yarn.lock": "lock v1\n",
  "patches/a+1.0.0.patch": "patch a\n",
  "patches/b+1.0.0.patch": "patch b\n",
}

let root: string

const writeTree = (dir: string, tree: Tree) => {
  for (const [path, content] of Object.entries(tree)) {
    mkdirSync(join(dir, path, ".."), { recursive: true })
    writeFileSync(join(dir, path), content)
  }
}

// helpers.sh sets user.email and user.name globally when they are unset; keep that
// off the developer's own ~/.gitconfig.
const env = () => ({
  ...process.env,
  GIT_CONFIG_GLOBAL: join(root, "gitconfig"),
  GIT_CONFIG_NOSYSTEM: "1",
})

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", args, { cwd, env: env() })

const setUp = ({ checkout, bundle }: { checkout: Tree; bundle: Tree }) => {
  const repo = join(root, "repo")
  mkdirSync(repo)
  writeTree(repo, checkout)
  git(repo, "init", "-q")
  git(repo, "add", "-A")
  git(repo, "-c", "user.email=t@t", "-c", "user.name=t", "commit", "-qm", "base")

  const built = join(root, "built")
  mkdirSync(join(built, "node_modules"), { recursive: true })
  writeTree(built, bundle)
  mkdirSync(join(root, "bundled-deps"))
  execFileSync(
    "tar",
    ["-zcf", join(root, "bundled-deps", "bundled-deps-v1-abc.tgz"), "."],
    {
      cwd: built,
    },
  )
}

const unpackDeps = () => {
  const result = spawnSync("bash", ["-c", `. "${HELPERS}" && unpack_deps`], {
    cwd: root,
    env: env(),
    encoding: "utf8",
  })
  return { status: result.status, output: result.stdout + result.stderr }
}

const without = (tree: Tree, path: string): Tree => {
  const copy = { ...tree }
  delete copy[path]
  return copy
}

describe("unpack_deps", () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "unpack-deps-"))
  })

  afterEach(() => {
    rmSync(root, { recursive: true, force: true })
  })

  it("unpacks a bundle built from the checkout's yarn.lock and patches", () => {
    setUp({ checkout: BASE, bundle: BASE })

    const { status, output } = unpackDeps()

    expect(status).toBe(0)
    expect(output).toContain("Done!")
  })

  it("refuses a bundle built from a different yarn.lock", () => {
    setUp({ checkout: BASE, bundle: { ...BASE, "yarn.lock": "lock v0\n" } })

    const { status, output } = unpackDeps()

    expect(status).toBe(1)
    expect(output).toContain("deps are not in sync")
  })

  it("refuses a bundle built before a patch was modified", () => {
    setUp({
      checkout: BASE,
      bundle: { ...BASE, "patches/a+1.0.0.patch": "patch a, older\n" },
    })

    const { status, output } = unpackDeps()

    expect(status).toBe(1)
    expect(output).toContain("built with different patches")
  })

  it("refuses a bundle built before a patch was added", () => {
    setUp({ checkout: BASE, bundle: without(BASE, "patches/b+1.0.0.patch") })

    const { status, output } = unpackDeps()

    expect(status).toBe(1)
    expect(output).toContain("built with different patches")
  })

  it("refuses a bundle built before a patch was deleted", () => {
    setUp({ checkout: without(BASE, "patches/b+1.0.0.patch"), bundle: BASE })

    const { status, output } = unpackDeps()

    expect(status).toBe(1)
    expect(output).toContain("built with different patches")
  })

  it("leaves a patch the checkout deleted out of the checkout", () => {
    setUp({ checkout: without(BASE, "patches/b+1.0.0.patch"), bundle: BASE })

    unpackDeps()

    expect(git(join(root, "repo"), "status", "--porcelain").toString()).toBe("")
  })
})
