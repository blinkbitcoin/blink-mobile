import { act, renderHook } from "@testing-library/react-native"

import { useDollarBalanceForcedConversion } from "@app/hooks/use-dollar-balance-forced-conversion"

describe("useDollarBalanceForcedConversion", () => {
  it("opens the convert modal when restricted and the balance is positive", () => {
    const { result } = renderHook(() =>
      useDollarBalanceForcedConversion({
        accountId: "account-a",
        isRestricted: true,
        usdWalletBalance: 5000,
      }),
    )

    expect(result.current.isConvertModalVisible).toBe(true)
  })

  it("does not open when the account is not restricted", () => {
    const { result } = renderHook(() =>
      useDollarBalanceForcedConversion({
        accountId: "account-a",
        isRestricted: false,
        usdWalletBalance: 5000,
      }),
    )

    expect(result.current.isConvertModalVisible).toBe(false)
  })

  it("does not open when the restricted account has no balance", () => {
    const { result } = renderHook(() =>
      useDollarBalanceForcedConversion({
        accountId: "account-a",
        isRestricted: true,
        usdWalletBalance: 0,
      }),
    )

    expect(result.current.isConvertModalVisible).toBe(false)
  })

  it("stays closed after the user dismisses it while still restricted", () => {
    const { result, rerender } = renderHook(
      ({ balance }: { balance: number }) =>
        useDollarBalanceForcedConversion({
          accountId: "account-a",
          isRestricted: true,
          usdWalletBalance: balance,
        }),
      { initialProps: { balance: 5000 } },
    )
    expect(result.current.isConvertModalVisible).toBe(true)

    act(() => result.current.closeConvertModal())
    expect(result.current.isConvertModalVisible).toBe(false)

    rerender({ balance: 5000 })
    expect(result.current.isConvertModalVisible).toBe(false)
  })

  it("re-opens when a positive balance arrives after being zero", () => {
    const { result, rerender } = renderHook(
      ({ balance }: { balance: number }) =>
        useDollarBalanceForcedConversion({
          accountId: "account-a",
          isRestricted: true,
          usdWalletBalance: balance,
        }),
      { initialProps: { balance: 0 } },
    )
    expect(result.current.isConvertModalVisible).toBe(false)

    rerender({ balance: 5000 })
    expect(result.current.isConvertModalVisible).toBe(true)
  })

  it("stays closed after a successful conversion zeroes the balance", () => {
    const { result, rerender } = renderHook(
      ({ balance }: { balance: number }) =>
        useDollarBalanceForcedConversion({
          accountId: "account-a",
          isRestricted: true,
          usdWalletBalance: balance,
        }),
      { initialProps: { balance: 5000 } },
    )
    expect(result.current.isConvertModalVisible).toBe(true)

    act(() => result.current.closeConvertModal())
    rerender({ balance: 0 })

    expect(result.current.isConvertModalVisible).toBe(false)
  })

  it("closes when switching to an account that is not restricted", () => {
    const { result, rerender } = renderHook(
      ({ accountId, isRestricted }: { accountId: string; isRestricted: boolean }) =>
        useDollarBalanceForcedConversion({
          accountId,
          isRestricted,
          usdWalletBalance: 5000,
        }),
      { initialProps: { accountId: "account-a", isRestricted: true } },
    )
    expect(result.current.isConvertModalVisible).toBe(true)

    rerender({ accountId: "account-b", isRestricted: false })
    expect(result.current.isConvertModalVisible).toBe(false)
  })

  it("re-opens for a new account that is itself restricted with a balance", () => {
    const { result, rerender } = renderHook(
      ({ accountId }: { accountId: string }) =>
        useDollarBalanceForcedConversion({
          accountId,
          isRestricted: true,
          usdWalletBalance: 5000,
        }),
      { initialProps: { accountId: "account-a" } },
    )
    act(() => result.current.closeConvertModal())
    expect(result.current.isConvertModalVisible).toBe(false)

    rerender({ accountId: "account-b" })
    expect(result.current.isConvertModalVisible).toBe(true)
  })
})
