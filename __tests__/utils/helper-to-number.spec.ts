import { toNumber } from "@app/utils/helper"

describe("toNumber", () => {
  it("returns number as-is", () => {
    expect(toNumber(42)).toBe(42)
  })

  it("returns 0 for number 0", () => {
    expect(toNumber(0)).toBe(0)
  })

  it("converts bigint to number", () => {
    expect(toNumber(BigInt(1000))).toBe(1000)
  })

  it("converts bigint zero to number", () => {
    expect(toNumber(BigInt(0))).toBe(0)
  })

  it("converts numeric string to number", () => {
    expect(toNumber("500")).toBe(500)
  })

  it("converts string zero to number", () => {
    expect(toNumber("0")).toBe(0)
  })

  it("returns 0 for non-numeric string", () => {
    expect(toNumber("abc")).toBe(0)
  })

  it("returns 0 for empty string", () => {
    expect(toNumber("")).toBe(0)
  })

  it("converts negative bigint", () => {
    expect(toNumber(BigInt(-100))).toBe(-100)
  })

  it("converts negative number", () => {
    expect(toNumber(-50)).toBe(-50)
  })
})
