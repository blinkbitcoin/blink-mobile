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
 *
 * The deposit claim handling needs two later shapes. It reads the `ClaimDepositOutcome`
 * that 0.26.0 introduced (upstream 6583b5d7b "Claim unconfirmed on-chain deposits" and
 * 10c57d32c "Give a deposit its own claim fee ceiling"); an older SDK returns
 * `{ payment }` and every claim would read as failed. And it builds `MaxFee` as a
 * record (upstream 8a5c5e26e, #1245 "Let a fixed max claim fee take a proportional
 * share too"); an older SDK has `MaxFee` as an enum with no `create`, so connecting
 * would throw. The 0.27.0 tag is the first to carry #1245, but it was never published
 * to npm, and 0.27.0-dev2 predates it while passing a numeric 0.27.0 check, so the
 * floor is 0.27.1.
 *
 * The 32-bit Android fix (#4173) used to be a local patch on uniffi-bindgen-react-native.
 * From 0.25.0 the SDK depends on Breez's fork of it (309bc8fa7), which carries the same
 * fix, and the local patch no longer applies. If Breez ever goes back to the npm
 * release, the guard below fails rather than letting the fix disappear.
 */

const REPO_ROOT = join(__dirname, "..", "..")
const PKG = "@breeztech/breez-sdk-spark-react-native"
const FIRST_VERSION_ROUNDING_INVOICE_MILLISATS_UP = "0.23.0"
const FIRST_VERSION_WITH_MAX_FEE_RECORD = "0.27.1"

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

const rustBufferHeader = (): string =>
  readFileSync(
    join(
      REPO_ROOT,
      "node_modules",
      "uniffi-bindgen-react-native",
      "cpp/includes/RustBuffer.h",
    ),
    "utf8",
  )

describe("Breez SDK Spark upstream fixes", () => {
  it("installs 0.23.0 or later, the first release carrying the invoice rounding fix", () => {
    expect(
      isAtLeast(installedVersion(), FIRST_VERSION_ROUNDING_INVOICE_MILLISATS_UP),
    ).toBe(true)
  })

  it("installs 0.27.1 or later, the first release with claim outcomes and a MaxFee record", () => {
    expect(isAtLeast(installedVersion(), FIRST_VERSION_WITH_MAX_FEE_RECORD)).toBe(true)
  })

  it("lays RustBuffer out with 64-bit lengths, so 32-bit Android reads the FFI right", () => {
    const header = rustBufferHeader()

    expect(header).toMatch(/uint64_t capacity;/)
    expect(header).toMatch(/uint64_t len;/)
  })

  it("carries no local uniffi patch, since Breez's fork ships the 32-bit fix", () => {
    const patches = readdirSync(join(REPO_ROOT, "patches")).filter((name) =>
      name.startsWith("uniffi-bindgen-react-native+"),
    )

    expect(patches).toEqual([])
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
