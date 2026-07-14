import { act, renderHook } from "@testing-library/react-native"

import { useDollarBalanceForcedConversion } from "@app/hooks/use-dollar-balance-forced-conversion"

type Params = Parameters<typeof useDollarBalanceForcedConversion>[0]

const baseParams: Params = {
  accountId: "account-a",
  isRestricted: true,
  usdWalletBalance: 5000,
  minimumBalance: 1,
  isFocused: true,
}

const renderTrigger = (initial: Partial<Params> = {}) =>
  renderHook(
    (overrides: Partial<Params>) =>
      useDollarBalanceForcedConversion({ ...baseParams, ...overrides }),
    { initialProps: initial },
  )

describe("useDollarBalanceForcedConversion", () => {
  it("opens the convert modal when restricted and the balance is convertible", () => {
    const { result } = renderTrigger()

    expect(result.current.isConvertModalVisible).toBe(true)
  })

  it("does not open when the account is not restricted", () => {
    const { result } = renderTrigger({ isRestricted: false })

    expect(result.current.isConvertModalVisible).toBe(false)
  })

  it("does not open when the restricted account has no balance", () => {
    const { result } = renderTrigger({ usdWalletBalance: 0 })

    expect(result.current.isConvertModalVisible).toBe(false)
  })

  it("does not open while the conversion minimum is still unknown", () => {
    const { result } = renderTrigger({ minimumBalance: null })

    expect(result.current.isConvertModalVisible).toBe(false)
  })

  it("does not open for a balance below the conversion minimum", () => {
    const { result } = renderTrigger({ minimumBalance: 300, usdWalletBalance: 200 })

    expect(result.current.isConvertModalVisible).toBe(false)
  })

  it("opens once the balance reaches the conversion minimum", () => {
    const { result, rerender } = renderTrigger({
      minimumBalance: 300,
      usdWalletBalance: 200,
    })
    expect(result.current.isConvertModalVisible).toBe(false)

    rerender({ minimumBalance: 300, usdWalletBalance: 300 })
    expect(result.current.isConvertModalVisible).toBe(true)
  })

  it("stays closed after the user dismisses it while the screen stays focused", () => {
    const { result, rerender } = renderTrigger()
    expect(result.current.isConvertModalVisible).toBe(true)

    act(() => result.current.closeConvertModal())
    expect(result.current.isConvertModalVisible).toBe(false)

    rerender({})
    expect(result.current.isConvertModalVisible).toBe(false)
  })

  it("re-opens when the screen regains focus after a dismissal", () => {
    const { result, rerender } = renderTrigger()
    act(() => result.current.closeConvertModal())
    expect(result.current.isConvertModalVisible).toBe(false)

    rerender({ isFocused: false })
    expect(result.current.isConvertModalVisible).toBe(false)

    rerender({ isFocused: true })
    expect(result.current.isConvertModalVisible).toBe(true)
  })

  it("re-opens when a convertible balance arrives after being zero", () => {
    const { result, rerender } = renderTrigger({ usdWalletBalance: 0 })
    expect(result.current.isConvertModalVisible).toBe(false)

    rerender({ usdWalletBalance: 5000 })
    expect(result.current.isConvertModalVisible).toBe(true)
  })

  it("stays closed after a successful conversion zeroes the balance", () => {
    const { result, rerender } = renderTrigger()
    expect(result.current.isConvertModalVisible).toBe(true)

    act(() => result.current.closeConvertModal())
    rerender({ usdWalletBalance: 0 })

    expect(result.current.isConvertModalVisible).toBe(false)
  })

  it("closes when switching to an account that is not restricted", () => {
    const { result, rerender } = renderTrigger()
    expect(result.current.isConvertModalVisible).toBe(true)

    rerender({ accountId: "account-b", isRestricted: false })
    expect(result.current.isConvertModalVisible).toBe(false)
  })

  it("re-opens for a new account that is itself restricted with a balance", () => {
    const { result, rerender } = renderTrigger()
    act(() => result.current.closeConvertModal())
    expect(result.current.isConvertModalVisible).toBe(false)

    rerender({ accountId: "account-b" })
    expect(result.current.isConvertModalVisible).toBe(true)
  })
})
