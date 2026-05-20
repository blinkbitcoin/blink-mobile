import {
  getBip39Suggestions,
  BIP39_WORDLIST_EN,
  splitWords,
} from "@app/utils/bip39-wordlist"

describe("BIP39_WORDLIST_EN", () => {
  it("contains 2048 words", () => {
    expect(BIP39_WORDLIST_EN).toHaveLength(2048)
  })

  it("contains only lowercase words", () => {
    BIP39_WORDLIST_EN.forEach((word) => {
      expect(word).toBe(word.toLowerCase())
    })
  })
})

describe("getBip39Suggestions", () => {
  it("returns empty array for prefix shorter than default minChars", () => {
    expect(getBip39Suggestions("")).toEqual([])
    expect(getBip39Suggestions("a")).toEqual([])
    expect(getBip39Suggestions("ab")).toEqual([])
  })

  it("returns suggestions for 3+ character prefix", () => {
    const results = getBip39Suggestions("aba")
    expect(results.length).toBeGreaterThan(0)
    expect(results[0]).toBe("abandon")
  })

  it("returns max 10 suggestions by default", () => {
    const results = getBip39Suggestions("abs")
    expect(results.length).toBeLessThanOrEqual(10)
  })

  it("respects custom maxResults", () => {
    const results = getBip39Suggestions("ab", { minChars: 2, maxResults: 3 })
    expect(results.length).toBeLessThanOrEqual(3)
  })

  it("respects custom minChars", () => {
    expect(getBip39Suggestions("a", { minChars: 1 }).length).toBeGreaterThan(0)
    expect(getBip39Suggestions("a")).toEqual([])
  })

  it("filters by prefix match", () => {
    const results = getBip39Suggestions("zoo")
    expect(results).toEqual(["zoo"])
  })

  it("is case insensitive", () => {
    const lower = getBip39Suggestions("aba")
    const upper = getBip39Suggestions("ABA")
    expect(lower).toEqual(upper)
  })

  it("returns empty array for non-matching prefix", () => {
    expect(getBip39Suggestions("zzz")).toEqual([])
  })
})

describe("splitWords", () => {
  it("splits text into lowercase words", () => {
    expect(splitWords("Hello World")).toEqual(["hello", "world"])
  })

  it("handles multiple spaces", () => {
    expect(splitWords("one   two  three")).toEqual(["one", "two", "three"])
  })

  it("trims whitespace", () => {
    expect(splitWords("  hello  ")).toEqual(["hello"])
  })

  it("handles tabs and newlines", () => {
    expect(splitWords("one\ttwo\nthree")).toEqual(["one", "two", "three"])
  })

  it("converts to lowercase", () => {
    expect(splitWords("ABANDON ABILITY")).toEqual(["abandon", "ability"])
  })
})
