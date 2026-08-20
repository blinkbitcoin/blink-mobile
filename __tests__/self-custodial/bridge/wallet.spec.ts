import { Network, defaultExternalSigners } from "@breeztech/breez-sdk-spark-react-native"

import {
  checkLightningAddressAvailable,
  deriveWalletIdentityPubkey,
  getUserSettings,
  getWalletInfo,
  listAllPayments,
  listPayments,
  registerLightningAddress,
} from "@app/self-custodial/bridge/wallet"

const mockReportError = jest.fn()

jest.mock("@app/utils/error-logging", () => ({
  reportError: (...args: unknown[]) => mockReportError(...args),
}))

describe("deriveWalletIdentityPubkey", () => {
  const mockSigners = (getIdentityPublicKey: jest.Mock) => {
    const breezDestroy = jest.fn()
    const sparkDestroy = jest.fn()
    ;(defaultExternalSigners as jest.Mock).mockReturnValue({
      breezSigner: { uniffiDestroy: breezDestroy },
      sparkSigner: { getIdentityPublicKey, uniffiDestroy: sparkDestroy },
    })
    return { breezDestroy, sparkDestroy }
  }

  it("derives the identity pubkey offline from the mnemonic and frees both signers", async () => {
    const { breezDestroy, sparkDestroy } = mockSigners(
      jest.fn().mockResolvedValue({ bytes: Uint8Array.from([0x02, 0xab, 0xff]).buffer }),
    )

    const pubkey = await deriveWalletIdentityPubkey(
      "youth indicate void",
      Network.Regtest,
    )

    expect(pubkey).toBe("02abff")
    expect(defaultExternalSigners).toHaveBeenCalledWith(
      "youth indicate void",
      undefined,
      Network.Regtest,
      undefined,
    )
    expect(breezDestroy).toHaveBeenCalledTimes(1)
    expect(sparkDestroy).toHaveBeenCalledTimes(1)
  })

  it("frees both signers even when reading the pubkey rejects, and propagates the error", async () => {
    const { breezDestroy, sparkDestroy } = mockSigners(
      jest.fn().mockRejectedValue(new Error("read failed")),
    )

    await expect(deriveWalletIdentityPubkey("m", Network.Regtest)).rejects.toThrow(
      "read failed",
    )
    expect(breezDestroy).toHaveBeenCalledTimes(1)
    expect(sparkDestroy).toHaveBeenCalledTimes(1)
  })

  it("still frees the second signer and returns the pubkey when the first destroy throws", async () => {
    const { breezDestroy, sparkDestroy } = mockSigners(
      jest.fn().mockResolvedValue({ bytes: Uint8Array.from([0x02, 0xab, 0xff]).buffer }),
    )
    breezDestroy.mockImplementation(() => {
      throw new Error("already freed")
    })

    await expect(deriveWalletIdentityPubkey("m", Network.Regtest)).resolves.toBe("02abff")
    expect(sparkDestroy).toHaveBeenCalledTimes(1)
  })

  /** A binding that no longer carries the lifecycle method throws the same way an
   *  already-freed signer does, and that case leaves key material resident: swallowing it
   *  would hide the one failure this call exists to prevent. */
  it("reports a destroy failure instead of swallowing it", async () => {
    const { breezDestroy } = mockSigners(
      jest.fn().mockResolvedValue({ bytes: Uint8Array.from([0x02, 0xab, 0xff]).buffer }),
    )
    const destroyError = new Error("uniffiDestroy is not a function")
    breezDestroy.mockImplementation(() => {
      throw destroyError
    })

    await deriveWalletIdentityPubkey("m", Network.Regtest)

    expect(mockReportError).toHaveBeenCalledWith("destroySigner", destroyError)
  })

  it("does not let a throwing destroy mask the original rejection", async () => {
    const { breezDestroy, sparkDestroy } = mockSigners(
      jest.fn().mockRejectedValue(new Error("read failed")),
    )
    breezDestroy.mockImplementation(() => {
      throw new Error("already freed")
    })

    await expect(deriveWalletIdentityPubkey("m", Network.Regtest)).rejects.toThrow(
      "read failed",
    )
    expect(sparkDestroy).toHaveBeenCalledTimes(1)
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

describe("listAllPayments", () => {
  const payment = (id: string) => ({ id })

  it("returns a single short page as-is", async () => {
    const listPaymentsFn = jest
      .fn()
      .mockResolvedValue({ payments: [payment("a"), payment("b")] })

    const all = await listAllPayments({ listPayments: listPaymentsFn } as never, 3)

    expect(all.map((p) => p.id)).toEqual(["a", "b"])
    expect(listPaymentsFn).toHaveBeenCalledTimes(1)
    expect(listPaymentsFn).toHaveBeenCalledWith(
      expect.objectContaining({ offset: 0, limit: 3, sortAscending: false }),
    )
  })

  it("pages with increasing offsets until a short page", async () => {
    const listPaymentsFn = jest
      .fn()
      .mockResolvedValueOnce({ payments: [payment("a"), payment("b")] })
      .mockResolvedValueOnce({ payments: [payment("c"), payment("d")] })
      .mockResolvedValueOnce({ payments: [payment("e")] })

    const all = await listAllPayments({ listPayments: listPaymentsFn } as never, 2)

    expect(all.map((p) => p.id)).toEqual(["a", "b", "c", "d", "e"])
    expect(listPaymentsFn).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ offset: 2, limit: 2 }),
    )
    expect(listPaymentsFn).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ offset: 4, limit: 2 }),
    )
  })

  it("drops a payment repeated across a page boundary by a mid-export write", async () => {
    const listPaymentsFn = jest
      .fn()
      .mockResolvedValueOnce({ payments: [payment("a"), payment("b")] })
      .mockResolvedValueOnce({ payments: [payment("b"), payment("c")] })
      .mockResolvedValueOnce({ payments: [] })

    const all = await listAllPayments({ listPayments: listPaymentsFn } as never, 2)

    expect(all.map((p) => p.id)).toEqual(["a", "b", "c"])
  })

  it("throws instead of looping forever when the SDK keeps returning full pages", async () => {
    let counter = 0
    const listPaymentsFn = jest.fn().mockImplementation(() => {
      counter += 1
      return Promise.resolve({ payments: [payment(`p${counter}`)] })
    })

    await expect(
      listAllPayments({ listPayments: listPaymentsFn } as never, 1),
    ).rejects.toThrow(/pages/)
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
