import axios from "axios"
import { CountryCode } from "libphonenumber-js/mobile"
import Config from "react-native-config"

import {
  IpLookupAdapter,
  DEFAULT_ADAPTERS,
  detectAnonymizingIp,
  detectAnonymizingIpCached,
  resolveIpCountryCode,
  resolveIpCountryCodeCached,
} from "@app/utils/ip-country-lookup"

jest.mock("axios")
jest.mock("@app/utils/error-logging", () => ({
  reportError: jest.fn(),
}))

const mockedAxios = axios as jest.Mocked<typeof axios>
// Cast for mutation in tests — the __mocks__ module is a plain object
const mutableConfig = Config as Record<string, string>

const makeAdapter = (result: CountryCode | undefined | Error): IpLookupAdapter =>
  jest.fn(async (_timeout: number) => {
    if (result instanceof Error) throw result
    return result
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

describe("resolveIpCountryCodeCached", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mutableConfig.GEO_IPIFY_API_KEY = ""
    mutableConfig.IPINFO_API_KEY = ""
    mutableConfig.PROXYCHECK_API_KEY = ""
    mutableConfig.IPAPI_API_KEY = ""
  })

  /** One sequential test: the cache is module state, so the phases (failure
   *  retries, concurrent dedupe, cached reuse) must run in a known order. */
  it("shares one lookup per session, retrying failures and caching successes", async () => {
    mockedAxios.get.mockRejectedValue(new Error("offline"))
    await expect(resolveIpCountryCodeCached()).resolves.toBeUndefined()

    mockedAxios.get.mockReset()
    mockedAxios.get.mockResolvedValue({ data: { country: "DE" } })
    const [first, second] = await Promise.all([
      resolveIpCountryCodeCached(),
      resolveIpCountryCodeCached(),
    ])
    expect(first).toBe("DE")
    expect(second).toBe("DE")
    expect(mockedAxios.get).toHaveBeenCalledTimes(1)

    mockedAxios.get.mockClear()
    await expect(resolveIpCountryCodeCached()).resolves.toBe("DE")
    expect(mockedAxios.get).not.toHaveBeenCalled()
  })
})

describe("detectAnonymizingIp", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mutableConfig.PROXYCHECK_API_KEY = ""
  })

  it("returns true when proxycheck flags the IP as a VPN", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        "status": "ok",
        "1.2.3.4": { detections: { proxy: true, vpn: true } },
      },
    })

    await expect(detectAnonymizingIp()).resolves.toBe(true)
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("proxycheck.io"),
      expect.anything(),
    )
  })

  it("returns false when proxycheck reports the IP clean", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        "status": "ok",
        "1.2.3.4": { detections: { proxy: false, vpn: false } },
      },
    })

    await expect(detectAnonymizingIp()).resolves.toBe(false)
  })

  it("parses the v2-style flat proxy flag", async () => {
    mockedAxios.get.mockResolvedValue({
      data: { "status": "ok", "1.2.3.4": { proxy: "yes" } },
    })
    await expect(detectAnonymizingIp()).resolves.toBe(true)

    mockedAxios.get.mockResolvedValue({
      data: { "status": "ok", "1.2.3.4": { proxy: "no" } },
    })
    await expect(detectAnonymizingIp()).resolves.toBe(false)
  })

  it("returns undefined when the response carries no detection fields", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        "status": "ok",
        // eslint-disable-next-line camelcase
        "1.2.3.4": { location: { country_code: "SE" } },
      },
    })

    await expect(detectAnonymizingIp()).resolves.toBeUndefined()
  })

  it("returns undefined for an unrecognized flat proxy value", async () => {
    mockedAxios.get.mockResolvedValue({
      data: { "status": "ok", "1.2.3.4": { proxy: "maybe" } },
    })

    await expect(detectAnonymizingIp()).resolves.toBeUndefined()
  })

  it("returns undefined and reports when the request fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("proxycheck down"))

    await expect(detectAnonymizingIp()).resolves.toBeUndefined()
  })

  it("appends the api key when PROXYCHECK_API_KEY is set", async () => {
    mutableConfig.PROXYCHECK_API_KEY = "test-proxycheck-key"
    mockedAxios.get.mockResolvedValue({
      data: { "status": "ok", "1.2.3.4": { detections: { proxy: false } } },
    })

    await detectAnonymizingIp()

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("key=test-proxycheck-key"),
      expect.anything(),
    )
  })
})

describe("detectAnonymizingIpCached", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mutableConfig.PROXYCHECK_API_KEY = ""
  })

  /** One sequential test: the cache is module state, so the phases (inconclusive
   *  retries, conclusive reuse) must run in a known order. */
  it("retries inconclusive detections and caches conclusive ones", async () => {
    mockedAxios.get.mockRejectedValue(new Error("offline"))
    await expect(detectAnonymizingIpCached()).resolves.toBeUndefined()

    mockedAxios.get.mockReset()
    mockedAxios.get.mockResolvedValue({
      data: { "status": "ok", "1.2.3.4": { detections: { vpn: true } } },
    })
    const [first, second] = await Promise.all([
      detectAnonymizingIpCached(),
      detectAnonymizingIpCached(),
    ])
    expect(first).toBe(true)
    expect(second).toBe(true)
    expect(mockedAxios.get).toHaveBeenCalledTimes(1)

    mockedAxios.get.mockClear()
    await expect(detectAnonymizingIpCached()).resolves.toBe(true)
    expect(mockedAxios.get).not.toHaveBeenCalled()
  })
})

describe("DEFAULT_ADAPTERS key-gated behaviour", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mutableConfig.GEO_IPIFY_API_KEY = ""
    mutableConfig.IPINFO_API_KEY = ""
    mutableConfig.PROXYCHECK_API_KEY = ""
    mutableConfig.IPAPI_API_KEY = ""
  })

  it("uses ipinfo first (free tier, no key needed)", async () => {
    mockedAxios.get.mockResolvedValue({ data: { country: "DE" } })

    const result = await resolveIpCountryCode(DEFAULT_ADAPTERS)

    expect(result).toBe("DE")
    expect(mockedAxios.get).toHaveBeenCalledTimes(1)
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("ipinfo.io"),
      expect.anything(),
    )
  })

  it("calls the api.ipinfo.io/lite/me endpoint with the Bearer header when IPINFO_API_KEY is set", async () => {
    mutableConfig.IPINFO_API_KEY = "test-ipinfo-key"
    // eslint-disable-next-line camelcase
    mockedAxios.get.mockResolvedValue({ data: { country_code: "DE" } })

    const result = await resolveIpCountryCode(DEFAULT_ADAPTERS)

    expect(result).toBe("DE")
    expect(mockedAxios.get).toHaveBeenCalledWith(
      "https://api.ipinfo.io/lite/me",
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer test-ipinfo-key" }),
      }),
    )
  })

  it("never calls the /lite/ endpoint without the /me segment, which 404s and defaults the country", async () => {
    mutableConfig.IPINFO_API_KEY = "test-ipinfo-key"
    // eslint-disable-next-line camelcase
    mockedAxios.get.mockResolvedValue({ data: { country_code: "DE" } })

    await resolveIpCountryCode(DEFAULT_ADAPTERS)

    expect(mockedAxios.get).not.toHaveBeenCalledWith(
      "https://api.ipinfo.io/lite/",
      expect.anything(),
    )
  })

  it("skips ipify when key is absent, uses ipinfo free tier", async () => {
    mockedAxios.get.mockResolvedValue({ data: { country: "JP" } })

    const result = await resolveIpCountryCode(DEFAULT_ADAPTERS)

    expect(result).toBe("JP")
    expect(mockedAxios.get).not.toHaveBeenCalledWith(
      expect.stringContaining("ipify"),
      expect.anything(),
    )
  })

  it("uses ipify when key is present and ipinfo+proxycheck fail", async () => {
    mutableConfig.GEO_IPIFY_API_KEY = "test-ipify-key"
    mockedAxios.get
      .mockRejectedValueOnce(new Error("ipinfo down"))
      .mockRejectedValueOnce(new Error("proxycheck down"))
      .mockResolvedValueOnce({ data: { location: { country: "JP" } } })

    const result = await resolveIpCountryCode(DEFAULT_ADAPTERS)

    expect(result).toBe("JP")
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("ipify"),
      expect.anything(),
    )
  })

  it("uses proxycheck.io free tier and parses country_code from nested IP entry", async () => {
    mockedAxios.get.mockResolvedValue({
      data: {
        "status": "ok",
        // eslint-disable-next-line camelcase
        "1.2.3.4": { location: { country_code: "SE" } },
      },
    })

    const result = await resolveIpCountryCode(DEFAULT_ADAPTERS)

    expect(result).toBe("SE")
    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("proxycheck.io"),
      expect.anything(),
    )
  })

  it("appends the api key to the proxycheck.io url when PROXYCHECK_API_KEY is set", async () => {
    mutableConfig.PROXYCHECK_API_KEY = "test-proxycheck-key"
    mockedAxios.get.mockResolvedValue({
      data: {
        "status": "ok",
        // eslint-disable-next-line camelcase
        "1.2.3.4": { location: { country_code: "SE" } },
      },
    })

    await resolveIpCountryCode(DEFAULT_ADAPTERS)

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("key=test-proxycheck-key"),
      expect.anything(),
    )
  })

  it("appends the api key to the ipapi.co url when IPAPI_KEY is set", async () => {
    mutableConfig.IPAPI_API_KEY = "test-ipapi-key"
    // eslint-disable-next-line camelcase
    mockedAxios.get.mockResolvedValue({ data: { country_code: "SV" } })

    await resolveIpCountryCode(DEFAULT_ADAPTERS)

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.stringContaining("key=test-ipapi-key"),
      expect.anything(),
    )
  })

  it("calls ipapi.co without a key when IPAPI_KEY is absent", async () => {
    // eslint-disable-next-line camelcase
    mockedAxios.get.mockResolvedValue({ data: { country_code: "SV" } })

    await resolveIpCountryCode(DEFAULT_ADAPTERS)

    expect(mockedAxios.get).toHaveBeenCalledWith(
      expect.not.stringContaining("key="),
      expect.anything(),
    )
  })

  it("falls through ipinfo → proxycheck → ipify in order", async () => {
    mutableConfig.GEO_IPIFY_API_KEY = "test-ipify-key"
    mockedAxios.get
      .mockRejectedValueOnce(new Error("ipinfo down"))
      .mockRejectedValueOnce(new Error("proxycheck down"))
      .mockResolvedValueOnce({ data: { location: { country: "PL" } } })

    const result = await resolveIpCountryCode(DEFAULT_ADAPTERS)

    expect(result).toBe("PL")
    expect(mockedAxios.get).toHaveBeenCalledTimes(3)
    expect(mockedAxios.get).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("ipify"),
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
        PROXYCHECK_API_KEY: "",
        IPAPI_API_KEY: "",
      }))
      require("@app/utils/ip-country-lookup") // eslint-disable-line @typescript-eslint/no-var-requires
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
      require("@app/utils/ip-country-lookup") // eslint-disable-line @typescript-eslint/no-var-requires
    })
    expect(warnSpy).not.toHaveBeenCalled()
  })
})
