import {
  activateStableBalance,
  deactivateStableBalance,
} from "@app/self-custodial/bridge/stable-balance"

const mockSet = jest.fn()
const mockUnset = jest.fn()

jest.mock("@breeztech/breez-sdk-spark-react-native", () => ({
  StableBalanceActiveLabel: {
    Set: class SetClass {
      constructor(args: { label: string }) {
        mockSet(args)
      }
    },
    Unset: class UnsetClass {
      constructor() {
        mockUnset()
      }
    },
  },
}))

describe("activateStableBalance", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("calls updateUserSettings with StableBalanceActiveLabel.Set", async () => {
    const updateUserSettings = jest.fn().mockResolvedValue(undefined)

    await activateStableBalance({ updateUserSettings } as never, "USDB")

    expect(mockSet).toHaveBeenCalledWith({ label: "USDB" })
    expect(updateUserSettings).toHaveBeenCalledTimes(1)
    const arg = updateUserSettings.mock.calls[0][0]
    expect(arg.sparkPrivateModeEnabled).toBeUndefined()
    expect(arg.stableBalanceActiveLabel).toBeInstanceOf(Object)
  })

  it("propagates errors from the SDK", async () => {
    const updateUserSettings = jest.fn().mockRejectedValue(new Error("sdk unavailable"))

    await expect(
      activateStableBalance({ updateUserSettings } as never, "USDB"),
    ).rejects.toThrow("sdk unavailable")
  })
})

describe("deactivateStableBalance", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("calls updateUserSettings with StableBalanceActiveLabel.Unset", async () => {
    const updateUserSettings = jest.fn().mockResolvedValue(undefined)

    await deactivateStableBalance({ updateUserSettings } as never)

    expect(mockUnset).toHaveBeenCalledTimes(1)
    expect(updateUserSettings).toHaveBeenCalledTimes(1)
  })

  it("propagates errors from the SDK", async () => {
    const updateUserSettings = jest.fn().mockRejectedValue(new Error("boom"))

    await expect(
      deactivateStableBalance({ updateUserSettings } as never),
    ).rejects.toThrow("boom")
  })
})
