import {
  getRemoteConfigList,
  getRemoteConfigObject,
  serializeRemoteConfigDefault,
} from "@app/utils/remote-config"

const mockAsString = jest.fn()
const mockGetValue = jest.fn(() => ({ asString: mockAsString }))

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
  })

  it("returns the fallback when the Remote Config value is an empty string", () => {
    mockAsString.mockReturnValue("")
    const fallback = ["FALLBACK"]

    expect(getRemoteConfigList("missing-key", fallback)).toBe(fallback)
  })

  it("returns the fallback when the stored value cannot be parsed as JSON", () => {
    mockAsString.mockReturnValue("not-valid-json")
    const fallback = ["FALLBACK"]

    expect(getRemoteConfigList("bad-key", fallback)).toBe(fallback)
  })

  it("preserves the generic element type for nested objects", () => {
    mockAsString.mockReturnValue('[{"id":1},{"id":2}]')

    const result = getRemoteConfigList<{ id: number }>("any-key", [])

    expect(result).toEqual([{ id: 1 }, { id: 2 }])
  })

  it("returns the fallback when the stored value is valid JSON but not an array (object)", () => {
    mockAsString.mockReturnValue('{"US":true}')
    const fallback = ["FALLBACK"]

    expect(getRemoteConfigList("misconfigured-key", fallback)).toBe(fallback)
  })

  it("returns the fallback when the stored value is valid JSON but a primitive", () => {
    mockAsString.mockReturnValue('"US"')
    const fallback = ["FALLBACK"]

    expect(getRemoteConfigList("misconfigured-key", fallback)).toBe(fallback)
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
  })

  it("returns the fallback when the Remote Config value is empty", () => {
    mockAsString.mockReturnValue("")
    const fallback = { foo: "bar" }

    expect(getRemoteConfigObject("missing-key", fallback)).toBe(fallback)
  })

  it("returns the fallback when the stored value cannot be parsed as JSON", () => {
    mockAsString.mockReturnValue("not-valid-json")
    const fallback = { foo: "bar" }

    expect(getRemoteConfigObject("bad-key", fallback)).toBe(fallback)
  })
})
