import { renderHook } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet.types"

import { usePayments } from "@app/hooks/use-payments"

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: { id: "custodial-default", type: "custodial" },
  }),
}))

jest.mock("@app/custodial/adapters/payment-adapter", () => ({
  createCustodialListPendingDeposits: jest.fn().mockResolvedValue({ deposits: [] }),
  createCustodialClaimDeposit: {
    getClaimFee: jest.fn(),
    claimDeposit: jest.fn(),
  },
  createCustodialConvert: jest.fn().mockResolvedValue({ status: "failed", errors: [] }),
}))

describe("usePayments", () => {
  it("returns accountType as custodial by default", () => {
    const { result } = renderHook(() => usePayments())

    expect(result.current.accountType).toBe(AccountType.Custodial)
  })

  it("returns listPendingDeposits adapter", () => {
    const { result } = renderHook(() => usePayments())

    expect(result.current.listPendingDeposits).toBeDefined()
  })

  it("returns claimDeposit adapter", () => {
    const { result } = renderHook(() => usePayments())

    expect(result.current.claimDeposit).toBeDefined()
    expect(result.current.claimDeposit!.getClaimFee).toBeDefined()
    expect(result.current.claimDeposit!.claimDeposit).toBeDefined()
  })

  it("returns convert adapter", () => {
    const { result } = renderHook(() => usePayments())

    expect(result.current.convert).toBeDefined()
  })

  it("returns sendPayment as undefined (not wired yet)", () => {
    const { result } = renderHook(() => usePayments())

    expect(result.current.sendPayment).toBeUndefined()
  })

  it("returns getFee as undefined (not wired yet)", () => {
    const { result } = renderHook(() => usePayments())

    expect(result.current.getFee).toBeUndefined()
  })

  it("returns receiveLightning as undefined (not wired yet)", () => {
    const { result } = renderHook(() => usePayments())

    expect(result.current.receiveLightning).toBeUndefined()
  })

  it("returns receiveOnchain as undefined (not wired yet)", () => {
    const { result } = renderHook(() => usePayments())

    expect(result.current.receiveOnchain).toBeUndefined()
  })
})
