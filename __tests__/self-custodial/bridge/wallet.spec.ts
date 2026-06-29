import { Network, defaultExternalSigner } from "@breeztech/breez-sdk-spark-react-native"

import {
  checkLightningAddressAvailable,
  deriveWalletIdentityPubkey,
  getUserSettings,
  getWalletInfo,
  listPayments,
  registerLightningAddress,
} from "@app/self-custodial/bridge/wallet"

describe("deriveWalletIdentityPubkey", () => {
  it("derives the identity pubkey offline from the mnemonic as a hex string", () => {
    const identityPublicKey = jest
      .fn()
      .mockReturnValue({ bytes: Uint8Array.from([0x02, 0xab, 0xff]).buffer })
    ;(defaultExternalSigner as jest.Mock).mockReturnValue({ identityPublicKey })

    const pubkey = deriveWalletIdentityPubkey("youth indicate void", Network.Regtest)

    expect(pubkey).toBe("02abff")
    expect(defaultExternalSigner).toHaveBeenCalledWith(
      "youth indicate void",
      undefined,
      Network.Regtest,
      undefined,
    )
  })
})

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
  it("forwards the username and returns the address info", async () => {
    const register = jest
      .fn()
      .mockResolvedValue({ lightningAddress: "alice@staging.blink.sv" })

    const result = await registerLightningAddress(
      { registerLightningAddress: register } as never,
      "alice",
    )

    expect(register).toHaveBeenCalledWith(expect.objectContaining({ username: "alice" }))
    expect(result).toEqual({ lightningAddress: "alice@staging.blink.sv" })
  })
})
