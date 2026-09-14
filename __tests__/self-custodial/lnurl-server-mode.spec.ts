import { type BreezSdkInterface } from "@breeztech/breez-sdk-spark-react-native"

import {
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
const NOW_SECONDS = 1_710_000_000

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

  /** `mode:` is what keeps a register or transfer signature, made with the same key, from
   *  being replayed as a mode change. */
  it("signs the domain-separated challenge the server rebuilds", async () => {
    await setup(AccountMode.Anon)

    expect(mockSignMessage).toHaveBeenCalledWith({
      message: `mode:${AccountMode.Anon}:${PUBKEY}-${NOW_SECONDS}`,
      compact: false,
    })
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

  /** Recover signs the bare pubkey; a `mode:` prefix here would be a message the server
   *  rebuilds differently and refuses. */
  it("signs the bare pubkey challenge, undomain-separated", async () => {
    await recover()

    expect(mockSignMessage).toHaveBeenCalledWith({
      message: `${PUBKEY}-${NOW_SECONDS}`,
      compact: false,
    })
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
