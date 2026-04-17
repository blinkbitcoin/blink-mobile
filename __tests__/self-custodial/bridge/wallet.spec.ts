import {
  getUserSettings,
  getWalletInfo,
  listPayments,
} from "@app/self-custodial/bridge/wallet"

describe("getWalletInfo", () => {
  it("calls sdk.getInfo with ensureSynced:true so the reported balance is fresh", () => {
    const getInfo = jest.fn().mockResolvedValue({ balanceSats: 0 })

    getWalletInfo({ getInfo } as never)

    expect(getInfo).toHaveBeenCalledWith({ ensureSynced: true })
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
