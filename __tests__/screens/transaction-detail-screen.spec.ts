import { typeDisplay } from "@app/screens/transaction-detail-screen/transaction-detail-screen"
import { PaymentType } from "@app/types/transaction.types"

const settlement = <T extends string>(typename: T) => ({ __typename: typename }) as never

describe("typeDisplay", () => {
  it("returns 'Spark' when the self-custodial paymentType is Spark, even if settlementVia is Lightning", () => {
    expect(typeDisplay(settlement("SettlementViaLn"), PaymentType.Spark)).toBe("Spark")
  })

  it("falls back to the settlementVia typename when no self-custodial paymentType is given", () => {
    expect(typeDisplay(settlement("SettlementViaOnChain"))).toBe("OnChain")
    expect(typeDisplay(settlement("SettlementViaLn"))).toBe("Lightning")
    expect(typeDisplay(settlement("SettlementViaIntraLedger"))).toBe("IntraLedger")
  })

  it("keeps the settlementVia mapping for non-Spark self-custodial paymentTypes (Lightning, Onchain)", () => {
    expect(typeDisplay(settlement("SettlementViaLn"), PaymentType.Lightning)).toBe(
      "Lightning",
    )
    expect(typeDisplay(settlement("SettlementViaOnChain"), PaymentType.Onchain)).toBe(
      "OnChain",
    )
  })

  it("returns 'Unknown' for missing or malformed settlementVia with no Spark hint", () => {
    expect(typeDisplay(undefined)).toBe("Unknown")
    expect(typeDisplay({} as never)).toBe("Unknown")
  })
})
