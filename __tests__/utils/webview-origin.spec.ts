import { describe, expect, it } from "@jest/globals"

import { isAllowedOrigin, originOf, originsFromUrls } from "@app/utils/webview-origin"

describe("originOf", () => {
  it("returns the origin of an https URL, ignoring path and query", () => {
    expect(originOf("https://kyc.blink.sv/webflow?token=abc&lang=en")).toBe(
      "https://kyc.blink.sv",
    )
  })

  it("keeps explicit non-default ports", () => {
    expect(originOf("http://localhost:3000/page")).toBe("http://localhost:3000")
    expect(originOf("https://kyc.blink.sv:8443/")).toBe("https://kyc.blink.sv:8443")
  })

  it("normalizes host case and elides default ports", () => {
    expect(originOf("https://KYC.Blink.SV/x")).toBe("https://kyc.blink.sv")
    expect(originOf("https://kyc.blink.sv:443/x")).toBe("https://kyc.blink.sv")
  })

  it.each([
    ["empty string", ""],
    ["garbage", "not a url"],
    ["about:blank", "about:blank"],
    // eslint-disable-next-line no-script-url
    ["javascript scheme", "javascript:alert(1)"],
    ["data scheme", "data:text/html,<script>alert(1)</script>"],
    ["file scheme", "file:///etc/passwd"],
  ])("fails closed on %s", (_label, url) => {
    expect(originOf(url)).toBeNull()
  })

  it("fails closed on undefined and null", () => {
    expect(originOf(undefined)).toBeNull()
    expect(originOf(null)).toBeNull()
  })
})

describe("isAllowedOrigin", () => {
  const allowlist = ["https://kyc.blink.sv", "https://fiat.blink.sv"]

  it("matches an exact origin regardless of path and query", () => {
    expect(isAllowedOrigin("https://kyc.blink.sv/webflow?token=x", allowlist)).toBe(true)
    expect(isAllowedOrigin("https://fiat.blink.sv?accountId=1", allowlist)).toBe(true)
  })

  it.each([
    ["allowlisted host in the path", "https://evil.com/kyc.blink.sv"],
    ["allowlisted host as subdomain prefix", "https://kyc.blink.sv.evil.com"],
    ["lookalike host", "https://kycxblink.sv"],
    ["subdomain of allowlisted host", "https://sub.kyc.blink.sv"],
  ])("rejects substring attacks: %s", (_label, url) => {
    expect(isAllowedOrigin(url, allowlist)).toBe(false)
  })

  it("rejects scheme and port confusion", () => {
    expect(isAllowedOrigin("http://kyc.blink.sv", allowlist)).toBe(false)
    expect(isAllowedOrigin("https://kyc.blink.sv:8443", allowlist)).toBe(false)
  })

  it("rejects anything against an empty allowlist", () => {
    expect(isAllowedOrigin("https://kyc.blink.sv", [])).toBe(false)
  })

  it("rejects unparseable urls", () => {
    expect(isAllowedOrigin("about:blank", allowlist)).toBe(false)
    expect(isAllowedOrigin(undefined, allowlist)).toBe(false)
  })
})

describe("originsFromUrls", () => {
  it("maps urls to their origins", () => {
    expect(
      originsFromUrls(["https://kyc.blink.sv/webflow", "https://fiat.blink.sv?a=1"]),
    ).toEqual(["https://kyc.blink.sv", "https://fiat.blink.sv"])
  })

  it("dedupes same-origin urls", () => {
    expect(
      originsFromUrls(["http://localhost:3000/kyc", "http://localhost:3000/fiat"]),
    ).toEqual(["http://localhost:3000"])
  })

  it("drops unparseable and empty entries instead of failing open", () => {
    expect(
      originsFromUrls(["", undefined, null, "garbage", "https://ok.example"]),
    ).toEqual(["https://ok.example"])
  })

  it("returns an empty list for empty input", () => {
    expect(originsFromUrls([])).toEqual([])
  })
})
