import { it } from "@jest/globals"
import { spawnSync } from "child_process"
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs"
import { tmpdir } from "os"
import { join } from "path"

const SCRIPT = join(__dirname, "..", "..", "scripts", "check-podfile-lock.sh")

const CLEAN_LOCK = `PODS:
  - Yoga (0.0.0)

PODFILE CHECKSUM: abc

COCOAPODS: 1.16.2
`

/** The lines pod install adds on a machine with MeaWallet access. */
const lockWith = (pod: string) => CLEAN_LOCK.replace("PODS:\n", `PODS:\n  - ${pod}\n`)

let repo: string

const git = (...args: string[]) => spawnSync("git", args, { cwd: repo, encoding: "utf8" })
const writeLock = (content: string) =>
  writeFileSync(join(repo, "ios", "Podfile.lock"), content)
const stageLock = () => git("add", "ios/Podfile.lock")

const check = () => {
  const result = spawnSync("sh", [join(repo, "scripts", "check-podfile-lock.sh")], {
    encoding: "utf8",
  })
  return { status: result.status, output: result.stdout + result.stderr }
}

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "podfile-lock-check-"))
  mkdirSync(join(repo, "scripts"))
  mkdirSync(join(repo, "ios"))
  copyFileSync(SCRIPT, join(repo, "scripts", "check-podfile-lock.sh"))
  git("init", "-q")
  writeLock(CLEAN_LOCK)
  stageLock()
})

afterEach(() => {
  rmSync(repo, { recursive: true, force: true })
})

describe("check-podfile-lock.sh", () => {
  it("passes a lock without the MeaWallet pods", () => {
    expect(check().status).toBe(0)
  })

  it.each(["BlinkMeaConfig (1.0.0)", "meawallet-react-native-mpp (2.5.0):"])(
    "fails a staged lock that carries %s",
    (pod) => {
      writeLock(lockWith(pod))
      stageLock()

      const { status, output } = check()

      expect(status).toBe(1)
      expect(output).toContain("ios/Podfile.lock")
    },
  )

  /** A machine with access always has them in its working copy, after every pod install. */
  it("passes while the MeaWallet pods are only in the working copy", () => {
    writeLock(lockWith("BlinkMeaConfig (1.0.0)"))

    expect(check().status).toBe(0)
  })
})
