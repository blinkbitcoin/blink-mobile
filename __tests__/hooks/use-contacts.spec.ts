import { renderHook } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet.types"

import { useContacts } from "@app/hooks/use-contacts"

const mockUseAccountRegistry = jest.fn()
const mockUseCustodialAdapter = jest.fn()
const mockUseSelfCustodialAdapter = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

jest.mock("@app/custodial/contact-adapter", () => ({
  useCustodialContactAdapter: () => mockUseCustodialAdapter(),
}))

jest.mock("@app/self-custodial/contact-adapter", () => ({
  useSelfCustodialContactAdapter: () => mockUseSelfCustodialAdapter(),
}))

describe("useContacts", () => {
  const custodialAdapter = { kind: "custodial-adapter" } as never
  const selfCustodialAdapter = { kind: "self-custodial-adapter" } as never

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseCustodialAdapter.mockReturnValue(custodialAdapter)
    mockUseSelfCustodialAdapter.mockReturnValue(selfCustodialAdapter)
  })

  it("returns the self-custodial adapter when active account is self-custodial", () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { type: AccountType.SelfCustodial },
    })

    const { result } = renderHook(() => useContacts())

    expect(result.current).toBe(selfCustodialAdapter)
  })

  it("returns the custodial adapter when active account is custodial", () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { type: AccountType.Custodial },
    })

    const { result } = renderHook(() => useContacts())

    expect(result.current).toBe(custodialAdapter)
  })

  it("returns the custodial adapter when no active account exists", () => {
    mockUseAccountRegistry.mockReturnValue({ activeAccount: undefined })

    const { result } = renderHook(() => useContacts())

    expect(result.current).toBe(custodialAdapter)
  })
})
