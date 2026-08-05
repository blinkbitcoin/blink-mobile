import React from "react"

import { render } from "@testing-library/react-native"

import { WalletCurrency } from "@app/graphql/generated"
import { DefaultWallet } from "@app/screens/settings-screen/settings/account-default-wallet"
import { SettingsRow } from "@app/screens/settings-screen/row"
import { AccountType } from "@app/types/wallet"

const mockIsRestricted = jest.fn()
const mockIsRegionPending = jest.fn()
const mockSettingsQuery = jest.fn()
const mockActiveAccount = jest.fn()

jest.mock("@app/screens/settings-screen/row", () => ({
  SettingsRow: jest.fn(() => null),
}))

jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceGate: () => ({
    isGated: mockIsRestricted(),
    isRegionPending: mockIsRegionPending(),
  }),
}))

jest.mock("@app/graphql/generated", () => ({
  WalletCurrency: { Btc: "BTC", Usd: "USD" },
  useSettingsScreenQuery: () => mockSettingsQuery(),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => true,
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount() }),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({ persistentState: {} }),
}))

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: jest.fn() }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: { bitcoin: () => "Bitcoin", dollar: () => "Dollar" },
      DefaultWalletScreen: {
        title: () => "Default wallet",
        titleSelfCustodial: () => "Default asset",
      },
    },
  }),
}))

const rowMock = SettingsRow as unknown as jest.Mock

const readRowLoading = (): boolean => rowMock.mock.calls[0][0].loading

describe("DefaultWallet", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsRestricted.mockReturnValue(false)
    mockIsRegionPending.mockReturnValue(false)
    mockActiveAccount.mockReturnValue({ type: AccountType.Custodial })
    mockSettingsQuery.mockReturnValue({
      data: {
        me: {
          defaultAccount: {
            defaultWalletId: "btc-id",
            wallets: [{ id: "btc-id", walletCurrency: WalletCurrency.Btc }],
          },
        },
      },
      loading: false,
    })
  })

  it("holds the row on its loader while the region is pending", () => {
    mockIsRegionPending.mockReturnValue(true)

    render(<DefaultWallet />)

    expect(readRowLoading()).toBe(true)
  })

  it("renders the settled row once the region resolves unrestricted", () => {
    render(<DefaultWallet />)

    expect(readRowLoading()).toBe(false)
  })

  it("renders nothing once the region resolves restricted", () => {
    mockIsRestricted.mockReturnValue(true)

    render(<DefaultWallet />)

    expect(rowMock).not.toHaveBeenCalled()
  })

  it("holds a self-custodial row on the pending region too", () => {
    mockActiveAccount.mockReturnValue({ type: AccountType.SelfCustodial })
    mockIsRegionPending.mockReturnValue(true)

    render(<DefaultWallet />)

    expect(readRowLoading()).toBe(true)
  })
})
