import { it } from "@jest/globals"
import { spawnSync } from "child_process"
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

/** Answers the registry with the test tarball, or fails like curl -f on a 4xx. */
const FAKE_CURL = `#!/bin/sh
echo "$@" >> "$FAKE_CURL_LOG"
[ -z "\${FAKE_CURL_FAIL:-}" ] || exit 22
while [ $# -gt 0 ]; do
  [ "$1" = "-o" ] && out=$2
  shift
done
cp "$FAKE_TARBALL" "$out"
`

/** Hashes any archive to the pinned checksum, standing in for the real package. */
const FAKE_OPENSSL = `#!/bin/sh
if [ "$1" = "base64" ]; then
  cat > /dev/null
  printf '%s' "$FAKE_DIGEST"
fi
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

const downloads = () => readFileSync(curlLog(), "utf8").split("\n").filter(Boolean).length
const vendoredVersion = () =>
  JSON.parse(readFileSync(join(vendorDir(), "package.json"), "utf8")).version
const integrityMarker = () => join(vendorDir(), ".integrity")

/** A same-version copy the script did not verify, such as one restored from a cache. */
const seedVendoredCopy = (marker?: string) => {
  writeFile(
    join(vendorDir(), "package.json"),
    JSON.stringify({ version: pinned("MPP_VERSION") }, null, 2),
  )
  if (marker) writeFile(integrityMarker(), `${marker}\n`)
}

type InstallOptions = {
  checksumMatches?: boolean
  downloadFails?: boolean
  env?: Record<string, string>
}

/** Runs the script in a scratch checkout with a scratch HOME, so it never reads the
 *  developer's own credentials or touches the real vendored SDK. */
const install = ({
  checksumMatches = true,
  downloadFails = false,
  env = {},
}: InstallOptions = {}) => {
  const fakeOpenssl = checksumMatches ? [join(root, "openssl-bin")] : []
  const result = spawnSync("sh", [join(repo, "scripts", "install-meawallet-mpp.sh")], {
    encoding: "utf8",
    env: {
      PATH: [join(root, "bin"), ...fakeOpenssl, process.env.PATH ?? ""].join(":"),
      HOME: home,
      TMPDIR: join(root, "tmp"),
      FAKE_CURL_LOG: curlLog(),
      FAKE_TARBALL: join(root, "package.tgz"),
      FAKE_DIGEST: pinned("MPP_INTEGRITY"),
      ...(downloadFails ? { FAKE_CURL_FAIL: "1" } : {}),
      ...env,
    },
  })
  return { status: result.status, output: result.stdout + result.stderr }
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "meawallet-install-"))
  repo = join(root, "repo")
  home = join(root, "home")
  mkdirSync(join(repo, "scripts"), { recursive: true })
  copyFileSync(SCRIPT, join(repo, "scripts", "install-meawallet-mpp.sh"))
  writeExecutable(join(root, "bin", "curl"), FAKE_CURL)
  writeExecutable(join(root, "openssl-bin", "openssl"), FAKE_OPENSSL)
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

  it("vendors the SDK and copies the configuration to Android and iOS", () => {
    giveCredentials()
    giveConfig("config v1")

    const { status } = install()

    expect(status).toBe(0)
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

  it("keeps the password out of the output and the download command, and leaves no netrc", () => {
    giveCredentials()
    giveConfig()

    const { output } = install()

    expect(output).not.toContain(PASSWORD)
    expect(readFileSync(curlLog(), "utf8")).not.toContain(PASSWORD)
    expect(readdirSync(join(root, "tmp"))).toEqual([])
  })

  it("does not download the SDK again once it is vendored", () => {
    giveCredentials()
    giveConfig()
    install()

    install()

    expect(downloads()).toBe(1)
  })

  it("fails without vendoring anything when the download fails", () => {
    giveCredentials()
    giveConfig()

    const { status, output } = install({ downloadFails: true })

    expect(status).toBe(1)
    expect(output).toContain("could not download")
    expect(existsSync(vendorDir())).toBe(false)
  })

  it("refuses a package whose checksum is not the pinned one", () => {
    giveCredentials()
    giveConfig()

    const { status, output } = install({ checksumMatches: false })

    expect(status).toBe(1)
    expect(output).toContain("integrity mismatch")
    expect(existsSync(vendorDir())).toBe(false)
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

  it("removes the SDK once the credentials are gone", () => {
    revokeCredentials()

    const { status } = install()

    expect(status).toBe(0)
    expect(existsSync(vendorDir())).toBe(false)
    expect(readFileSync(iosConfig(), "utf8")).toBe("config v1")
  })

  it("removes both configuration copies once the configuration is gone", () => {
    withdrawConfig()

    const { status } = install()

    expect(status).toBe(0)
    expect(existsSync(androidConfig())).toBe(false)
    expect(existsSync(iosConfig())).toBe(false)
    expect(vendoredVersion()).toBe(pinned("MPP_VERSION"))
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
  })

  it("leaves an unverified copy unmarked when the new archive fails its checksum", () => {
    seedVendoredCopy()

    const { status } = install({ checksumMatches: false })

    expect(status).toBe(1)
    expect(existsSync(integrityMarker())).toBe(false)
  })

  it("leaves nothing beside the vendored SDK once it is in place", () => {
    install()

    expect(readdirSync(dirname(vendorDir()))).toEqual(["react-native-mpp"])
  })
})
