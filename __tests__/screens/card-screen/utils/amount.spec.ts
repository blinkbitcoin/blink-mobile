import { createCurrencyFormatters } from "@app/screens/card-screen/utils/amount"

describe("createCurrencyFormatters", () => {
  const { formatAmount } = createCurrencyFormatters("$")

  it("formats an amount with the symbol and thousands separators", () => {
    expect(formatAmount("1055")).toBe("$1,055")
  })

  it("reads a comma decimal the way it is saved", () => {
    expect(formatAmount("350,50")).toBe("$350.5")
  })

  it("shows text that is no amount as zero", () => {
    expect(formatAmount("abc")).toBe("$0")
  })
})
