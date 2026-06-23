import { PaymentType } from "@blinkbitcoin/blink-client"

import { resolveUsername } from "@app/screens/send-bitcoin-screen/payment-destination/resolve-username"

const createValidResult = (paymentType: PaymentType, extra = {}) =>
  ({
    valid: true,
    destinationDirection: "Send",
    validDestination: { paymentType, ...extra },
  }) as never

describe("resolveUsername", () => {
  const lnAddressHostname = "blink.sv"

  it("re-resolves a bare username as a Lightning Address via the injected resolver", async () => {
    const intraledger = createValidResult(PaymentType.Intraledger, {
      handle: "esaudeveloper",
    })
    const lnurl = createValidResult(PaymentType.Lnurl, {
      lnurl: "esaudeveloper@blink.sv",
    })
    const resolveLnAddress = jest.fn().mockResolvedValue(lnurl)

    const result = await resolveUsername(intraledger, lnAddressHostname, resolveLnAddress)

    expect(resolveLnAddress).toHaveBeenCalledWith("esaudeveloper@blink.sv")
    expect(result).toBe(lnurl)
  })

  it("re-resolves an intraledger-with-flag handle (USD) the same way, stripped to the bare username", async () => {
    const intraledger = createValidResult(PaymentType.IntraledgerWithFlag, {
      handle: "esaudeveloper",
    })
    const lnurl = createValidResult(PaymentType.Lnurl, {})
    const resolveLnAddress = jest.fn().mockResolvedValue(lnurl)

    const result = await resolveUsername(intraledger, lnAddressHostname, resolveLnAddress)

    expect(resolveLnAddress).toHaveBeenCalledWith("esaudeveloper@blink.sv")
    expect(result).toBe(lnurl)
  })

  it("passes a Lnurl destination through unchanged (no re-resolution)", async () => {
    const lnurl = createValidResult(PaymentType.Lnurl, { lnurl: "alice@blink.sv" })
    const resolveLnAddress = jest.fn()

    const result = await resolveUsername(lnurl, lnAddressHostname, resolveLnAddress)

    expect(resolveLnAddress).not.toHaveBeenCalled()
    expect(result).toBe(lnurl)
  })

  it("passes invalid destinations through unchanged", async () => {
    const invalid = { valid: false } as never
    const resolveLnAddress = jest.fn()

    const result = await resolveUsername(invalid, lnAddressHostname, resolveLnAddress)

    expect(resolveLnAddress).not.toHaveBeenCalled()
    expect(result).toBe(invalid)
  })

  it("passes Receive-direction destinations through unchanged", async () => {
    const receive = {
      valid: true,
      destinationDirection: "Receive",
      validDestination: { paymentType: PaymentType.Intraledger, handle: "esaudeveloper" },
    } as never
    const resolveLnAddress = jest.fn()

    const result = await resolveUsername(receive, lnAddressHostname, resolveLnAddress)

    expect(resolveLnAddress).not.toHaveBeenCalled()
    expect(result).toBe(receive)
  })
})
