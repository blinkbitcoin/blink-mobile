import {
  checkLightningAddressAvailable,
  getUserSettings,
  getWalletInfo,
  listPayments,
  registerLightningAddress,
} from "@app/self-custodial/bridge/wallet"

describe("getWalletInfo", () => {
  it("calls sdk.getInfo with ensureSynced:false so startup does not block on SDK sync", () => {
    const getInfo = jest.fn().mockResolvedValue({ balanceSats: 0 })

    getWalletInfo({ getInfo } as never)

    expect(getInfo).toHaveBeenCalledWith({ ensureSynced: false })
  })
})

describe("listPayments", () => {
  it("forwards offset and limit with all filters unset", () => {
    const listPaymentsFn = jest.fn().mockResolvedValue({ payments: [] })

    listPayments({ listPayments: listPaymentsFn } as never, 20, 50)

    expect(listPaymentsFn).toHaveBeenCalledWith({
      typeFilter: undefined,
      statusFilter: undefined,
      assetFilter: undefined,
      paymentDetailsFilter: undefined,
      fromTimestamp: undefined,
      toTimestamp: undefined,
      offset: 20,
      limit: 50,
      sortAscending: false,
    })
  })
})

describe("getUserSettings", () => {
  it("delegates to sdk.getUserSettings", () => {
    const getSettings = jest.fn().mockResolvedValue({})

    getUserSettings({ getUserSettings: getSettings } as never)

    expect(getSettings).toHaveBeenCalledTimes(1)
  })
})

describe("checkLightningAddressAvailable", () => {
  it("forwards the username and returns the SDK availability result", async () => {
    const check = jest.fn().mockResolvedValue(true)

    const result = await checkLightningAddressAvailable(
      { checkLightningAddressAvailable: check } as never,
      "alice",
    )

    expect(check).toHaveBeenCalledWith({ username: "alice" })
    expect(result).toBe(true)
  })
})

describe("registerLightningAddress", () => {
  it("forwards the username and description and returns the address info", async () => {
    const register = jest
      .fn()
      .mockResolvedValue({ lightningAddress: "alice@lnurl.staging.blink.sv" })

    const result = await registerLightningAddress(
      { registerLightningAddress: register } as never,
      "alice",
    )

    expect(register).toHaveBeenCalledWith({ username: "alice", description: undefined })
    expect(result).toEqual({ lightningAddress: "alice@lnurl.staging.blink.sv" })
  })
})
