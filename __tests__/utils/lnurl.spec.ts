import { bech32 } from "bech32"

import {
  BareLnurlDecodeStatus,
  decodeBareLnurl,
  isHttpsUrl,
  lud17Url,
} from "@app/utils/lnurl"

const encodeLnurl = (url: string): string =>
  bech32.encode("lnurl", bech32.toWords(Buffer.from(url, "utf8")), 20000)

describe("decodeBareLnurl", () => {
  it("returns NotBareLnurl for lightning addresses", () => {
    expect(decodeBareLnurl("alice@example.com")).toEqual({
      status: BareLnurlDecodeStatus.NotBareLnurl,
    })
  })

  it("returns NotBareLnurl for LUD-17 URIs", () => {
    expect(decodeBareLnurl("lnurlw://example.com/withdraw")).toEqual({
      status: BareLnurlDecodeStatus.NotBareLnurl,
    })
  })

  it("returns NotBareLnurl for non-lnurl bech32 strings", () => {
    expect(decodeBareLnurl("lnurlrandomstring")).toEqual({
      status: BareLnurlDecodeStatus.NotBareLnurl,
    })
  })

  it("decodes a bare lnurl1 string to its embedded URL", () => {
    const url = "https://example.com/lnurl?q=1"
    expect(decodeBareLnurl(encodeLnurl(url))).toEqual({
      status: BareLnurlDecodeStatus.Decoded,
      url,
    })
  })

  it("decodes an uppercase LNURL1 string", () => {
    const url = "https://example.com/lnurl"
    expect(decodeBareLnurl(encodeLnurl(url).toUpperCase())).toEqual({
      status: BareLnurlDecodeStatus.Decoded,
      url,
    })
  })

  it("decodes an embedded http URL verbatim (no scheme enforcement here)", () => {
    const url = "http://example.com/lnurl"
    expect(decodeBareLnurl(encodeLnurl(url))).toEqual({
      status: BareLnurlDecodeStatus.Decoded,
      url,
    })
  })

  it("returns DecodeError for a lnurl1 string with an invalid checksum", () => {
    expect(decodeBareLnurl("lnurl1qqqqqq")).toEqual({
      status: BareLnurlDecodeStatus.DecodeError,
    })
  })

  it("returns DecodeError for a lnurl1 string with characters outside the bech32 charset", () => {
    expect(decodeBareLnurl("lnurl1bbb")).toEqual({
      status: BareLnurlDecodeStatus.DecodeError,
    })
  })
})

describe("lud17Url", () => {
  it("returns null for non-LUD-17 input", () => {
    expect(lud17Url("alice@example.com")).toBeNull()
    expect(lud17Url("https://example.com/lnurl")).toBeNull()
  })

  it("maps lnurlw:// to https", () => {
    expect(lud17Url("lnurlw://example.com/withdraw")).toBe("https://example.com/withdraw")
  })

  it("maps lnurlp:// to https", () => {
    expect(lud17Url("lnurlp://example.com/pay")).toBe("https://example.com/pay")
  })

  it("is case-insensitive on the scheme", () => {
    expect(lud17Url("LNURLW://example.com/withdraw")).toBe("https://example.com/withdraw")
  })

  it("maps a payload containing .onion to plain http, mirroring js-lnurl", () => {
    expect(lud17Url("lnurlw://attacker.com/w/.onion/x")).toBe(
      "http://attacker.com/w/.onion/x",
    )
    expect(lud17Url("lnurlw://hiddenservice.onion/withdraw")).toBe(
      "http://hiddenservice.onion/withdraw",
    )
  })
})

describe("isHttpsUrl", () => {
  it("accepts https URLs", () => {
    expect(isHttpsUrl("https://example.com/callback")).toBe(true)
  })

  it("rejects http URLs", () => {
    expect(isHttpsUrl("http://example.com/callback")).toBe(false)
  })

  it("rejects other schemes", () => {
    expect(isHttpsUrl("ftp://example.com/callback")).toBe(false)
  })

  it("rejects malformed input", () => {
    expect(isHttpsUrl("not a url")).toBe(false)
    expect(isHttpsUrl("")).toBe(false)
  })
})
