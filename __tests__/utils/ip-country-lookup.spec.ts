import axios from "axios"

import { IpLookupAdapter, DEFAULT_ADAPTERS, resolveIpCountryCode } from "@app/utils/ip-country-lookup"

jest.mock("axios")
jest.mock("@app/utils/error-logging", () => ({
  reportError: jest.fn(),
}))

const mockedAxios = axios as jest.Mocked<typeof axios>

// react-native-config mock is at __mocks__/react-native-config.js
// IPIFY_API_KEY and IPINFO_TOKEN default to "" (absent)
const Config = require("react-native-config")

const makeAdapter = (result: string | undefined | Error): IpLookupAdapter =>
  jest.fn(async (_timeout: number) => {
    if (result instanceof Error) throw result
    return result as any
  })

describe("resolveIpCountryCode", () => {
  it("returns the first adapter's result and does not call subsequent adapters", async () => {
    const first = makeAdapter("DE")
    const second = makeAdapter("PL")

    const result = await resolveIpCountryCode([first, second])

    expect(result).toBe("DE")
    expect(second).not.toHaveBeenCalled()
  })

  it("skips to the next adapter when the first throws", async () => {
    const first = makeAdapter(new Error("network error"))
    const second = makeAdapter("JP")

    const result = await resolveIpCountryCode([first, second])

    expect(result).toBe("JP")
    expect(first).toHaveBeenCalled()
    expect(second).toHaveBeenCalled()
  })

  it("skips to the next adapter when the first returns undefined", async () => {
    const first = makeAdapter(undefined)
    const second = makeAdapter("FR")

    const result = await resolveIpCountryCode([first, second])

    expect(result).toBe("FR")
  })

  it("returns undefined when all adapters fail", async () => {
    const first = makeAdapter(new Error("timeout"))
    const second = makeAdapter(new Error("rate limited"))

    const result = await resolveIpCountryCode([first, second])

    expect(result).toBeUndefined()
  })

  it("returns undefined when all adapters return undefined", async () => {
    const first = makeAdapter(undefined)
    const second = makeAdapter(undefined)

    const result = await resolveIpCountryCode([first, second])

    expect(result).toBeUndefined()
  })

  it("returns undefined with an empty adapter list", async () => {
    const result = await resolveIpCountryCode([])
    expect(result).toBeUndefined()
  })
})

describe("DEFAULT_ADAPTERS key-gated behaviour", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    Config.GEO_IPIFY_API_KEY = ""
    Config.IPINFO_API_KEY = ""
    Config.IPAPI_API_KEY = ""
  })

  it("skips ipify and ipinfo when keys are absent, falls through to ipapi", async () => {
    mockedAxios.get.mockResolvedValue({ data: { country_code: "DE" } })

    const result = await resolveIpCountryCode(DEFAULT_ADAPTERS)

    expect(result).toBe("DE")
    // Only one axios call — to ipapi.co (ipify and ipinfo were skipped)
    expect(mockedAxios.get).toHaveBeenCalledTimes(1)
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("ipapi.co"),
      expect.anything(),
    )
  })

  it("uses ipify first when key is present", async () => {
    Config.GEO_IPIFY_API_KEY = "test-ipify-key"
    mockedAxios.get.mockResolvedValue({ data: { location: { country: "JP" } } })

    const result = await resolveIpCountryCode(DEFAULT_ADAPTERS)

    expect(result).toBe("JP")
    expect(mockedAxios.get).toHaveBeenCalledTimes(1)
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("ipify"),
      expect.anything(),
    )
  })

  it("appends the api key to the ipapi.co url when IPAPI_KEY is set", async () => {
    Config.IPAPI_API_KEY = "test-ipapi-key"
    mockedAxios.get.mockResolvedValue({ data: { country_code: "SV" } })

    await resolveIpCountryCode(DEFAULT_ADAPTERS)

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("key=test-ipapi-key"),
      expect.anything(),
    )
  })

  it("calls ipapi.co without a key when IPAPI_KEY is absent", async () => {
    mockedAxios.get.mockResolvedValue({ data: { country_code: "SV" } })

    await resolveIpCountryCode(DEFAULT_ADAPTERS)

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.not.stringContaining("key="),
      expect.anything(),
    )
  })

  it("falls through from ipify to ipinfo when ipify fails", async () => {
    Config.GEO_IPIFY_API_KEY = "test-ipify-key"
    Config.IPINFO_API_KEY = "test-ipinfo-token"
    mockedAxios.get
      .mockRejectedValueOnce(new Error("ipify down"))
      .mockResolvedValueOnce({ data: { country: "PL" } })

    const result = await resolveIpCountryCode(DEFAULT_ADAPTERS)

    expect(result).toBe("PL")
    expect(mockedAxios.get).toHaveBeenCalledTimes(2)
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("ipinfo.io"),
      expect.anything(),
    )
  })
})

describe("no-key warning", () => {
  let warnSpy: jest.SpyInstance

  beforeEach(() => {
    warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    warnSpy.mockRestore()
    jest.resetModules()
  })

  it("warns on module load when no API keys are configured", () => {
    jest.isolateModules(() => {
      jest.mock("react-native-config", () => ({
        GEO_IPIFY_API_KEY: "",
        IPINFO_API_KEY: "",
        IPAPI_API_KEY: "",
      }))
      require("@app/utils/ip-country-lookup")
    })
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("No API key configured"))
  })

  it("does not warn when at least one API key is configured", () => {
    jest.isolateModules(() => {
      jest.mock("react-native-config", () => ({
        GEO_IPIFY_API_KEY: "test-key",
        IPINFO_API_KEY: "",
        IPAPI_API_KEY: "",
      }))
      require("@app/utils/ip-country-lookup")
    })
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
