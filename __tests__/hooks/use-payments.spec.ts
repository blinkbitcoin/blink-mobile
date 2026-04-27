import { renderHook } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet.types"

import { usePayments } from "@app/hooks/use-payments"

const mockActiveAccount = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: mockActiveAccount(),
  }),
}))

const mockSdk = {}
const mockSelfCustodialWallet = jest.fn()

jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => mockSelfCustodialWallet(),
}))

jest.mock("@app/self-custodial/bridge", () => ({
  createSendPayment: jest.fn().mockReturnValue(jest.fn()),
  createGetFee: jest.fn().mockReturnValue(jest.fn()),
  createReceiveLightning: jest.fn().mockReturnValue(jest.fn()),
  createReceiveOnchain: jest.fn().mockReturnValue(jest.fn()),
  createListPendingDeposits: jest.fn().mockReturnValue(jest.fn()),
  createClaimDeposit: jest.fn().mockReturnValue({
    getClaimFee: jest.fn(),
    claimDeposit: jest.fn(),
  }),
  createConvert: jest.fn().mockReturnValue(jest.fn()),
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
  beforeEach(() => {
    mockActiveAccount.mockReturnValue({ id: "custodial-default", type: "custodial" })
    mockSelfCustodialWallet.mockReturnValue({ sdk: undefined })
  })

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

  it("returns self-custodial adapters when self-custodial account with SDK", () => {
    mockActiveAccount.mockReturnValue({
      id: "self-custodial-default",
      type: AccountType.SelfCustodial,
    })
    mockSelfCustodialWallet.mockReturnValue({ sdk: mockSdk })

    const { result } = renderHook(() => usePayments())

    expect(result.current.accountType).toBe(AccountType.SelfCustodial)
    expect(result.current.sendPayment).toBeDefined()
    expect(result.current.getFee).toBeDefined()
    expect(result.current.receiveLightning).toBeDefined()
    expect(result.current.receiveOnchain).toBeDefined()
  })

  it("falls back to custodial adapters when self-custodial account without SDK", () => {
    mockActiveAccount.mockReturnValue({
      id: "self-custodial-default",
      type: AccountType.SelfCustodial,
    })
    mockSelfCustodialWallet.mockReturnValue({ sdk: undefined })

    const { result } = renderHook(() => usePayments())

    expect(result.current.accountType).toBe(AccountType.SelfCustodial)
    expect(result.current.sendPayment).toBeUndefined()
  })
})
