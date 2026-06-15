import { resolveSparkDestination } from "@app/screens/send-bitcoin-screen/payment-destination/spark"

describe("resolveSparkDestination", () => {
  it("returns valid destination when network matches", () => {
    const result = resolveSparkDestination({
      address: "spark1abc...",
      identityPublicKey: "pubkey123",
      networkMatch: true,
    })

    expect(result.valid).toBe(true)
    if (!result.valid) return
    expect(result.validDestination).toEqual(
      expect.objectContaining({
        paymentType: "spark",
        address: "spark1abc...",
        identityPublicKey: "pubkey123",
      }),
    )
    expect(result.destinationDirection).toBe("Send")
  })

  it("returns invalid with WrongNetwork when network does not match", () => {
    const result = resolveSparkDestination({
      address: "spark1abc...",
      identityPublicKey: "pubkey123",
      networkMatch: false,
    })

    expect(result.valid).toBe(false)
    if (result.valid) return
    expect(result.invalidReason).toBe("WrongNetwork")
  })
})
