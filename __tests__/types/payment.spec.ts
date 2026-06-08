import { ConvertAmountAdjustment, resolveDustAdjustment } from "@app/types/payment"

describe("resolveDustAdjustment", () => {
  it("returns null when no adjustment was reported", () => {
    expect(resolveDustAdjustment(null, 50, 1000)).toBeNull()
  })

  it("returns null for FlooredToMin (benign SDK floor, never blocks/warns)", () => {
    expect(
      resolveDustAdjustment(ConvertAmountAdjustment.FlooredToMin, 50, 1000),
    ).toBeNull()
  })

  it("returns IncreasedToAvoidDust when remainder would be sub-threshold (amount < balance)", () => {
    expect(
      resolveDustAdjustment(ConvertAmountAdjustment.IncreasedToAvoidDust, 50, 1000),
    ).toBe(ConvertAmountAdjustment.IncreasedToAvoidDust)
  })

  it("returns null when the user is already draining the full balance (amount === balance)", () => {
    expect(
      resolveDustAdjustment(ConvertAmountAdjustment.IncreasedToAvoidDust, 1000, 1000),
    ).toBeNull()
  })

  it("returns null when the requested amount exceeds the balance (validation lives elsewhere)", () => {
    expect(
      resolveDustAdjustment(ConvertAmountAdjustment.IncreasedToAvoidDust, 2000, 1000),
    ).toBeNull()
  })

  it("returns IncreasedToAvoidDust defensively when the balance is unknown", () => {
    expect(
      resolveDustAdjustment(ConvertAmountAdjustment.IncreasedToAvoidDust, 50, undefined),
    ).toBe(ConvertAmountAdjustment.IncreasedToAvoidDust)
  })
})
