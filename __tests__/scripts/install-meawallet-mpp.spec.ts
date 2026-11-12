import { it } from "@jest/globals"
import { spawn, spawnSync } from "child_process"
import { createHash } from "crypto"
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs"
import { tmpdir } from "os"
import { dirname, join } from "path"

const SCRIPT = join(__dirname, "..", "..", "scripts", "install-meawallet-mpp.sh")
const PASSWORD = "fake-registry-password"

const pinned = (name: string): string => {
  const match = readFileSync(SCRIPT, "utf8").match(new RegExp(`${name}="([^"]+)"`))
  if (!match) throw new Error(`the script pins no ${name}`)
  return match[1]
}

/** Answers the registry with the test tarball, or fails like curl -f on a 4xx. A config read
 *  from stdin is checked against the one expected and logged by its user alone, so the log
 *  never holds the password. With FAKE_CURL_STARTED it hangs, as a slow download does. */
const FAKE_CURL = `#!/bin/sh
echo "$@" >> "$FAKE_CURL_LOG"
case " $* " in
  *" -K - "*)
    config=$(cat)
    [ "$config" = "$FAKE_EXPECTED_CONFIG" ] && echo "stdin config matched" >> "$FAKE_CURL_LOG"
    echo "stdin user: $(printf '%s' "$config" | sed -n 's/^user = "\\([^:]*\\):.*/\\1/p')" >> "$FAKE_CURL_LOG"
    ;;
esac
if [ -n "\${FAKE_CURL_STARTED:-}" ]; then
  : > "$FAKE_CURL_STARTED"
  sleep 30
fi
[ -z "\${FAKE_CURL_FAIL:-}" ] || exit 22
while [ $# -gt 0 ]; do
  [ "$1" = "-o" ] && out=$2
  shift
done
cp "$FAKE_TARBALL" "$out"
`

/** The real tar, except with FAKE_TAR_STARTED, where it leaves half an archive behind and
 *  hangs, as an extract cut short does. */
const FAKE_TAR = `#!/bin/sh
if [ -n "\${FAKE_TAR_STARTED:-}" ]; then
  while [ $# -gt 0 ]; do
    [ "$1" = "-C" ] && dest=$2
    shift
  done
  mkdir -p "$dest/package"
  : > "$dest/package/half-extracted.js"
  : > "$FAKE_TAR_STARTED"
  sleep 30
  exit 0
fi
exec "$FAKE_REAL_TAR" "$@"
`
const REAL_TAR = spawnSync("sh", ["-c", "command -v tar"], {
  encoding: "utf8",
}).stdout.trim()

/** Hashes any archive to the pinned checksum, standing in for the real package. */
const FAKE_NODE = `#!/bin/sh
printf '%s' "$FAKE_DIGEST"
`

/** A node that cannot run, so the hash comes back empty with a failing status. */
const BROKEN_NODE = `#!/bin/sh
exit 1
`

let root: string
let repo: string
let home: string

const configDir = () => join(home, ".config", "blink")
const vendorDir = () => join(repo, "vendor", "meawallet", "react-native-mpp")
const androidConfig = () =>
  join(repo, "android", "app", "src", "main", "res", "raw", "mea_config")
const iosConfig = () => join(repo, "ios", "MeaConfig", "mea_config")
const curlLog = () => join(root, "curl.log")

const writeFile = (path: string, content: string) => {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

const writeExecutable = (path: string, content: string) => {
  writeFile(path, content)
  chmodSync(path, 0o755)
}

const giveCredentials = () =>
  writeFile(
    join(configDir(), "meawallet-rn.env"),
    `MEA_RN_USER=blink\nMEA_RN_PASSWORD=${PASSWORD}\n`,
  )
const revokeCredentials = () => rmSync(join(configDir(), "meawallet-rn.env"))
const giveConfig = (content = "config v1") =>
  writeFile(join(configDir(), "mea_config"), content)
const withdrawConfig = () => rmSync(join(configDir(), "mea_config"))

const packTarball = () => {
  const source = join(root, "tarball")
  writeFile(
    join(source, "package", "package.json"),
    JSON.stringify(
      { name: "@meawallet/react-native-mpp", version: pinned("MPP_VERSION") },
      null,
      2,
    ),
  )
  spawnSync("tar", ["-czf", join(root, "package.tgz"), "-C", source, "package"])
}

/** curl calls, as the fake logs each one's arguments; its stdin notes are left out. */
const downloads = () =>
  readFileSync(curlLog(), "utf8")
    .split("\n")
    .filter((line) => line !== "" && !line.startsWith("stdin ")).length
const vendoredVersion = () =>
  JSON.parse(readFileSync(join(vendorDir(), "package.json"), "utf8")).version
const integrityMarker = () => join(vendorDir(), ".integrity")

/** A same-version copy the script did not verify, such as one restored from a cache. It
 *  carries a file of its own, so a case can tell it was replaced rather than written over. */
const seedVendoredCopy = (marker?: string) => {
  writeFile(
    join(vendorDir(), "package.json"),
    JSON.stringify({ version: pinned("MPP_VERSION") }, null, 2),
  )
  writeFile(staleFile(), "from the copy the script did not vendor")
  if (marker) writeFile(integrityMarker(), `${marker}\n`)
}
const staleFile = () => join(vendorDir(), "stale.js")

type InstallOptions = {
  checksumMatches?: boolean
  downloadFails?: boolean
  hashFails?: boolean
  env?: Record<string, string>
}

/** The curl config the script should pipe for the credentials giveCredentials writes. */
const expectedConfig = (user = "blink", password = PASSWORD) =>
  `user = "${user}:${password}"`

/** A scratch checkout with a scratch HOME, so the script never reads the developer's own
 *  credentials or touches the real vendored SDK. */
const installEnv = ({
  checksumMatches = true,
  downloadFails = false,
  hashFails = false,
  env = {},
}: InstallOptions = {}): Record<string, string> => {
  const fakeNode = hashFails
    ? [join(root, "broken-node-bin")]
    : checksumMatches
      ? [join(root, "node-bin")]
      : []
  return {
    PATH: [join(root, "bin"), ...fakeNode, process.env.PATH ?? ""].join(":"),
    HOME: home,
    TMPDIR: join(root, "tmp"),
    FAKE_CURL_LOG: curlLog(),
    FAKE_TARBALL: join(root, "package.tgz"),
    FAKE_DIGEST: pinned("MPP_INTEGRITY"),
    FAKE_REAL_TAR: REAL_TAR,
    FAKE_EXPECTED_CONFIG: expectedConfig(),
    ...(downloadFails ? { FAKE_CURL_FAIL: "1" } : {}),
    ...env,
  }
}

const install = (options: InstallOptions = {}) => {
  const result = spawnSync("sh", [join(repo, "scripts", "install-meawallet-mpp.sh")], {
    encoding: "utf8",
    env: installEnv(options),
  })
  return { status: result.status, output: result.stdout + result.stderr }
}

const until = async (condition: () => boolean) => {
  const deadline = Date.now() + 10_000
  while (!condition()) {
    if (Date.now() > deadline) throw new Error("the step under test never started")
    await new Promise((resolve) => {
      setTimeout(resolve, 20)
    })
  }
}

/** Starts the script under `shell` and, once the step that `startedFlag` marks is running,
 *  sends Ctrl-C the way a terminal does: to the whole process group. */
const interruptInstall = async (
  shell: string,
  startedFlag: "FAKE_CURL_STARTED" | "FAKE_TAR_STARTED",
) => {
  const started = join(root, "started")
  const child = spawn(shell, [join(repo, "scripts", "install-meawallet-mpp.sh")], {
    detached: true,
    stdio: "ignore",
    env: { ...installEnv(), [startedFlag]: started },
  })
  const exited = new Promise<number | null>((resolve) => {
    child.on("exit", (code) => resolve(code))
  })
  await until(() => existsSync(started))
  process.kill(-(child.pid ?? 0), "SIGINT")
  return exited
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "meawallet-install-"))
  repo = join(root, "repo")
  home = join(root, "home")
  mkdirSync(join(repo, "scripts"), { recursive: true })
  copyFileSync(SCRIPT, join(repo, "scripts", "install-meawallet-mpp.sh"))
  writeExecutable(join(root, "bin", "curl"), FAKE_CURL)
  writeExecutable(join(root, "bin", "tar"), FAKE_TAR)
  writeExecutable(join(root, "node-bin", "node"), FAKE_NODE)
  writeExecutable(join(root, "broken-node-bin", "node"), BROKEN_NODE)
  mkdirSync(join(root, "tmp"))
  writeFile(curlLog(), "")
  packTarball()
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe("install-meawallet-mpp.sh installing", () => {
  it("leaves a machine without access untouched", () => {
    const { status } = install()

    expect(status).toBe(0)
    expect(existsSync(vendorDir())).toBe(false)
    expect(existsSync(androidConfig())).toBe(false)
    expect(existsSync(iosConfig())).toBe(false)
    expect(downloads()).toBe(0)
  })

  it("vendors nothing for credentials that come without a configuration", () => {
    giveCredentials()

    const { status } = install()

    expect(status).toBe(0)
    expect(downloads()).toBe(0)
    expect(existsSync(vendorDir())).toBe(false)
  })

  it("copies no configuration that comes without credentials", () => {
    giveConfig()

    const { status } = install()

    expect(status).toBe(0)
    expect(existsSync(androidConfig())).toBe(false)
    expect(existsSync(iosConfig())).toBe(false)
  })

  it("vendors the SDK and copies the configuration to Android and iOS", () => {
    giveCredentials()
    giveConfig("config v1")

    const { status, output } = install()

    expect(status).toBe(0)
    expect(output).toContain("never commit them")
    expect(vendoredVersion()).toBe(pinned("MPP_VERSION"))
    expect(readFileSync(androidConfig(), "utf8")).toBe("config v1")
    expect(readFileSync(iosConfig(), "utf8")).toBe("config v1")
  })

  it("takes the credentials and the configuration from the environment, as CI passes them", () => {
    const ciConfig = join(root, "ci-mea-config")
    writeFile(ciConfig, "ci config")

    const { status } = install({
      env: { MEA_RN_USER: "ci", MEA_RN_PASSWORD: PASSWORD, MEA_CONFIG_FILE: ciConfig },
    })

    expect(status).toBe(0)
    expect(vendoredVersion()).toBe(pinned("MPP_VERSION"))
    expect(readFileSync(iosConfig(), "utf8")).toBe("ci config")
  })

  it("hands the credentials to curl on stdin, never in its arguments, the output or a file", () => {
    giveCredentials()
    giveConfig()

    const { output } = install()

    const log = readFileSync(curlLog(), "utf8")
    expect(log).toContain("stdin config matched")
    expect(log).not.toContain(PASSWORD)
    expect(output).not.toContain(PASSWORD)
    expect(readdirSync(join(root, "tmp"))).toEqual([])
  })

  /** A shell that exports only the user, left over from trying CI's setup, must not read
   *  as no access: that would remove a good vendored SDK. */
  it("fills the password the environment left out from the credentials file", () => {
    giveCredentials()
    giveConfig()

    const { status } = install({
      env: { MEA_RN_USER: "ci", FAKE_EXPECTED_CONFIG: expectedConfig("ci") },
    })

    expect(status).toBe(0)
    expect(readFileSync(curlLog(), "utf8")).toContain("stdin config matched")
    expect(vendoredVersion()).toBe(pinned("MPP_VERSION"))
  })

  it("lets the environment's password win over the file's", () => {
    giveCredentials()
    giveConfig()

    install({
      env: {
        MEA_RN_PASSWORD: "password-from-env",
        FAKE_EXPECTED_CONFIG: expectedConfig("blink", "password-from-env"),
      },
    })

    expect(readFileSync(curlLog(), "utf8")).toContain("stdin config matched")
  })

  /** curl reads a double-quoted config value with backslash escapes. */
  it("escapes quotes and backslashes in the password for curl's config", () => {
    const password = 'pa"ss\\word'
    writeFile(
      join(configDir(), "meawallet-rn.env"),
      `MEA_RN_USER=blink\nMEA_RN_PASSWORD='${password}'\n`,
    )
    giveConfig()

    install({ env: { FAKE_EXPECTED_CONFIG: expectedConfig("blink", 'pa\\"ss\\\\word') } })

    expect(readFileSync(curlLog(), "utf8")).toContain("stdin config matched")
  })

  it("does not download the SDK again once it is vendored", () => {
    giveCredentials()
    giveConfig()
    install()

    install()

    expect(downloads()).toBe(1)
  })

  /** A contributor offline, or CI during a MeaWallet outage, still gets a working yarn
   *  install, and the pod install chained after it. */
  it("goes without the SDK, and lets yarn install go on, when the download fails", () => {
    giveCredentials()
    giveConfig()

    const { status, output } = install({ downloadFails: true })

    expect(status).toBe(0)
    expect(output).toContain("could not download")
    expect(existsSync(vendorDir())).toBe(false)
  })

  it("refuses a package whose checksum is not the pinned one", () => {
    giveCredentials()
    giveConfig()

    const { status, output } = install({ checksumMatches: false })

    expect(status).toBe(0)
    expect(output).toContain("integrity mismatch")
    expect(existsSync(vendorDir())).toBe(false)
  })

  /** The hash runs in a command substitution under set -e: without its fallback a node
   *  that fails would end the install with node's status, half done. */
  it("goes without the SDK when the archive cannot be hashed", () => {
    giveCredentials()
    giveConfig()

    const { status, output } = install({ hashFails: true })

    expect(status).toBe(0)
    expect(output).toContain("integrity mismatch")
    expect(existsSync(vendorDir())).toBe(false)
    expect(existsSync(androidConfig())).toBe(false)
    expect(existsSync(iosConfig())).toBe(false)
    expect(readdirSync(join(root, "tmp"))).toEqual([])
  })
})

describe("install-meawallet-mpp.sh on a machine that was provisioned before", () => {
  beforeEach(() => {
    giveCredentials()
    giveConfig("config v1")
    install()
  })

  it("copies a rotated configuration to Android and iOS", () => {
    giveConfig("config v2")

    install()

    expect(readFileSync(androidConfig(), "utf8")).toBe("config v2")
    expect(readFileSync(iosConfig(), "utf8")).toBe("config v2")
    expect(downloads()).toBe(1)
  })

  /** The SDK and its configuration go together: one without the other only fails to
   *  start, or adds a pod that does nothing. */
  it("removes the SDK and its configuration once the credentials are gone", () => {
    revokeCredentials()

    const { status } = install()

    expect(status).toBe(0)
    expect(existsSync(vendorDir())).toBe(false)
    expect(existsSync(androidConfig())).toBe(false)
    expect(existsSync(iosConfig())).toBe(false)
  })

  it("removes the SDK and its configuration once the configuration is gone", () => {
    withdrawConfig()

    const { status } = install()

    expect(status).toBe(0)
    expect(existsSync(vendorDir())).toBe(false)
    expect(existsSync(androidConfig())).toBe(false)
    expect(existsSync(iosConfig())).toBe(false)
  })

  it.each<[string, InstallOptions]>([
    ["the download fails", { downloadFails: true }],
    ["the archive fails its checksum", { checksumMatches: false }],
    ["the archive cannot be hashed", { hashFails: true }],
  ])("removes the configuration too when %s on a new install", (_, failure) => {
    writeFile(integrityMarker(), "sha512-of-the-previous-version\n")

    const { status } = install(failure)

    expect(status).toBe(0)
    expect(existsSync(vendorDir())).toBe(false)
    expect(existsSync(androidConfig())).toBe(false)
    expect(existsSync(iosConfig())).toBe(false)
  })

  it("vendors the SDK again once the credentials come back", () => {
    revokeCredentials()
    install()
    giveCredentials()

    install()

    expect(vendoredVersion()).toBe(pinned("MPP_VERSION"))
    expect(downloads()).toBe(2)
  })
})

describe("install-meawallet-mpp.sh trusting a vendored copy", () => {
  beforeEach(() => {
    giveCredentials()
    giveConfig()
  })

  /** Every other case fakes the hash, so this one pins the scratch script to the test
   *  archive's real digest and runs the real pipeline: a broken digest command would
   *  answer something else, and the install would go without the SDK. */
  it("verifies the archive with the real node when it matches the pinned digest", () => {
    const digest = createHash("sha512")
      .update(readFileSync(join(root, "package.tgz")))
      .digest("base64")
    const script = join(repo, "scripts", "install-meawallet-mpp.sh")
    writeFileSync(
      script,
      readFileSync(script, "utf8").replace(
        /MPP_INTEGRITY="[^"]+"/,
        `MPP_INTEGRITY="${digest}"`,
      ),
    )

    const { status } = install({ checksumMatches: false })

    expect(status).toBe(0)
    expect(readFileSync(integrityMarker(), "utf8").trim()).toBe(digest)
  })

  it("marks the SDK with the pinned checksum once its archive matched it", () => {
    install()

    expect(readFileSync(integrityMarker(), "utf8").trim()).toBe(pinned("MPP_INTEGRITY"))
  })

  it.each<[string, string | undefined]>([
    ["no marker", undefined],
    ["a marker from another checksum", "sha512-of-another-archive"],
  ])("downloads the SDK again over a same-version copy with %s", (_, marker) => {
    seedVendoredCopy(marker)

    const { status } = install()

    expect(status).toBe(0)
    expect(downloads()).toBe(1)
    expect(readFileSync(integrityMarker(), "utf8").trim()).toBe(pinned("MPP_INTEGRITY"))
    expect(existsSync(staleFile())).toBe(false)
  })

  /** The configs link whatever is vendored, so only a verified copy may stay there. */
  it("removes an unverified copy when the new archive fails its checksum", () => {
    seedVendoredCopy()

    const { status } = install({ checksumMatches: false })

    expect(status).toBe(0)
    expect(existsSync(vendorDir())).toBe(false)
  })

  it("removes a copy from another checksum when the download fails", () => {
    seedVendoredCopy("sha512-of-the-previous-version")

    const { status } = install({ downloadFails: true })

    expect(status).toBe(0)
    expect(existsSync(vendorDir())).toBe(false)
  })

  it("leaves nothing beside the vendored SDK once it is in place", () => {
    install()

    expect(readdirSync(dirname(vendorDir()))).toEqual(["react-native-mpp"])
  })
})

/** A release job sets MEA_REQUIRED=1, so an install that leaves the SDK out fails it
 *  rather than shipping a build without the wallet. */
describe("install-meawallet-mpp.sh with MEA_REQUIRED", () => {
  const required = { MEA_REQUIRED: "1" }

  it.each<[string, () => void, InstallOptions]>([
    ["the download fails", () => undefined, { downloadFails: true }],
    ["the archive fails its checksum", () => undefined, { checksumMatches: false }],
    ["the archive cannot be hashed", () => undefined, { hashFails: true }],
    ["the credentials are missing", revokeCredentials, {}],
    ["the configuration is missing", withdrawConfig, {}],
  ])("fails the install when %s", (_, takeAway, failure) => {
    giveCredentials()
    giveConfig()
    takeAway()

    const { status, output } = install({ ...failure, env: required })

    expect(status).toBe(1)
    expect(output).toContain("MEA_REQUIRED")
    expect(existsSync(vendorDir())).toBe(false)
  })

  it("installs as usual when nothing is missing", () => {
    giveCredentials()
    giveConfig()

    const { status } = install({ env: required })

    expect(status).toBe(0)
    expect(vendoredVersion()).toBe(pinned("MPP_VERSION"))
  })
})

/** A developer stops a slow yarn install with Ctrl-C. dash, Linux's /bin/sh, runs no EXIT
 *  trap when a signal ends it, so it is run here alongside whatever sh this machine has. */
const SHELLS = ["sh", "dash"].filter(
  (shell) => spawnSync("sh", ["-c", `command -v ${shell}`]).status === 0,
)

describe("install-meawallet-mpp.sh cut short", () => {
  beforeEach(() => {
    giveCredentials()
    giveConfig()
  })

  it.each(SHELLS)(
    "leaves nothing in TMPDIR when %s is stopped mid-download",
    async (shell) => {
      const status = await interruptInstall(shell, "FAKE_CURL_STARTED")

      expect(readdirSync(join(root, "tmp"))).toEqual([])
      expect(existsSync(vendorDir())).toBe(false)
      expect(status).toBe(130)
    },
  )

  it.each(SHELLS)(
    "leaves no half-extracted SDK when %s is stopped mid-extract",
    async (shell) => {
      const status = await interruptInstall(shell, "FAKE_TAR_STARTED")

      expect(readdirSync(join(root, "tmp"))).toEqual([])
      expect(readdirSync(dirname(vendorDir()))).toEqual([])
      expect(status).toBe(130)
    },
  )
})
