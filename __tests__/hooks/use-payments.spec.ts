import { renderHook } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet"

import { usePayments } from "@app/hooks/use-payments"

const mockActiveAccount = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: mockActiveAccount(),
  }),
}))

const mockSdk = {}
const mockSelfCustodialWallet = jest.fn()

jest.mock("@app/self-custodial/providers/wallet", () => ({
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
  createGetConversionQuote: jest.fn().mockReturnValue(jest.fn()),
}))

jest.mock("@app/custodial/adapters/payment", () => ({
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

  it("returns no adapters while a self-custodial account is loading its SDK (regression)", () => {
    mockActiveAccount.mockReturnValue({
      id: "self-custodial-default",
      type: AccountType.SelfCustodial,
    })
    mockSelfCustodialWallet.mockReturnValue({ sdk: undefined })

    const { result } = renderHook(() => usePayments())

    expect(result.current.accountType).toBe(AccountType.SelfCustodial)
    expect(result.current.sendPayment).toBeUndefined()
    expect(result.current.getFee).toBeUndefined()
    expect(result.current.receiveLightning).toBeUndefined()
    expect(result.current.receiveOnchain).toBeUndefined()
    expect(result.current.listPendingDeposits).toBeUndefined()
    expect(result.current.claimDeposit).toBeUndefined()
    expect(result.current.convert).toBeUndefined()
  })

  it("returns no adapters and undefined accountType while activeAccount is missing (loading window)", () => {
    mockActiveAccount.mockReturnValue(undefined)
    mockSelfCustodialWallet.mockReturnValue({ sdk: undefined })

    const { result } = renderHook(() => usePayments())

    expect(result.current.accountType).toBeUndefined()
    expect(result.current.sendPayment).toBeUndefined()
    expect(result.current.listPendingDeposits).toBeUndefined()
    expect(result.current.claimDeposit).toBeUndefined()
    expect(result.current.convert).toBeUndefined()
  })

  it("exposes getConversionQuote only on the self-custodial path with an SDK", () => {
    mockActiveAccount.mockReturnValue({
      id: "self-custodial-default",
      type: AccountType.SelfCustodial,
    })
    mockSelfCustodialWallet.mockReturnValue({ sdk: mockSdk })

    const { result } = renderHook(() => usePayments())

    expect(result.current.getConversionQuote).toBeDefined()
  })

  it("does not expose getConversionQuote on the custodial path", () => {
    mockActiveAccount.mockReturnValue({ id: "custodial-default", type: "custodial" })
    mockSelfCustodialWallet.mockReturnValue({ sdk: undefined })

    const { result } = renderHook(() => usePayments())

    expect(result.current.getConversionQuote).toBeUndefined()
  })

  it("does not expose getConversionQuote for a self-custodial account missing its SDK", () => {
    mockActiveAccount.mockReturnValue({
      id: "self-custodial-default",
      type: AccountType.SelfCustodial,
    })
    mockSelfCustodialWallet.mockReturnValue({ sdk: undefined })

    const { result } = renderHook(() => usePayments())

    expect(result.current.getConversionQuote).toBeUndefined()
  })
})
