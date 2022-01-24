import { currencyToText } from "../app/utils/currencyConversion"

describe("currencyToText", () => {
  it("0", () => {
    const amount = "0"
    const currency = "USD"

    const text = currencyToText(amount, currency)

    expect(text).toBe("0")
  })

  it("0.90", () => {
    const amount = "0.90"
    const currency = "USD"

    const text = currencyToText(amount, currency)

    expect(text).toBe("0.90")
  })
})
