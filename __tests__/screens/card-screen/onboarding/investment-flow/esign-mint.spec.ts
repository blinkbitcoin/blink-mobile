import {
  mintSigningInstance,
  resolveMintOrigin,
} from "@app/screens/card-screen/onboarding/investment-flow/esign-mint"

const CONFIGURED_ORIGIN = "https://esign.example.test"

/** Synthetic values, in the shape the service takes; nothing here is anyone's data. */
const PREFILL = { reference: { value: "LIVE-1", locked: true as const } }
const SESSION_TOKEN = "session-token"

const MINTED = {
  url: "https://sign.example.test/envelope/1",
  envelopeId: "11111111-2222-3333-4444-555555555555",
}

/** Restored after each test: the flag is global, and a suite that left it flipped would
 *  change how every module loaded afterwards behaves. */
const devFlag = globalThis as unknown as { __DEV__: boolean }

const withDevFlag = (isDev: boolean, assert: () => void) => {
  const wasDev = devFlag.__DEV__
  devFlag.__DEV__ = isDev

  try {
    assert()
  } finally {
    devFlag.__DEV__ = wasDev
  }
}

describe("resolveMintOrigin", () => {
  it("uses the origin the instance names", () => {
    expect(resolveMintOrigin(CONFIGURED_ORIGIN)).toBe(CONFIGURED_ORIGIN)
  })

  /** No instance names one yet, so this is what lets the flow be exercised against the
   *  service running on the developer's own machine. */
  it("falls back to the local service in a debug build", () => {
    withDevFlag(true, () => {
      expect(resolveMintOrigin("")).toMatch(/^http:\/\/.+:4100$/)
    })
  })

  /**
   * The fallback address is the developer's own machine. Shipping it would point every
   * user's phone at their own device, so a release build answers with nothing and the
   * step reports a mint it cannot reach.
   */
  it("offers no fallback in a release build", () => {
    withDevFlag(false, () => {
      expect(resolveMintOrigin("")).toBe("")
    })
  })

  it("still prefers a named origin in a release build", () => {
    withDevFlag(false, () => {
      expect(resolveMintOrigin(CONFIGURED_ORIGIN)).toBe(CONFIGURED_ORIGIN)
    })
  })
})

describe("mintSigningInstance", () => {
  const mockFetch = jest.fn()

  /** What the service answers with: a status and a body, or a body that is not JSON. */
  const answering = (status: number, body: unknown, isJson = true) =>
    mockFetch.mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: isJson
        ? () => Promise.resolve(body)
        : () => Promise.reject(new Error("html")),
    })

  const mint = () =>
    mintSigningInstance({
      origin: CONFIGURED_ORIGIN,
      token: SESSION_TOKEN,
      prefill: PREFILL,
    })

  const realFetch = globalThis.fetch

  beforeEach(() => {
    jest.clearAllMocks()
    globalThis.fetch = mockFetch
  })

  afterAll(() => {
    globalThis.fetch = realFetch
  })

  /** The signer is the service's to resolve from the session; the app sends none. */
  it("posts the values alone to the service's envelope mint, as the session", async () => {
    answering(200, MINTED)

    await expect(mint()).resolves.toEqual(MINTED)

    expect(mockFetch).toHaveBeenCalledWith(`${CONFIGURED_ORIGIN}/envelope/instance`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${SESSION_TOKEN}`,
      },
      body: JSON.stringify({ prefill: PREFILL }),
    })
  })

  /** The reason is the service's own, and it reaches the signer under the one code the
   *  component words with the message: a refused mint is something to read, not retry. */
  it("surfaces a refusal with the service's reason", async () => {
    answering(400, { error: "prefill must be an object of locked values" })

    await expect(mint()).rejects.toMatchObject({
      code: "VALIDATION_ERROR",
      message: "prefill must be an object of locked values",
    })
  })

  /** A refusal with no reason attached is as opaque as any other failure, so it gets the
   *  retry copy rather than a bare status on the screen; an empty reason counts as none. */
  it("reports a refusal without a reason as a failed mint", async () => {
    answering(400, {})
    await expect(mint()).rejects.toMatchObject({
      code: "ENVELOPE_CREATION_FAILED",
      message: "HTTP 400",
    })

    answering(400, { error: "" })
    await expect(mint()).rejects.toMatchObject({
      code: "ENVELOPE_CREATION_FAILED",
      message: "HTTP 400",
    })
  })

  /** A session the service will not take is not something to retry against; the
   *  component has its own copy for it. */
  it("reports a session the service refused as unauthorized", async () => {
    answering(401, { error: "Unauthorized" })

    await expect(mint()).rejects.toMatchObject({ code: "UNAUTHORIZED" })
  })

  /** The component has its own copy for this code whatever the message, so the status
   *  is enough of a reason for the log when the service gave none. */
  it("still reports a bare 401 as unauthorized", async () => {
    answering(401, {})

    await expect(mint()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
      message: "HTTP 401",
    })
  })

  /** The host the service asks for the signer may have nothing for this user; the service
   *  answers 502 with its own reason, and the component words it as a failed mint. */
  it("reports any other failure by its status, under the code the component words itself", async () => {
    answering(502, { error: "Could not compute the signing terms" })

    await expect(mint()).rejects.toMatchObject({
      code: "ENVELOPE_CREATION_FAILED",
      message: expect.stringContaining("Could not compute the signing terms"),
    })
  })

  /** Offline, the request rejects before any status exists; the component has copy
   *  for a lost connection, and a failed-mint wording would hide what to do about it. */
  it("reports a request that never reached the service as a lost connection", async () => {
    mockFetch.mockRejectedValue(new TypeError("Network request failed"))

    await expect(mint()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "Network request failed",
    })
  })

  /** A fetch polyfill may reject with a bare value rather than an Error; it is coerced
   *  to text rather than throwing inside the catch. */
  it("still words a lost connection when the rejection is not an Error", async () => {
    mockFetch.mockRejectedValue("offline")

    await expect(mint()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "offline",
    })
  })

  /** A port answering with something other than JSON is still a failed mint, and the
   *  status is what explains it, so a parse error must not replace it. */
  it("names the status when the answer is not JSON", async () => {
    answering(503, null, false)

    await expect(mint()).rejects.toMatchObject({
      code: "ENVELOPE_CREATION_FAILED",
      message: expect.stringContaining("HTTP 503"),
    })
  })

  it("treats an answer without a url as a failed mint", async () => {
    answering(200, { envelopeId: MINTED.envelopeId })

    await expect(mint()).rejects.toMatchObject({
      code: "ENVELOPE_CREATION_FAILED",
      message: "the service answered without a url",
    })
  })

  /** The url is what the signer opens; the envelope's id is echoed when the service
   *  names one and is not what the session hangs on. */
  it("opens a url the service answered without an envelope id", async () => {
    answering(200, { url: MINTED.url })

    await expect(mint()).resolves.toEqual({ url: MINTED.url, envelopeId: undefined })
  })

  /** A release build with no service named has nowhere to go; saying so beats a request
   *  to an empty address that fails with a reason nobody can act on. */
  it("does not call anywhere when no service is configured", async () => {
    await expect(
      mintSigningInstance({
        origin: "",
        token: SESSION_TOKEN,
        prefill: PREFILL,
      }),
    ).rejects.toMatchObject({ code: "ENVELOPE_CREATION_FAILED" })

    expect(mockFetch).not.toHaveBeenCalled()
  })
})
