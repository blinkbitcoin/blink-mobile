import React from "react"
import { Text } from "react-native"
import { render, renderHook } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { AccountType, ActiveWalletStatus } from "@app/types/wallet"

import {
  CustodialWalletProvider,
  useCustodialWallet,
} from "@app/custodial/providers/wallet-provider"

const mockUseIsAuthed = jest.fn()
const mockUseHomeAuthedQuery = jest.fn()

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockUseIsAuthed(),
}))

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useHomeAuthedQuery: (opts: Record<string, boolean | string>) =>
    mockUseHomeAuthedQuery(opts),
}))

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CustodialWalletProvider>{children}</CustodialWalletProvider>
)

const mockAccountData = {
  me: {
    defaultAccount: {
      wallets: [
        { id: "btc-id", walletCurrency: WalletCurrency.Btc, balance: 50000 },
        { id: "usd-id", walletCurrency: WalletCurrency.Usd, balance: 1500 },
      ],
      transactions: {
        edges: [],
      },
    },
  },
}

describe("CustodialWalletProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders children", () => {
    mockUseIsAuthed.mockReturnValue(false)
    mockUseHomeAuthedQuery.mockReturnValue({ data: null, loading: false, error: null })

    const { getByText } = render(
      <CustodialWalletProvider>
        <Text>child</Text>
      </CustodialWalletProvider>,
    )

    expect(getByText("child")).toBeTruthy()
  })

  it("returns unavailable when not authenticated", () => {
    mockUseIsAuthed.mockReturnValue(false)
    mockUseHomeAuthedQuery.mockReturnValue({ data: null, loading: false, error: null })

    const { result } = renderHook(() => useCustodialWallet(), { wrapper })

    expect(result.current.status).toBe(ActiveWalletStatus.Unavailable)
    expect(result.current.accountType).toBe(AccountType.Custodial)
    expect(result.current.wallets).toHaveLength(0)
  })

  it("returns loading when query is loading", () => {
    mockUseIsAuthed.mockReturnValue(true)
    mockUseHomeAuthedQuery.mockReturnValue({ data: null, loading: true, error: null })

    const { result } = renderHook(() => useCustodialWallet(), { wrapper })

    expect(result.current.status).toBe(ActiveWalletStatus.Loading)
    expect(result.current.wallets).toHaveLength(0)
  })

  it("returns error when query errors without data", () => {
    mockUseIsAuthed.mockReturnValue(true)
    mockUseHomeAuthedQuery.mockReturnValue({
      data: null,
      loading: false,
      error: new Error("network"),
    })

    const { result } = renderHook(() => useCustodialWallet(), { wrapper })

    expect(result.current.status).toBe(ActiveWalletStatus.Error)
    expect(result.current.wallets).toHaveLength(0)
  })

  it("returns ready with wallets when data exists", () => {
    mockUseIsAuthed.mockReturnValue(true)
    mockUseHomeAuthedQuery.mockReturnValue({
      data: mockAccountData,
      loading: false,
      error: null,
    })

    const { result } = renderHook(() => useCustodialWallet(), { wrapper })

    expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    expect(result.current.accountType).toBe(AccountType.Custodial)
    expect(result.current.wallets).toHaveLength(2)
    expect(result.current.wallets[0].walletCurrency).toBe(WalletCurrency.Btc)
    expect(result.current.wallets[0].balance.amount).toBe(50000)
    expect(result.current.wallets[1].walletCurrency).toBe(WalletCurrency.Usd)
    expect(result.current.wallets[1].balance.amount).toBe(1500)
  })

  it("returns unavailable when account is null", () => {
    mockUseIsAuthed.mockReturnValue(true)
    mockUseHomeAuthedQuery.mockReturnValue({
      data: { me: null },
      loading: false,
      error: null,
    })

    const { result } = renderHook(() => useCustodialWallet(), { wrapper })

    expect(result.current.status).toBe(ActiveWalletStatus.Unavailable)
    expect(result.current.wallets).toHaveLength(0)
  })

  it("skips query when not authenticated", () => {
    mockUseIsAuthed.mockReturnValue(false)
    mockUseHomeAuthedQuery.mockReturnValue({ data: null, loading: false, error: null })

    renderHook(() => useCustodialWallet(), { wrapper })

    expect(mockUseHomeAuthedQuery).toHaveBeenCalledWith({
      skip: true,
      fetchPolicy: "cache-and-network",
    })
  })

  it("does not skip query when authenticated", () => {
    mockUseIsAuthed.mockReturnValue(true)
    mockUseHomeAuthedQuery.mockReturnValue({ data: null, loading: true, error: null })

    renderHook(() => useCustodialWallet(), { wrapper })

    expect(mockUseHomeAuthedQuery).toHaveBeenCalledWith({
      skip: false,
      fetchPolicy: "cache-and-network",
    })
  })

  it("keeps ready status when loading with existing data", () => {
    mockUseIsAuthed.mockReturnValue(true)
    mockUseHomeAuthedQuery.mockReturnValue({
      data: mockAccountData,
      loading: true,
      error: null,
    })

    const { result } = renderHook(() => useCustodialWallet(), { wrapper })

    expect(result.current.status).toBe(ActiveWalletStatus.Ready)
    expect(result.current.wallets).toHaveLength(2)
  })
})
