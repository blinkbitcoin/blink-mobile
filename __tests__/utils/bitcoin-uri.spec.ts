import { buildBitcoinUri, satsToBtc } from "@app/utils/bitcoin-uri"

describe("satsToBtc", () => {
  it("converts sats to BTC", () => {
    expect(satsToBtc(100000000)).toBe(1)
  })

  it("converts small amounts", () => {
    expect(satsToBtc(500)).toBe(0.000005)
  })

  it("returns 0 for 0 sats", () => {
    expect(satsToBtc(0)).toBe(0)
  })
})

describe("buildBitcoinUri", () => {
  it("builds basic address with prefix", () => {
    expect(buildBitcoinUri({ address: "bc1q..." })).toBe("bitcoin:bc1q...")
  })

  it("builds address without prefix", () => {
    expect(buildBitcoinUri({ address: "bc1q...", prefix: false })).toBe("bc1q...")
  })

  it("includes amount in BTC", () => {
    const uri = buildBitcoinUri({ address: "bc1q...", amountSats: 50000 })
    expect(uri).toBe("bitcoin:bc1q...?amount=0.0005")
  })

  it("formats 1 sat as plain decimal (never exponential)", () => {
    const uri = buildBitcoinUri({ address: "bc1q...", amountSats: 1 })
    expect(uri).toBe("bitcoin:bc1q...?amount=0.00000001")
    expect(uri).not.toContain("e-")
  })

  it("formats whole BTC without trailing zeros", () => {
    const uri = buildBitcoinUri({ address: "bc1q...", amountSats: 100000000 })
    expect(uri).toBe("bitcoin:bc1q...?amount=1")
  })

  it("percent-encodes spaces in memo as %20 (BIP-21), not + (form-encoding)", () => {
    const uri = buildBitcoinUri({ address: "bc1q...", memo: "test payment" })
    expect(uri).toContain("message=test%20payment")
    expect(uri).not.toContain("message=test+payment")
  })

  it("percent-encodes URI-reserved characters in memo", () => {
    const uri = buildBitcoinUri({ address: "bc1q...", memo: "a&b=c?d" })
    expect(uri).toContain("message=a%26b%3Dc%3Fd")
  })

  it("includes both amount and memo", () => {
    const uri = buildBitcoinUri({
      address: "bc1q...",
      amountSats: 1000,
      memo: "coffee",
    })
    expect(uri).toContain("amount=0.00001")
    expect(uri).toContain("message=coffee")
  })

  it("uppercases address when requested", () => {
    const uri = buildBitcoinUri({ address: "bc1q...", uppercase: true })
    expect(uri).toBe("bitcoin:BC1Q...")
  })

  it("returns address only when no amount or memo", () => {
    const uri = buildBitcoinUri({ address: "bc1q..." })
    expect(uri).not.toContain("?")
  })
})
