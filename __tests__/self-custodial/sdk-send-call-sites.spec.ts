import fs from "fs"
import path from "path"

/**
 * Every way the app moves money through the Spark SDK either carries an idempotency key or
 * is a token leg that is reconciled against the wallet's history before it is sent again.
 * A send added outside these paths could pay twice on a retry, so it fails here first.
 */

const APP_DIR = path.resolve(__dirname, "../../app")

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })

type CallSite = { file: string; call: string }

/** Each call of `name(` in the app, with the text up to its closing parenthesis. */
const callSites = (pattern: RegExp): CallSite[] =>
  sourceFiles(APP_DIR).flatMap((full) => {
    const source = fs.readFileSync(full, "utf8")
    const file = path.relative(APP_DIR, full)
    return Array.from(source.matchAll(pattern), (match) => {
      let depth = 0
      let end = match.index + match[0].length - 1
      for (; end < source.length; end += 1) {
        if (source[end] === "(") depth += 1
        if (source[end] === ")") depth -= 1
        if (depth === 0) break
      }
      return { file, call: source.slice(match.index, end + 1) }
    })
  })

const SDK_SEND_CALL = /\.(sendPayment|lnurlPay)\(/g
const BRIDGE_SEND_CALL = /\b(executeSend|executeLnurl)\(/g

/** The only places the SDK is asked to move money, and how each is protected. */
const ALLOWED_SDK_SENDS: Record<string, string> = {
  "self-custodial/bridge/send.ts": "keyed: executeSend and executeLnurl",
  "self-custodial/bridge/convert.ts": "token leg: conversions are looked up, never keyed",
}

describe("self-custodial SDK send call sites", () => {
  it("sends through the SDK only from the bridge", () => {
    const files = new Set(callSites(SDK_SEND_CALL).map(({ file }) => file))

    expect([...files].sort()).toEqual(Object.keys(ALLOWED_SDK_SENDS).sort())
  })

  it("hands the SDK an idempotency key on every keyed bridge send", () => {
    const keyed = callSites(SDK_SEND_CALL).filter(
      ({ file }) => file === "self-custodial/bridge/send.ts",
    )

    expect(keyed).toHaveLength(2)
    keyed.forEach(({ call }) => expect(call).toMatch(/idempotencyKey/))
  })

  it("passes an idempotency key at every call of the keyed bridge sends", () => {
    const calls = callSites(BRIDGE_SEND_CALL).filter(
      ({ file }) => file !== "self-custodial/bridge/send.ts",
    )

    expect(calls.length).toBeGreaterThan(0)
    calls.forEach(({ file, call }) =>
      expect(`${file}: ${call}`).toMatch(/idempotencyKey/),
    )
  })
})
