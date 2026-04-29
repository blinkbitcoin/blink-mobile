import React from "react"
import { fireEvent, render } from "@testing-library/react-native"

import { AccountStatus, AccountType } from "@app/types/wallet.types"

import { SelfCustodialProfileRow } from "@app/screens/settings-screen/account/multi-account/self-custodial-profile-row"

const TEST_ENTRY_ID = "test-account-id"

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = {
    grey2: "#999",
    grey3: "#bbb",
    grey4: "#ddd",
    grey5: "#f5f5f5",
    white: "#fff",
    black: "#000",
    primary: "#007",
    _green: "#0f0",
  }
  return {
    makeStyles:
      (
        fn: (
          theme: { colors: Record<string, string> },
          params: Record<string, string | undefined>,
        ) => Record<string, object>,
      ) =>
      (params: Record<string, string | undefined> = {}) =>
        fn({ colors }, params),
    Text: ({ children, ...props }: { children: React.ReactNode }) =>
      React.createElement("Text", props, children),
    useTheme: () => ({ theme: { colors } }),
    ListItem: Object.assign(
      ({ children, ...props }: { children: React.ReactNode }) =>
        React.createElement("ListItem", props, children),
      {
        Content: ({ children }: { children: React.ReactNode }) =>
          React.createElement("ListItemContent", null, children),
        Title: ({ children, ...props }: { children: React.ReactNode }) =>
          React.createElement("Text", props, children),
      },
    ),
    Overlay: ({
      children,
      isVisible,
    }: {
      children: React.ReactNode
      isVisible: boolean
    }) =>
      isVisible
        ? React.createElement("Overlay", { testID: "delete-overlay" }, children)
        : null,
  }
})

const lastConfirmModalProps: {
  isVisible?: boolean
  onClose?: () => void
  onConfirm?: () => void | Promise<void>
} = {}
jest.mock(
  "@app/screens/settings-screen/self-custodial/delete-account-confirm-modal",
  () => {
    const ReactActual = jest.requireActual("react")
    return {
      DeleteAccountConfirmModal: (props: {
        isVisible: boolean
        onClose: () => void
        onConfirm: () => void | Promise<void>
      }) => {
        lastConfirmModalProps.isVisible = props.isVisible
        lastConfirmModalProps.onClose = props.onClose
        lastConfirmModalProps.onConfirm = props.onConfirm
        return props.isVisible
          ? ReactActual.createElement("View", { testID: "delete-modal" })
          : null
      },
    }
  },
)

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

jest.mock("@app/components/atomic/galoy-icon-button/galoy-icon-button", () => {
  const ReactActual = jest.requireActual("react")
  const { TouchableOpacity } = jest.requireActual("react-native")
  return {
    GaloyIconButton: ({
      onPress,
      ...props
    }: {
      onPress?: () => void
      [key: string]: unknown
    }) => ReactActual.createElement(TouchableOpacity, { onPress, ...props }),
  }
})

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

const mockUseAccountRegistry = jest.fn()
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

const mockUseSelfCustodialWallet = jest.fn()
jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

const mockDeleteWallet = jest.fn().mockResolvedValue(undefined)
const mockUseDeleteSelfCustodial = jest.fn()
jest.mock(
  "@app/screens/settings-screen/account/multi-account/hooks/use-delete-self-custodial",
  () => ({
    useDeleteSelfCustodial: () => mockUseDeleteSelfCustodial(),
  }),
)

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountTypeSelectionScreen: {
        selfCustodialLabel: () => "Non-custodial",
      },
      ProfileScreen: {
        switchAccount: () => "Switched accounts",
      },
      AccountScreen: {
        pleaseWait: () => "Please wait",
      },
      common: {
        anonymousUser: () => "Anonymous user",
      },
    },
  }),
}))

const setActiveAccountId = jest.fn()

describe("SelfCustodialProfileRow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    lastConfirmModalProps.isVisible = undefined
    mockUseSelfCustodialWallet.mockReturnValue({ lightningAddress: null })
    mockUseDeleteSelfCustodial.mockReturnValue({
      state: "idle",
      deleteWallet: mockDeleteWallet,
    })
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: {
        id: "current-custodial-id",
        type: AccountType.Custodial,
        label: "Blink",
        selected: true,
        status: AccountStatus.Available,
      },
      setActiveAccountId,
    })
  })

  it("renders the lightning address as the row title when one is set", () => {
    const { getByText } = render(
      <SelfCustodialProfileRow
        entry={{ id: TEST_ENTRY_ID, lightningAddress: "alice@example.com" }}
      />,
    )

    expect(getByText("alice@example.com")).toBeTruthy()
  })

  it("falls back to anonymous user label when no lightning address is set", () => {
    const { getByText } = render(
      <SelfCustodialProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )

    expect(getByText("Anonymous user")).toBeTruthy()
  })

  it("switches to the entry's account id when the row is pressed", () => {
    const { getByTestId } = render(
      <SelfCustodialProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )

    fireEvent.press(getByTestId(`self-custodial-profile-row-${TEST_ENTRY_ID}`))

    expect(setActiveAccountId).toHaveBeenCalledWith(TEST_ENTRY_ID)
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({ type: "success", message: "Switched accounts" }),
    )
    expect(mockNavigate).toHaveBeenCalledWith("Primary")
  })

  it("does not switch when the entry is the active self-custodial account", () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: {
        id: TEST_ENTRY_ID,
        type: AccountType.SelfCustodial,
        label: "Spark",
        selected: true,
        status: AccountStatus.RequiresRestore,
      },
      setActiveAccountId,
    })

    const { getByTestId } = render(
      <SelfCustodialProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )

    fireEvent.press(getByTestId(`self-custodial-profile-row-${TEST_ENTRY_ID}`))

    expect(setActiveAccountId).not.toHaveBeenCalled()
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("opens the confirm-removal modal when the close icon is pressed", () => {
    const { getByTestId, queryByTestId } = render(
      <SelfCustodialProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )

    expect(queryByTestId("delete-modal")).toBeNull()

    fireEvent.press(getByTestId(`self-custodial-delete-button-${TEST_ENTRY_ID}`))

    expect(getByTestId("delete-modal")).toBeTruthy()
    expect(mockDeleteWallet).not.toHaveBeenCalled()
  })

  it("calls deleteWallet with the entry id and closes the modal when the user confirms", async () => {
    const entry = { id: TEST_ENTRY_ID, lightningAddress: null }
    const { getByTestId, queryByTestId, rerender } = render(
      <SelfCustodialProfileRow entry={entry} />,
    )
    fireEvent.press(getByTestId(`self-custodial-delete-button-${TEST_ENTRY_ID}`))

    await lastConfirmModalProps.onConfirm?.()
    rerender(<SelfCustodialProfileRow entry={entry} />)

    expect(mockDeleteWallet).toHaveBeenCalledTimes(1)
    expect(mockDeleteWallet).toHaveBeenCalledWith(TEST_ENTRY_ID)
    expect(queryByTestId("delete-modal")).toBeNull()
  })

  it("does not gate the confirm modal by wallet balance (logout path)", () => {
    mockUseSelfCustodialWallet.mockReturnValue({
      lightningAddress: null,
      wallets: [
        {
          id: "btc-1",
          walletCurrency: "BTC",
          balance: { amount: 9999, currency: "BTC", currencyCode: "BTC" },
          transactions: [],
        },
      ],
    })

    const { getByTestId } = render(
      <SelfCustodialProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )
    fireEvent.press(getByTestId(`self-custodial-delete-button-${TEST_ENTRY_ID}`))

    expect(getByTestId("delete-modal")).toBeTruthy()
  })

  it("renders the deleting overlay when the delete hook is in deleting state", () => {
    mockUseDeleteSelfCustodial.mockReturnValue({
      state: "deleting",
      deleteWallet: mockDeleteWallet,
    })

    const { getByTestId } = render(
      <SelfCustodialProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )

    expect(getByTestId("delete-overlay")).toBeTruthy()
  })

  it("prefers the live lightning address from the SDK when the row is active", () => {
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: {
        id: TEST_ENTRY_ID,
        type: AccountType.SelfCustodial,
        label: "Spark",
        selected: true,
        status: AccountStatus.RequiresRestore,
      },
      setActiveAccountId,
    })
    mockUseSelfCustodialWallet.mockReturnValue({
      lightningAddress: "magentamouse1845@breez.tips",
    })

    const { getByText } = render(
      <SelfCustodialProfileRow
        entry={{ id: TEST_ENTRY_ID, lightningAddress: "stale@example.com" }}
      />,
    )

    expect(getByText("magentamouse1845@breez.tips")).toBeTruthy()
  })

  it("ignores the live lightning address for inactive rows and uses the persisted entry value", () => {
    mockUseSelfCustodialWallet.mockReturnValue({
      lightningAddress: "magentamouse1845@breez.tips",
    })

    const { getByText } = render(
      <SelfCustodialProfileRow
        entry={{ id: TEST_ENTRY_ID, lightningAddress: "stored@example.com" }}
      />,
    )

    expect(getByText("stored@example.com")).toBeTruthy()
  })
})
