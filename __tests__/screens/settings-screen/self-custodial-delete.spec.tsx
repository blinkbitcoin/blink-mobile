import React from "react"

import { fireEvent, render } from "@testing-library/react-native"

import { SelfCustodialDelete } from "@app/screens/settings-screen/account/settings/self-custodial-delete"

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = {
    grey5: "#f5f5f5",
    primary: "#fc5805",
    black: "#000",
    white: "#fff",
    warning: "#F59E0B",
  }
  return {
    makeStyles:
      (
        fn: (
          theme: { colors: Record<string, string> },
          params: Record<string, unknown>,
        ) => Record<string, object>,
      ) =>
      (params: Record<string, unknown> = {}) =>
        fn({ colors }, params),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    Overlay: ({
      isVisible,
      children,
    }: {
      isVisible: boolean
      children: React.ReactNode
    }) =>
      isVisible
        ? React.createElement("View", { testID: "deleting-overlay" }, children)
        : null,
    useTheme: () => ({ theme: { colors, mode: "light" } }),
  }
})

jest.mock("@app/components/card-screen", () => ({
  InfoCard: ({ title }: { title: string }) =>
    React.createElement("Text", { testID: "info-card" }, title),
}))

jest.mock("@app/screens/settings-screen/button", () => ({
  SettingsButton: ({ onPress, title }: { onPress: () => void; title: string }) =>
    React.createElement(
      "Pressable",
      { onPress, testID: "danger-zone-delete-button" },
      React.createElement("Text", {}, title),
    ),
}))

const lastWarningProps: { isVisible?: boolean; onClose?: () => void } = {}
jest.mock(
  "@app/screens/settings-screen/self-custodial/delete-account-has-funds-modal",
  () => ({
    DeleteAccountHasFundsModal: (props: { isVisible: boolean; onClose: () => void }) => {
      lastWarningProps.isVisible = props.isVisible
      lastWarningProps.onClose = props.onClose
      return props.isVisible
        ? React.createElement("View", { testID: "warning-modal" })
        : null
    },
  }),
)

const lastConfirmProps: {
  isVisible?: boolean
  onClose?: () => void
  onConfirm?: () => void | Promise<void>
} = {}
jest.mock(
  "@app/screens/settings-screen/self-custodial/delete-account-confirm-modal",
  () => ({
    DeleteAccountConfirmModal: (props: {
      isVisible: boolean
      onClose: () => void
      onConfirm: () => void | Promise<void>
    }) => {
      lastConfirmProps.isVisible = props.isVisible
      lastConfirmProps.onClose = props.onClose
      lastConfirmProps.onConfirm = props.onConfirm
      return props.isVisible
        ? React.createElement("View", { testID: "confirm-modal" })
        : null
    },
  }),
)

const mockDeleteWallet = jest.fn().mockResolvedValue(undefined)
jest.mock(
  "@app/screens/settings-screen/account/multi-account/hooks/use-delete-self-custodial",
  () => ({
    useDeleteSelfCustodial: () => ({
      state: "idle",
      error: null,
      deleteWallet: mockDeleteWallet,
    }),
  }),
)

const mockUseSelfCustodialWallet = jest.fn()
jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountScreen: { pleaseWait: () => "Please wait" },
      SelfCustodialDelete: {
        dangerZoneImportantTitle: () => "Important",
        dangerZoneBulletReinstated: () => "Deleted account cannot be reinstated",
        dangerZoneBulletPermanent: () => "Account deletion is permanent",
        dangerZoneBulletEmpty: () => "Make sure account is empty",
        dangerZoneDeleteButton: () => "Delete account and data",
      },
    },
  }),
}))

const emptyWallet = (id: string, currency: "BTC" | "USD") => ({
  id,
  walletCurrency: currency,
  balance: { amount: 0, currency, currencyCode: currency },
  transactions: [],
})

const fundedWallet = (id: string, currency: "BTC" | "USD", amount: number) => ({
  id,
  walletCurrency: currency,
  balance: { amount, currency, currencyCode: currency },
  transactions: [],
})

describe("SelfCustodialDelete", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    lastWarningProps.isVisible = undefined
    lastConfirmProps.isVisible = undefined
  })

  it("opens the confirm modal when both wallets are empty", () => {
    mockUseSelfCustodialWallet.mockReturnValue({
      wallets: [emptyWallet("btc", "BTC"), emptyWallet("usd", "USD")],
    })

    const { getByTestId, queryByTestId } = render(<SelfCustodialDelete />)
    fireEvent.press(getByTestId("danger-zone-delete-button"))

    expect(getByTestId("confirm-modal")).toBeTruthy()
    expect(queryByTestId("warning-modal")).toBeNull()
  })

  it("opens the warning modal (not confirm) when the BTC wallet has a balance", () => {
    mockUseSelfCustodialWallet.mockReturnValue({
      wallets: [fundedWallet("btc", "BTC", 21000), emptyWallet("usd", "USD")],
    })

    const { getByTestId, queryByTestId } = render(<SelfCustodialDelete />)
    fireEvent.press(getByTestId("danger-zone-delete-button"))

    expect(getByTestId("warning-modal")).toBeTruthy()
    expect(queryByTestId("confirm-modal")).toBeNull()
    expect(mockDeleteWallet).not.toHaveBeenCalled()
  })

  it("opens the warning modal when only the USD wallet has a balance", () => {
    mockUseSelfCustodialWallet.mockReturnValue({
      wallets: [emptyWallet("btc", "BTC"), fundedWallet("usd", "USD", 500)],
    })

    const { getByTestId, queryByTestId } = render(<SelfCustodialDelete />)
    fireEvent.press(getByTestId("danger-zone-delete-button"))

    expect(getByTestId("warning-modal")).toBeTruthy()
    expect(queryByTestId("confirm-modal")).toBeNull()
  })

  it("warning onClose hides the warning without calling deleteWallet", () => {
    mockUseSelfCustodialWallet.mockReturnValue({
      wallets: [fundedWallet("btc", "BTC", 1), emptyWallet("usd", "USD")],
    })

    const { getByTestId, queryByTestId, rerender } = render(<SelfCustodialDelete />)
    fireEvent.press(getByTestId("danger-zone-delete-button"))
    expect(getByTestId("warning-modal")).toBeTruthy()

    lastWarningProps.onClose?.()
    rerender(<SelfCustodialDelete />)

    expect(queryByTestId("warning-modal")).toBeNull()
    expect(mockDeleteWallet).not.toHaveBeenCalled()
  })

  it("confirm onConfirm calls deleteWallet and closes the modal", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({
      wallets: [emptyWallet("btc", "BTC"), emptyWallet("usd", "USD")],
    })

    const { getByTestId, queryByTestId, rerender } = render(<SelfCustodialDelete />)
    fireEvent.press(getByTestId("danger-zone-delete-button"))

    await lastConfirmProps.onConfirm?.()
    rerender(<SelfCustodialDelete />)

    expect(mockDeleteWallet).toHaveBeenCalledTimes(1)
    expect(queryByTestId("confirm-modal")).toBeNull()
  })
})
