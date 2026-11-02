import { readdirSync, readFileSync } from "fs"
import { join } from "path"

/**
 * Pins the installed Breez SDK Spark to the upstream fixes that replaced local
 * code: the millisatoshi rounding lives in the SDK's Rust, and the Activity
 * lookup in its Android module, so no JS test can reach either. The artifacts
 * under test are the vendored package, so source-coupling here is intentional.
 *
 * The version floor is not derived from the package: upstream commit a5b204508
 * ("Round Bolt11 invoice amounts up to whole sats") adds `invoice_amount_sats` to
 * `crates/breez-sdk/core/src/sdk/payments/prepare/bolt11.rs`, and 0.23.0 is the
 * first tag containing it. On a bump, re-check that function still rounds up.
 */

const REPO_ROOT = join(__dirname, "..", "..")
const PKG = "@breeztech/breez-sdk-spark-react-native"
const FIRST_VERSION_ROUNDING_INVOICE_MILLISATS_UP = "0.23.0"

const installedVersion = (): string =>
  JSON.parse(readFileSync(join(REPO_ROOT, "node_modules", PKG, "package.json"), "utf8"))
    .version

const isAtLeast = (version: string, minimum: string): boolean =>
  version.localeCompare(minimum, undefined, { numeric: true }) >= 0

const passkeyModuleSource = (): string =>
  readFileSync(
    join(
      REPO_ROOT,
      "node_modules",
      PKG,
      "android/src/main/kotlin/com/breeztech/breezsdkspark/BreezSdkSparkPasskeyModule.kt",
    ),
    "utf8",
  )

describe("Breez SDK Spark upstream fixes", () => {
  it("installs 0.23.0 or later, the first release carrying the invoice rounding fix", () => {
    expect(
      isAtLeast(installedVersion(), FIRST_VERSION_ROUNDING_INVOICE_MILLISATS_UP),
    ).toBe(true)
  })

  it("carries no local patch, since the Activity fix now ships upstream", () => {
    const patches = readdirSync(join(REPO_ROOT, "patches")).filter((name) =>
      name.startsWith(`${PKG.replace("/", "+")}+`),
    )

    expect(patches).toEqual([])
  })

  it("reads the current Activity through the React context, as RN 0.80+ requires", () => {
    const source = passkeyModuleSource()

    expect(source).toContain("reactContext.currentActivity")
    expect(source).not.toMatch(/(?<!reactContext\.)\bcurrentActivity\b/)
  })
})
