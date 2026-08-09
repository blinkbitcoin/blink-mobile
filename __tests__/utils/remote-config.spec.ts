import {
  getRemoteConfigList,
  getRemoteConfigNumericObject,
  getRemoteConfigObject,
  getRemoteConfigPositiveNumber,
  getRemoteConfigStringList,
  serializeRemoteConfigDefault,
} from "@app/utils/remote-config"

const mockLogError = jest.fn()
const mockAsString = jest.fn()
const mockAsNumber = jest.fn()
const mockGetValue = jest.fn(() => ({
  asString: mockAsString,
  asNumber: mockAsNumber,
}))

jest.mock("@app/utils/log-error", () => ({
  logError: (...args: unknown[]) => mockLogError(...args),
}))

jest.mock("@react-native-firebase/remote-config", () => ({
  __esModule: true,
  default: () => ({ getValue: mockGetValue }),
}))

describe("serializeRemoteConfigDefault", () => {
  it("serializes arrays into a JSON string", () => {
    expect(serializeRemoteConfigDefault(["US", "GB"])).toBe('["US","GB"]')
  })

  it("serializes plain objects into a JSON string", () => {
    expect(serializeRemoteConfigDefault({ a: 1, b: "x" })).toBe('{"a":1,"b":"x"}')
  })

  it("serializes primitives", () => {
    expect(serializeRemoteConfigDefault(42)).toBe("42")
    expect(serializeRemoteConfigDefault(true)).toBe("true")
    expect(serializeRemoteConfigDefault("hello")).toBe('"hello"')
  })
})

describe("getRemoteConfigList", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("parses a JSON-encoded array from Remote Config", () => {
    mockAsString.mockReturnValue('["US","GB","DE"]')

    const result = getRemoteConfigList<string>("any-key", [])

    expect(result).toEqual(["US", "GB", "DE"])
    expect(mockGetValue).toHaveBeenCalledWith("any-key")
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it("returns the fallback silently when the Remote Config value is an empty string", () => {
    mockAsString.mockReturnValue("")
    const fallback = ["FALLBACK"]

    expect(getRemoteConfigList("missing-key", fallback)).toBe(fallback)
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it("returns the fallback and logs the failure when the stored value cannot be parsed as JSON", () => {
    mockAsString.mockReturnValue("not-valid-json")
    const fallback = ["FALLBACK"]

    expect(getRemoteConfigList("bad-key", fallback)).toBe(fallback)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "remote-config",
        // The key must live in the Error message itself, not only in context,
        // so a malformed-JSON ops typo is attributable in production Crashlytics.
        error: expect.objectContaining({
          message: expect.stringContaining("bad-key"),
        }),
        context: expect.objectContaining({ key: "bad-key" }),
      }),
    )
  })

  it("returns the fallback and logs when the stored value is valid JSON but not an array (object)", () => {
    mockAsString.mockReturnValue('{"US":true}')
    const fallback = ["FALLBACK"]

    expect(getRemoteConfigList("misconfigured-key", fallback)).toBe(fallback)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "remote-config",
        context: expect.objectContaining({
          key: "misconfigured-key",
          actualShape: "object",
        }),
      }),
    )
  })

  it("returns the fallback and logs when the stored value is valid JSON but a primitive", () => {
    mockAsString.mockReturnValue('"US"')
    const fallback = ["FALLBACK"]

    expect(getRemoteConfigList("misconfigured-key", fallback)).toBe(fallback)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ actualShape: "string" }),
      }),
    )
  })

  it("preserves the generic element type for nested objects", () => {
    mockAsString.mockReturnValue('[{"id":1},{"id":2}]')

    const result = getRemoteConfigList<{ id: number }>("any-key", [])

    expect(result).toEqual([{ id: 1 }, { id: 2 }])
  })
})

describe("getRemoteConfigStringList: normalizes case and validates elements", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("uppercases every entry so a lowercase Firebase value still matches an uppercase country code", () => {
    mockAsString.mockReturnValue('["us","Gb"]')

    expect(getRemoteConfigStringList("compliance-key", [])).toEqual(["US", "GB"])
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it("drops non-string entries and logs how many were discarded", () => {
    mockAsString.mockReturnValue('["US",1,null,"gb",{"x":1}]')

    expect(getRemoteConfigStringList("compliance-key", [])).toEqual(["US", "GB"])
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "remote-config",
        context: expect.objectContaining({
          key: "compliance-key",
          droppedCount: 3,
          totalEntries: 5,
        }),
      }),
    )
  })

  it("returns the fallback (and does not double-log) when the value is missing", () => {
    mockAsString.mockReturnValue("")
    const fallback = ["US"]

    expect(getRemoteConfigStringList("compliance-key", fallback)).toBe(fallback)
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it("returns the fallback when the parsed value is not an array", () => {
    mockAsString.mockReturnValue('{"US":true}')
    const fallback = ["US"]

    expect(getRemoteConfigStringList("compliance-key", fallback)).toBe(fallback)
    expect(mockLogError).toHaveBeenCalled()
  })
})

describe("getRemoteConfigObject", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("parses a JSON-encoded object from Remote Config", () => {
    mockAsString.mockReturnValue('{"standard":{"minDays":7},"express":{"minDays":1}}')

    const result = getRemoteConfigObject<Record<string, { minDays: number }>>(
      "any-key",
      {},
    )

    expect(result).toEqual({ standard: { minDays: 7 }, express: { minDays: 1 } })
    expect(mockGetValue).toHaveBeenCalledWith("any-key")
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it("returns the fallback silently when the Remote Config value is empty", () => {
    mockAsString.mockReturnValue("")
    const fallback = { foo: "bar" }

    expect(getRemoteConfigObject("missing-key", fallback)).toBe(fallback)
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it("returns the fallback and logs when the stored value cannot be parsed as JSON", () => {
    mockAsString.mockReturnValue("not-valid-json")
    const fallback = { foo: "bar" }

    expect(getRemoteConfigObject("bad-key", fallback)).toBe(fallback)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({ context: expect.objectContaining({ key: "bad-key" }) }),
    )
  })

  it("returns the fallback and logs when the parsed value is an array", () => {
    mockAsString.mockReturnValue("[1,2]")
    const fallback = { foo: "bar" }

    expect(getRemoteConfigObject("misconfigured-key", fallback)).toBe(fallback)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ actualShape: "array" }),
      }),
    )
  })

  it("returns the fallback and logs when the parsed value is a primitive number", () => {
    mockAsString.mockReturnValue("42")
    const fallback = { foo: "bar" }

    expect(getRemoteConfigObject("misconfigured-key", fallback)).toBe(fallback)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ actualShape: "number" }),
      }),
    )
  })
})

describe("getRemoteConfigNumericObject", () => {
  const defaults = { lightningSendBps: 20, transferBps: 35 }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("merges a full remote object of finite numbers over the defaults", () => {
    mockAsString.mockReturnValue('{"lightningSendBps":25,"transferBps":40}')

    expect(getRemoteConfigNumericObject("fees-key", defaults)).toEqual({
      lightningSendBps: 25,
      transferBps: 40,
    })
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it("keeps the defaults for keys missing from a partial remote object", () => {
    mockAsString.mockReturnValue('{"transferBps":40}')

    expect(getRemoteConfigNumericObject("fees-key", defaults)).toEqual({
      lightningSendBps: 20,
      transferBps: 40,
    })
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it("drops non-numeric values, keeps their defaults and logs the dropped keys", () => {
    mockAsString.mockReturnValue('{"lightningSendBps":"25","transferBps":40}')

    expect(getRemoteConfigNumericObject("fees-key", defaults)).toEqual({
      lightningSendBps: 20,
      transferBps: 40,
    })
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "remote-config",
        context: expect.objectContaining({
          key: "fees-key",
          droppedKeys: ["lightningSendBps"],
        }),
      }),
    )
  })

  it("drops null values in favor of the defaults", () => {
    mockAsString.mockReturnValue('{"transferBps":null}')

    expect(getRemoteConfigNumericObject("fees-key", defaults)).toEqual(defaults)
    expect(mockLogError).toHaveBeenCalledTimes(1)
  })

  it("ignores unknown keys silently for forward compatibility", () => {
    mockAsString.mockReturnValue('{"someFutureBps":10,"transferBps":40}')

    expect(getRemoteConfigNumericObject("fees-key", defaults)).toEqual({
      lightningSendBps: 20,
      transferBps: 40,
    })
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it("returns the defaults silently when the Remote Config value is empty", () => {
    mockAsString.mockReturnValue("")

    expect(getRemoteConfigNumericObject("missing-key", defaults)).toBe(defaults)
    expect(mockLogError).not.toHaveBeenCalled()
  })

  it("returns the defaults and logs when the stored value is not an object", () => {
    mockAsString.mockReturnValue("[1,2]")

    expect(getRemoteConfigNumericObject("bad-key", defaults)).toBe(defaults)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ actualShape: "array" }),
      }),
    )
  })
})

describe("getRemoteConfigPositiveNumber", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("returns a finite positive remote value", () => {
    mockAsNumber.mockReturnValue(30_000)
    mockAsString.mockReturnValue("30000")

    expect(getRemoteConfigPositiveNumber("duration-key", 60_000)).toBe(30_000)
    expect(mockGetValue).toHaveBeenCalledWith("duration-key")
    expect(mockLogError).not.toHaveBeenCalled()
  })

  /** asNumber() answers 0 for anything it cannot parse, and for a duration a real zero
   *  means "no wait at all" — the opposite of what a caller asking for one wants. */
  it("keeps the fallback and reports a value that was set but does not parse", () => {
    mockAsNumber.mockReturnValue(0)
    mockAsString.mockReturnValue("60s")

    expect(getRemoteConfigPositiveNumber("duration-key", 60_000)).toBe(60_000)
    expect(mockLogError).toHaveBeenCalledWith(
      expect.objectContaining({
        context: expect.objectContaining({ rawSnippet: "60s" }),
      }),
    )
  })

  it("keeps the fallback and reports a negative value", () => {
    mockAsNumber.mockReturnValue(-1)
    mockAsString.mockReturnValue("-1")

    expect(getRemoteConfigPositiveNumber("duration-key", 60_000)).toBe(60_000)
    expect(mockLogError).toHaveBeenCalled()
  })

  it("keeps the fallback and reports a non-finite value", () => {
    mockAsNumber.mockReturnValue(Number.NaN)
    mockAsString.mockReturnValue("not-a-number")

    expect(getRemoteConfigPositiveNumber("duration-key", 60_000)).toBe(60_000)
    expect(mockLogError).toHaveBeenCalled()
  })

  /** A key that was never set answers with its registered default; that is not an ops
   *  mistake, so it must not file one on every launch. */
  it("keeps the fallback silently when the key was never set", () => {
    mockAsNumber.mockReturnValue(0)
    mockAsString.mockReturnValue("")

    expect(getRemoteConfigPositiveNumber("missing-key", 60_000)).toBe(60_000)
    expect(mockLogError).not.toHaveBeenCalled()
  })
})
