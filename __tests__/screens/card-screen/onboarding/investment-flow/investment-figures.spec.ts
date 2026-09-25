import {
  formatUnitCount,
  formatUsdAmount,
} from "@app/screens/card-screen/onboarding/investment-flow/investment-figures"

describe("the figures as they are written", () => {
  it("groups an amount the way the select screen groups its options", () => {
    expect(formatUsdAmount(25000)).toBe("$25,000")
    expect(formatUsdAmount(100000)).toBe("$100,000")
  })

  /** The shortfall is the amount less the balance, and that subtraction leaves a
   *  floating-point tail; dollars stop at the cent. A whole amount still prints without
   *  a decimal point. */
  it("cuts a figure to cents", () => {
    expect(formatUsdAmount(25000 - 3333.76)).toBe("$21,666.24")
  })

  /** Units are a count, not money, and carry no currency of their own. */
  it("groups a unit count without a currency", () => {
    expect(formatUnitCount(25000)).toBe("25,000")
  })
})
