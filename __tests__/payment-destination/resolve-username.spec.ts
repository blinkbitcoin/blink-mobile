import { PaymentType } from "@blinkbitcoin/blink-client"

import { resolveUsername } from "@app/screens/send-bitcoin-screen/payment-destination/resolve-username"

const createValidResult = (paymentType: PaymentType, extra = {}) =>
  ({
    valid: true,
    destinationDirection: "Send",
    validDestination: { paymentType, ...extra },
  }) as never

const createInvalidResult = (
  paymentType: PaymentType,
  invalidReason: string,
  extra = {},
) =>
  ({
    valid: false,
    invalidReason,
    invalidPaymentDestination: { paymentType, ...extra },
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

  it("re-resolves an unresolved username (not a custodial account) as a Lightning Address", async () => {
    const invalid = createInvalidResult(PaymentType.Intraledger, "UsernameDoesNotExist", {
      handle: "bulus",
    })
    const lnurl = createValidResult(PaymentType.Lnurl, { lnurl: "bulus@blink.sv" })
    const resolveLnAddress = jest.fn().mockResolvedValue(lnurl)

    const result = await resolveUsername(invalid, lnAddressHostname, resolveLnAddress)

    expect(resolveLnAddress).toHaveBeenCalledWith("bulus@blink.sv")
    expect(result).toBe(lnurl)
  })

  it("re-resolves an unresolved intraledger-with-flag username as a Lightning Address", async () => {
    const invalid = createInvalidResult(
      PaymentType.IntraledgerWithFlag,
      "UsernameDoesNotExist",
      { handle: "bulus" },
    )
    const lnurl = createValidResult(PaymentType.Lnurl, { lnurl: "bulus@blink.sv" })
    const resolveLnAddress = jest.fn().mockResolvedValue(lnurl)

    const result = await resolveUsername(invalid, lnAddressHostname, resolveLnAddress)

    expect(resolveLnAddress).toHaveBeenCalledWith("bulus@blink.sv")
    expect(result).toBe(lnurl)
  })

  it("does not re-resolve an intraledger result invalid for a reason other than a missing username", async () => {
    const invalid = createInvalidResult(PaymentType.Intraledger, "WrongDomain", {
      handle: "bob",
    })
    const resolveLnAddress = jest.fn()

    const result = await resolveUsername(invalid, lnAddressHostname, resolveLnAddress)

    expect(resolveLnAddress).not.toHaveBeenCalled()
    expect(result).toBe(invalid)
  })

  it("passes a Lnurl destination through unchanged (no re-resolution)", async () => {
    const lnurl = createValidResult(PaymentType.Lnurl, { lnurl: "alice@blink.sv" })
    const resolveLnAddress = jest.fn()

    const result = await resolveUsername(lnurl, lnAddressHostname, resolveLnAddress)

    expect(resolveLnAddress).not.toHaveBeenCalled()
    expect(result).toBe(lnurl)
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
