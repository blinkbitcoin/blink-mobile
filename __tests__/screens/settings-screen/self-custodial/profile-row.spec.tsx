import React from "react"
import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
import { act, fireEvent, render } from "@testing-library/react-native"
import { it } from "@jest/globals"

import { AccountStatus, AccountType } from "@app/types/wallet"

import { ProfileRow } from "@app/screens/settings-screen/self-custodial/profile-row"

import { flushEffects } from "../../../helpers/flush-effects"

const TEST_ENTRY_ID = "test-account-id"

let mockNetwork = mockSparkNetwork.Regtest

const mockRouteAfterLogout = jest.fn()

/** The shared logout route reaches the lock context, which pulls in native boot code this
 *  screen never touches; only the way out it hands back is stood in for. */
jest.mock("@app/hooks/use-logout-and-route", () => ({
  useLogoutAndRoute: () => ({ routeAfterLogout: mockRouteAfterLogout }),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockNetwork,
}))

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = {
    textMuted: "#999",
    textDisabled: "#bbb",
    border: "#ddd",
    surfaceInteractive: "#f5f5f5",
    backgroundDefault: "#fff",
    textOnBackground: "#000",
    accent: "#007",
    staticSuccess: "#0f0",
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

const lastWarningModalProps: {
  isVisible?: boolean
  onClose?: () => void
  wallets?: ReadonlyArray<{ balance: { amount: number } }>
} = {}
jest.mock(
  "@app/screens/settings-screen/self-custodial/delete-account-has-funds-modal",
  () => {
    const ReactActual = jest.requireActual("react")
    return {
      DeleteAccountHasFundsModal: (props: {
        isVisible: boolean
        onClose: () => void
        wallets: ReadonlyArray<{ balance: { amount: number } }>
      }) => {
        lastWarningModalProps.isVisible = props.isVisible
        lastWarningModalProps.onClose = props.onClose
        lastWarningModalProps.wallets = props.wallets
        return props.isVisible
          ? ReactActual.createElement("View", { testID: "warning-modal" })
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
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

const mockFormatMoneyAmount = jest.fn(
  ({ moneyAmount }: { moneyAmount: { amount: number; currencyCode: string } }) =>
    `${moneyAmount.currencyCode} ${moneyAmount.amount}`,
)
jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ formatMoneyAmount: mockFormatMoneyAmount }),
}))

const mockProbeWallets = jest.fn()
jest.mock("@app/self-custodial/probe-account-wallets", () => ({
  probeSelfCustodialAccountWallets: (...args: unknown[]) => mockProbeWallets(...args),
  ProbeAccountWalletsStatus: {
    Ok: "ok",
    NoMnemonic: "no-mnemonic",
    ProbeFailed: "probe-failed",
  },
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useRemoteConfig: () => ({ selfCustodialDepositClaimLeewayVbyte: 5 }),
}))

jest.mock("@app/utils/error-logging", () => ({
  reportError: jest.fn(),
}))

const mockDeleteWallet = jest.fn().mockResolvedValue(undefined)
const mockUseDeleteAccount = jest.fn()
jest.mock("@app/self-custodial/hooks/use-delete-account", () => ({
  useDeleteAccount: () => mockUseDeleteAccount(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AccountTypeSelectionScreen: {
        selfCustodialLabel: () => "Non-custodial",
      },
      ProfileScreen: {
        switchAccount: () => "Switched accounts",
        removeAccount: () => "Remove account",
      },
      AccountScreen: {
        pleaseWait: () => "Please wait",
        probeBalanceFailed: () => "Couldn't verify the wallet's balance.",
      },
      common: {
        anonymousUser: () => "Anon user",
      },
    },
  }),
}))

const setActiveAccountId = jest.fn()

describe("ProfileRow", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockNetwork = mockSparkNetwork.Mainnet
    lastConfirmModalProps.isVisible = undefined
    lastWarningModalProps.isVisible = undefined
    mockUseSelfCustodialWallet.mockReturnValue({ lightningAddress: null, wallets: [] })
    mockProbeWallets.mockResolvedValue({ status: "ok", wallets: [] })
    mockUseDeleteAccount.mockReturnValue({
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

  /** Custodial rows spell the whole address, so a bare username here reads as a missing account. */
  it("renders the full lightning address, domain included, as the row title when one is set", () => {
    const { getByText, queryByText } = render(
      <ProfileRow
        entry={{ id: TEST_ENTRY_ID, lightningAddress: "alice@staging.blink.sv" }}
      />,
    )

    expect(getByText("alice@staging.blink.sv")).toBeTruthy()
    expect(queryByText("alice")).toBeNull()
  })

  it("falls back to anonymous user label when no lightning address is set", () => {
    const { getByText } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )

    expect(getByText("Anon user")).toBeTruthy()
  })

  it.each(["", "   "])(
    "falls back to anonymous user label when the stored address is blank (%j)",
    (blank) => {
      const { getByText } = render(
        <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: blank }} />,
      )

      expect(getByText("Anon user")).toBeTruthy()
    },
  )

  it("announces the address and account type instead of the test id", () => {
    const { getByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: "alice@blink.sv" }} />,
    )

    expect(getByTestId(`profile-row-${TEST_ENTRY_ID}`).props.accessibilityLabel).toBe(
      "alice@blink.sv, Non-custodial",
    )
  })

  it("announces the anonymous label when no address is set", () => {
    const { getByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )

    expect(getByTestId(`profile-row-${TEST_ENTRY_ID}`).props.accessibilityLabel).toBe(
      "Anon user, Non-custodial",
    )
  })

  it("trims whitespace around a stored address in the title and the announcement", () => {
    const { getByTestId, getByText } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: "  alice@blink.sv " }} />,
    )

    expect(getByText("alice@blink.sv")).toBeTruthy()
    expect(getByTestId(`profile-row-${TEST_ENTRY_ID}`).props.accessibilityLabel).toBe(
      "alice@blink.sv, Non-custodial",
    )
  })

  it.each([
    { active: true, selected: true },
    { active: false, selected: false },
  ])(
    "marks the row selected only when it is the active account (%j)",
    ({ active, selected }) => {
      if (active) {
        mockUseAccountRegistry.mockReturnValue({
          activeAccount: {
            id: TEST_ENTRY_ID,
            type: AccountType.SelfCustodial,
            label: "Spark",
            selected: true,
            status: AccountStatus.Available,
          },
          setActiveAccountId,
        })
      }

      const { getByTestId } = render(
        <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
      )
      const row = getByTestId(`profile-row-${TEST_ENTRY_ID}`)

      expect(row.props.accessibilityRole).toBe("button")
      expect(row.props.accessibilityState).toEqual({ selected })
    },
  )

  it("labels the delete button for screen readers instead of with its test id", () => {
    const { getByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )
    const deleteButton = getByTestId(`delete-button-${TEST_ENTRY_ID}`)

    expect(deleteButton.props.accessibilityLabel).toBe("Remove account")
    expect(deleteButton.props.accessibilityRole).toBe("button")
  })

  /** The row is a single accessibility element, so VoiceOver never focuses the nested
   *  delete button; the removal has to be reachable from the row itself. */
  it("offers account removal as a labelled accessibility action on the row", () => {
    const { getByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )

    expect(
      getByTestId(`profile-row-${TEST_ENTRY_ID}`).props.accessibilityActions,
    ).toEqual([{ name: "remove", label: "Remove account" }])
  })

  it("runs the same removal flow as the delete button when the row's remove action fires", async () => {
    const { getByTestId, findByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )

    fireEvent(getByTestId(`profile-row-${TEST_ENTRY_ID}`), "accessibilityAction", {
      nativeEvent: { actionName: "remove" },
    })

    expect(await findByTestId("delete-modal")).toBeTruthy()
    expect(mockProbeWallets).toHaveBeenCalledWith({
      accountId: TEST_ENTRY_ID,
      network: mockSparkNetwork.Mainnet,
      leewaySatPerVbyte: 5,
      lnurlDomain: "blink.sv",
    })
    expect(setActiveAccountId).not.toHaveBeenCalled()
  })

  it("ignores accessibility actions other than remove", async () => {
    const { getByTestId, queryByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )

    fireEvent(getByTestId(`profile-row-${TEST_ENTRY_ID}`), "accessibilityAction", {
      nativeEvent: { actionName: "magicTap" },
    })
    await flushEffects()

    expect(mockProbeWallets).not.toHaveBeenCalled()
    expect(queryByTestId("delete-modal")).toBeNull()
    expect(setActiveAccountId).not.toHaveBeenCalled()
  })

  it("switches to the entry's account id when the row is pressed", () => {
    const { getByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )

    fireEvent.press(getByTestId(`profile-row-${TEST_ENTRY_ID}`))

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
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )

    fireEvent.press(getByTestId(`profile-row-${TEST_ENTRY_ID}`))

    expect(setActiveAccountId).not.toHaveBeenCalled()
    expect(mockToastShow).not.toHaveBeenCalled()
  })

  it("opens the confirm-removal modal when the probe returns no funds", async () => {
    mockProbeWallets.mockResolvedValue({ status: "ok", wallets: [] })

    const { getByTestId, queryByTestId, findByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )

    expect(queryByTestId("delete-modal")).toBeNull()

    fireEvent.press(getByTestId(`delete-button-${TEST_ENTRY_ID}`))

    expect(await findByTestId("delete-modal")).toBeTruthy()
    expect(mockProbeWallets).toHaveBeenCalledWith({
      accountId: TEST_ENTRY_ID,
      network: mockSparkNetwork.Mainnet,
      leewaySatPerVbyte: 5,
      lnurlDomain: "blink.sv",
    })
    expect(mockDeleteWallet).not.toHaveBeenCalled()
  })

  it("calls deleteWallet with the entry id and closes the modal when the user confirms", async () => {
    mockProbeWallets.mockResolvedValue({ status: "ok", wallets: [] })
    const entry = { id: TEST_ENTRY_ID, lightningAddress: null }
    const { getByTestId, queryByTestId, findByTestId, rerender } = render(
      <ProfileRow entry={entry} />,
    )
    fireEvent.press(getByTestId(`delete-button-${TEST_ENTRY_ID}`))
    await findByTestId("delete-modal")

    await act(async () => {
      await lastConfirmModalProps.onConfirm?.()
    })
    rerender(<ProfileRow entry={entry} />)

    expect(mockDeleteWallet).toHaveBeenCalledTimes(1)
    expect(mockDeleteWallet).toHaveBeenCalledWith(TEST_ENTRY_ID)
    expect(queryByTestId("delete-modal")).toBeNull()
  })

  it("opens the has-funds warning on mainnet when the probe returns a positive balance", async () => {
    mockProbeWallets.mockResolvedValue({
      status: "ok",
      wallets: [
        {
          id: "btc-1",
          walletCurrency: "BTC",
          balance: { amount: 9999, currency: "BTC", currencyCode: "BTC" },
          transactions: [],
        },
      ],
    })

    const { getByTestId, queryByTestId, findByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )
    fireEvent.press(getByTestId(`delete-button-${TEST_ENTRY_ID}`))

    expect(await findByTestId("warning-modal")).toBeTruthy()
    expect(queryByTestId("delete-modal")).toBeNull()
    expect(lastWarningModalProps.wallets?.[0]?.balance.amount).toBe(9999)
  })

  it("skips the probe and the funds warning on regtest, opening the confirm modal directly", async () => {
    mockNetwork = mockSparkNetwork.Regtest

    const { getByTestId, queryByTestId, findByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )
    fireEvent.press(getByTestId(`delete-button-${TEST_ENTRY_ID}`))

    expect(await findByTestId("delete-modal")).toBeTruthy()
    expect(queryByTestId("warning-modal")).toBeNull()
    expect(mockProbeWallets).not.toHaveBeenCalled()
  })

  it("opens the confirm modal when the probe returns a zero balance", async () => {
    mockProbeWallets.mockResolvedValue({
      status: "ok",
      wallets: [
        {
          id: "btc-1",
          walletCurrency: "BTC",
          balance: { amount: 0, currency: "BTC", currencyCode: "BTC" },
          transactions: [],
        },
      ],
    })

    const { getByTestId, queryByTestId, findByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )
    fireEvent.press(getByTestId(`delete-button-${TEST_ENTRY_ID}`))

    expect(await findByTestId("delete-modal")).toBeTruthy()
    expect(queryByTestId("warning-modal")).toBeNull()
  })

  it("does NOT open the confirm modal when the probe fails — surfaces an error toast instead", async () => {
    mockProbeWallets.mockResolvedValue({
      status: "probe-failed",
      error: new Error("probe failed"),
    })

    const { getByTestId, queryByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )
    fireEvent.press(getByTestId(`delete-button-${TEST_ENTRY_ID}`))

    await flushEffects()

    expect(queryByTestId("delete-modal")).toBeNull()
    expect(queryByTestId("warning-modal")).toBeNull()
    expect(mockToastShow).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        message: "Couldn't verify the wallet's balance.",
      }),
    )
  })

  it("opens the confirm modal directly when the probe reports no-mnemonic (defensive)", async () => {
    mockProbeWallets.mockResolvedValue({ status: "no-mnemonic" })

    const { getByTestId, findByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )
    fireEvent.press(getByTestId(`delete-button-${TEST_ENTRY_ID}`))

    expect(await findByTestId("delete-modal")).toBeTruthy()
  })

  it("short-circuits the probe on mainnet when the row is the active self-custodial account, reading live wallets from useSelfCustodialWallet", async () => {
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
      lightningAddress: null,
      wallets: [
        {
          id: "btc-1",
          walletCurrency: "BTC",
          balance: { amount: 1234, currency: "BTC", currencyCode: "BTC" },
          transactions: [],
        },
      ],
    })

    const { getByTestId, findByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )
    fireEvent.press(getByTestId(`delete-button-${TEST_ENTRY_ID}`))

    expect(await findByTestId("warning-modal")).toBeTruthy()
    expect(mockProbeWallets).not.toHaveBeenCalled()
    expect(lastWarningModalProps.wallets?.[0]?.balance.amount).toBe(1234)
  })

  it("skips the warning on regtest for the active self-custodial account even with live funds", async () => {
    mockNetwork = mockSparkNetwork.Regtest
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
      lightningAddress: null,
      wallets: [
        {
          id: "btc-1",
          walletCurrency: "BTC",
          balance: { amount: 1234, currency: "BTC", currencyCode: "BTC" },
          transactions: [],
        },
      ],
    })

    const { getByTestId, queryByTestId, findByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )
    fireEvent.press(getByTestId(`delete-button-${TEST_ENTRY_ID}`))

    expect(await findByTestId("delete-modal")).toBeTruthy()
    expect(queryByTestId("warning-modal")).toBeNull()
    expect(mockProbeWallets).not.toHaveBeenCalled()
  })

  it("opens the confirm modal directly on the active self-custodial account when live wallets are zero-balance", async () => {
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
      lightningAddress: null,
      wallets: [
        {
          id: "btc-1",
          walletCurrency: "BTC",
          balance: { amount: 0, currency: "BTC", currencyCode: "BTC" },
          transactions: [],
        },
      ],
    })

    const { getByTestId, findByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )
    fireEvent.press(getByTestId(`delete-button-${TEST_ENTRY_ID}`))

    expect(await findByTestId("delete-modal")).toBeTruthy()
    expect(mockProbeWallets).not.toHaveBeenCalled()
  })

  it("shows a spinner on the row while probing and hides the close icon", async () => {
    let resolveProbe: (value: unknown) => void = () => {}
    mockProbeWallets.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveProbe = resolve
        }),
    )

    const { getByTestId, queryByTestId, findByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )
    fireEvent.press(getByTestId(`delete-button-${TEST_ENTRY_ID}`))

    expect(getByTestId(`probe-spinner-${TEST_ENTRY_ID}`)).toBeTruthy()
    expect(queryByTestId(`delete-button-${TEST_ENTRY_ID}`)).toBeNull()

    resolveProbe({ status: "ok", wallets: [] })
    await findByTestId("delete-modal")
    expect(queryByTestId(`probe-spinner-${TEST_ENTRY_ID}`)).toBeNull()
  })

  it("renders the deleting overlay when the delete hook is in deleting state", () => {
    mockUseDeleteAccount.mockReturnValue({
      state: "deleting",
      deleteWallet: mockDeleteWallet,
    })

    const { getByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
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
      wallets: [],
    })

    const { getByText } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: "stale@example.com" }} />,
    )

    expect(getByText("magentamouse1845@breez.tips")).toBeTruthy()
  })

  it("falls back to the persisted address on the active row when the SDK has none", () => {
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

    const { getByText } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: "stored@blink.sv" }} />,
    )

    expect(getByText("stored@blink.sv")).toBeTruthy()
  })

  it("does not let a blank live address mask the persisted one on the active row", () => {
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
    mockUseSelfCustodialWallet.mockReturnValue({ lightningAddress: "", wallets: [] })

    const { getByText } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: "stored@blink.sv" }} />,
    )

    expect(getByText("stored@blink.sv")).toBeTruthy()
  })

  it("ignores the live lightning address for inactive rows and uses the persisted entry value", () => {
    mockUseSelfCustodialWallet.mockReturnValue({
      lightningAddress: "magentamouse1845@breez.tips",
      wallets: [],
    })

    const { getByText } = render(
      <ProfileRow
        entry={{ id: TEST_ENTRY_ID, lightningAddress: "stored@example.com" }}
      />,
    )

    expect(getByText("stored@example.com")).toBeTruthy()
  })

  /** A lock the wipe could not take is still owed an answer, so this one may not land on
   *  the screen that opens a new account. */
  it("returns through the gate when the deletion left the lock standing", async () => {
    mockNetwork = mockSparkNetwork.Mainnet
    mockProbeWallets.mockResolvedValue({ status: "ok", wallets: [] })
    mockDeleteWallet.mockResolvedValue("logged-out-locked")

    const { getByTestId, findByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )
    fireEvent.press(getByTestId(`delete-button-${TEST_ENTRY_ID}`))
    await findByTestId("delete-modal")

    await act(async () => {
      await lastConfirmModalProps.onConfirm?.()
    })

    expect(mockRouteAfterLogout).toHaveBeenCalledWith(true)
  })

  /** The lock went with the wallet, so the flag has to come down with it. A relock raised
   *  while the delete was in flight would otherwise stay up with no lock left to answer,
   *  parking every later deep link behind it. */
  it("lowers the lock flag when the deletion took the lock with it", async () => {
    mockNetwork = mockSparkNetwork.Mainnet
    mockProbeWallets.mockResolvedValue({ status: "ok", wallets: [] })
    mockDeleteWallet.mockResolvedValue("logged-out")

    const { getByTestId, findByTestId } = render(
      <ProfileRow entry={{ id: TEST_ENTRY_ID, lightningAddress: null }} />,
    )
    fireEvent.press(getByTestId(`delete-button-${TEST_ENTRY_ID}`))
    await findByTestId("delete-modal")

    await act(async () => {
      await lastConfirmModalProps.onConfirm?.()
    })

    expect(mockRouteAfterLogout).toHaveBeenCalledWith(false)
  })
})
