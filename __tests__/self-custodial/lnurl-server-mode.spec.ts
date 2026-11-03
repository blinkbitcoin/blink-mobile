import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import {
  blinkSignedMessage,
  recoverLnurlServerMode,
  setLnurlServerMode,
} from "@app/self-custodial/lnurl-server-mode"
import { AccountMode } from "@app/types/account"

const mockGetWalletInfo = jest.fn()
jest.mock("@app/self-custodial/bridge/wallet", () => ({
  getWalletInfo: (...args: unknown[]) => mockGetWalletInfo(...args),
}))

const PUBKEY = "02ab".padEnd(66, "c")
const SERVER_URL = "https://pay.example.test"
const SERVER_HOST = "pay.example.test"
const NOW_SECONDS = 1_710_000_000

/** The vectors blink-lnurl-server pins in `signed_message.rs`, copied verbatim: a
 *  compressed key as the wallet really spells one, and the host and clock the server's own
 *  test uses. Both sides assert the same bytes, so a drift on either breaks here. */
const SERVER_VECTOR = {
  domain: "lnurl.example.com",
  pubkey: "02a1633cafcc01ebfb6d78e39f687a1f0995c62fc95f51ead10a02ee0be551b5dc",
  timestamp: 1_700_000_000,
} as const

const mockSignMessage = jest.fn()
const sdk = { signMessage: mockSignMessage } as unknown as BreezSdkInterface

const mockFetch = jest.fn()

const setup = (mode: AccountMode = AccountMode.Enhanced) =>
  setLnurlServerMode({ sdk, serverUrl: SERVER_URL, mode })

const lastRequest = () => {
  const [url, init] = mockFetch.mock.calls[0]
  return { url, init, body: JSON.parse(init.body) }
}

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  jest.setSystemTime(NOW_SECONDS * 1000)
  global.fetch = mockFetch as unknown as typeof fetch
  mockGetWalletInfo.mockResolvedValue({ identityPubkey: PUBKEY })
  mockSignMessage.mockResolvedValue({ pubkey: PUBKEY, signature: "3045-der-hex" })
  mockFetch.mockResolvedValue({ ok: true, status: 200 })
})

afterEach(() => {
  jest.useRealTimers()
})

describe("setLnurlServerMode", () => {
  it("posts to the mode endpoint of the account's own pubkey", async () => {
    await setup()

    expect(lastRequest().url).toBe(`${SERVER_URL}/lnurlpay/${PUBKEY}/mode`)
    expect(lastRequest().init.method).toBe("POST")
  })

  it("sends the mode, its signature and the timestamp that was signed", async () => {
    await setup()

    expect(lastRequest().body).toEqual({
      mode: AccountMode.Enhanced,
      signature: "3045-der-hex",
      timestamp: NOW_SECONDS,
    })
  })

  /** Naming the route, the host and the mode is what keeps a signature made with this key
   *  from authorizing anything but this mode on this deployment. */
  it("signs the blink-lnurl:v1 mode message the server rebuilds", async () => {
    await setup(AccountMode.Anon)

    expect(mockSignMessage).toHaveBeenCalledWith({
      message: `blink-lnurl:v1\nmode\n${SERVER_HOST}\n${PUBKEY}\n${AccountMode.Anon}\n${NOW_SECONDS}`,
      compact: false,
    })
  })

  /** The pre-v2 message the server still accepts from older builds. Sending it would keep
   *  the server's compatibility verifier alive and hand out a credential that also reads
   *  payment metadata. */
  it("no longer signs the pre-v2 message", async () => {
    await setup(AccountMode.Anon)

    expect(mockSignMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({
        message: `mode:${AccountMode.Anon}:${PUBKEY}-${NOW_SECONDS}`,
      }),
    )
  })

  /** The server rebuilds the message with the host it answered on, so the signature has to
   *  name the host being posted to rather than anything configuration says. */
  it("binds the message to the host it posts to, not the whole URL", async () => {
    await setLnurlServerMode({
      sdk,
      serverUrl: "https://Staging.Blink.SV/ignored/path?q=1",
      mode: AccountMode.Enhanced,
    })

    expect(mockSignMessage.mock.calls[0][0].message.split("\n")[2]).toBe(
      "staging.blink.sv",
    )
  })

  /** The server parses DER; a compact signature would be refused as invalid. */
  it("asks for a DER signature rather than a compact one", async () => {
    await setup()

    expect(mockSignMessage.mock.calls[0][0].compact).toBe(false)
  })

  it("sends the timestamp in seconds, not milliseconds", async () => {
    jest.setSystemTime(NOW_SECONDS * 1000 + 750)

    await setup()

    expect(lastRequest().body.timestamp).toBe(NOW_SECONDS)
  })

  it("throws with the refusal status when the server rejects the mode", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 409 })

    await expect(setup(AccountMode.Anon)).rejects.toThrow(
      "LNURL server refused mode 'anon' with 409",
    )
  })

  it("surfaces a transport failure rather than reporting the mode as stored", async () => {
    mockFetch.mockRejectedValue(new Error("network down"))

    await expect(setup()).rejects.toThrow("network down")
  })

  it("does not sign anything when the wallet cannot state its pubkey", async () => {
    mockGetWalletInfo.mockRejectedValue(new Error("sdk not connected"))

    await expect(setup()).rejects.toThrow("sdk not connected")
    expect(mockSignMessage).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("aborts a request the server leaves hanging", async () => {
    let abortSignal: AbortSignal | undefined
    mockFetch.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          abortSignal = init.signal ?? undefined
          init.signal?.addEventListener("abort", () => reject(new Error("Aborted")))
        }),
    )

    /** Caught before the clock moves: the abort rejects inside the tick itself, which
     *  would otherwise land as an unhandled rejection. */
    const settled = setup().catch((err: Error) => err)
    /** Async so the pubkey and signature awaits settle first: the timer is only armed
     *  once the request is actually in flight. */
    await jest.advanceTimersByTimeAsync(15_000)

    expect(await settled).toEqual(new Error("Aborted"))
    expect(abortSignal?.aborted).toBe(true)
  })

  it("clears the abort timer once the server answers", async () => {
    const clearTimeoutSpy = jest.spyOn(global, "clearTimeout")

    await setup()

    expect(clearTimeoutSpy).toHaveBeenCalled()
  })
})

describe("recoverLnurlServerMode", () => {
  const recover = () => recoverLnurlServerMode({ sdk, serverUrl: SERVER_URL })

  beforeEach(() => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ mode: AccountMode.Anon }),
    })
  })

  it("posts to the recover endpoint of the account's own pubkey", async () => {
    await recover()

    expect(lastRequest().url).toBe(`${SERVER_URL}/lnurlpay/${PUBKEY}/recover`)
    expect(lastRequest().init.method).toBe("POST")
  })

  /** Recover carries no mode field: it reads one rather than setting it. */
  it("signs the blink-lnurl:v1 recover message the server rebuilds", async () => {
    await recover()

    expect(mockSignMessage).toHaveBeenCalledWith({
      message: `blink-lnurl:v1\nrecover\n${SERVER_HOST}\n${PUBKEY}\n${NOW_SECONDS}`,
      compact: false,
    })
  })

  /** The pre-v2 recover message is byte-identical to the server's `/metadata` and
   *  `/invoices-paid` messages, so signing it hands out a metadata read credential. */
  it("no longer signs the pre-v2 message, which doubles as a metadata credential", async () => {
    await recover()

    expect(mockSignMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ message: `${PUBKEY}-${NOW_SECONDS}` }),
    )
  })

  it("sends only the signature and the timestamp", async () => {
    await recover()

    expect(lastRequest().body).toEqual({
      signature: "3045-der-hex",
      timestamp: NOW_SECONDS,
    })
  })

  it("returns the mode the server holds", async () => {
    expect(await recover()).toBe(AccountMode.Anon)
  })

  it("returns Enhanced when that is what the server holds", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ mode: AccountMode.Enhanced }),
    })

    expect(await recover()).toBe(AccountMode.Enhanced)
  })

  /** An account the server knows but that never chose a mode. */
  it("returns null when the server holds no mode", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ mode: null }),
    })

    expect(await recover()).toBeNull()
  })

  /** The server has never heard of this wallet, which is the same as holding no mode. */
  it("returns null when the account is unknown", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 })

    expect(await recover()).toBeNull()
  })

  /** A variant this app does not know cannot be honored, and calling it one of ours would
   *  misreport what the account holds. */
  it("returns null for a mode value it does not recognize", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ mode: "something-else" }),
    })

    expect(await recover()).toBeNull()
  })

  it("returns null when the field is absent altogether", async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}) })

    expect(await recover()).toBeNull()
  })

  /** Distinguishable from "no mode": a refusal must not read as an answer. */
  it("throws when the server refuses the recover", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 400 })

    await expect(recover()).rejects.toThrow("LNURL server refused recover with 400")
  })

  it("surfaces a transport failure", async () => {
    mockFetch.mockRejectedValue(new Error("network down"))

    await expect(recover()).rejects.toThrow("network down")
  })
})

/**
 * The bytes themselves. blink-lnurl-server rebuilds these to verify the two routes the app
 * signs itself, so they are a wire contract between two repositories: a change on either
 * side locks every deployed build out of its own Lightning address. The first two cases
 * are the server's own golden vectors, copied verbatim from `signed_message.rs`.
 */
describe("blinkSignedMessage", () => {
  const { domain, pubkey, timestamp } = SERVER_VECTOR

  it("matches the server's recover vector", () => {
    expect(blinkSignedMessage({ route: "recover", domain, pubkey, timestamp })).toBe(
      `blink-lnurl:v1\nrecover\nlnurl.example.com\n${pubkey}\n1700000000`,
    )
  })

  it("matches the server's mode vector", () => {
    expect(
      blinkSignedMessage({
        route: "mode",
        domain,
        pubkey,
        mode: AccountMode.Enhanced,
        timestamp,
      }),
    ).toBe(`blink-lnurl:v1\nmode\nlnurl.example.com\n${pubkey}\nenhanced\n1700000000`)
  })

  it("joins the fields with LF and ends without a trailing newline", () => {
    const message = blinkSignedMessage({ route: "recover", domain, pubkey, timestamp })

    expect(message.split("\n")).toEqual([
      "blink-lnurl:v1",
      "recover",
      domain,
      pubkey,
      "1700000000",
    ])
    expect(message.endsWith("\n")).toBe(false)
  })

  /** A recover signature must not authorize a mode change, and the server verifies both
   *  against the same key. */
  it("separates the two routes over the same identity and clock", () => {
    expect(blinkSignedMessage({ route: "recover", domain, pubkey, timestamp })).not.toBe(
      blinkSignedMessage({
        route: "mode",
        domain,
        pubkey,
        mode: AccountMode.Enhanced,
        timestamp,
      }),
    )
  })

  /** Without the host, a mode set on staging would authorize the same mode on production. */
  it("separates the deployments", () => {
    const on = (host: string) =>
      blinkSignedMessage({ route: "recover", domain: host, pubkey, timestamp })

    expect(on("staging.blink.sv")).not.toBe(on("blink.sv"))
  })

  /** A signature over Enhanced must not be replayable as Anon, which would undo a
   *  user's choice to stop the server minting for their address. */
  it("separates the modes", () => {
    const withMode = (mode: AccountMode) =>
      blinkSignedMessage({ route: "mode", domain, pubkey, mode, timestamp })

    expect(withMode(AccountMode.Enhanced)).not.toBe(withMode(AccountMode.Anon))
  })

  /** The namespace the SDK reserves for itself: `signMessage` refuses to sign anything in
   *  it, so a message that fell inside it could not be produced at all. */
  it("stays outside the SDK's reserved namespace", () => {
    expect(
      blinkSignedMessage({ route: "recover", domain, pubkey, timestamp }),
    ).not.toContain("breez-lnurl:")
  })
})
