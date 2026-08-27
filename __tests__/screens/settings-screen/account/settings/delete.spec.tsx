import React from "react"
import { Alert, AlertButton } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"

import { ThemeProvider, createTheme } from "@rn-vui/themed"

import { dark, light } from "@app/rne-theme/colors"
import { Delete } from "@app/screens/settings-screen/account/settings/delete"
import { SwitchProfileOutcome } from "@app/hooks/use-switch-to-next-profile"

const mockDeleteAccount = jest.fn()
const mockSetAccountIsBeingDeleted = jest.fn()
const mockSetOptions = jest.fn()
const mockReset = jest.fn()
const mockLogout = jest.fn()
const mockSwitchToNextProfile = jest.fn()

let mockSettingsData: unknown = { me: { defaultAccount: { wallets: [] } } }
let mockSettingsLoading = false

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useAccountDeleteMutation: () => [mockDeleteAccount],
  useSettingsScreenQuery: () => ({
    data: mockSettingsData,
    loading: mockSettingsLoading,
  }),
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ setOptions: mockSetOptions, reset: mockReset }),
}))

jest.mock("@app/hooks/use-logout", () => ({
  __esModule: true,
  default: () => ({ logout: mockLogout }),
}))

jest.mock("@app/hooks", () => ({
  ...jest.requireActual("@app/hooks"),
  useAppConfig: () => ({ appConfig: { token: "custodial-token" } }),
}))

jest.mock("@app/hooks/use-switch-to-next-profile", () => ({
  ...jest.requireActual("@app/hooks/use-switch-to-next-profile"),
  useSwitchToNextProfile: () => ({ switchToNextProfile: mockSwitchToNextProfile }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
      `$${moneyAmount.amount}`,
  }),
}))

jest.mock("@app/screens/settings-screen/account/account-delete-context", () => ({
  useAccountDeleteContext: () => ({
    setAccountIsBeingDeleted: mockSetAccountIsBeingDeleted,
  }),
}))

jest.mock("react-native-modal", () => ({
  __esModule: true,
  default: ({
    isVisible,
    children,
  }: {
    isVisible: boolean
    children: React.ReactNode
  }) => {
    const { View } = jest.requireActual("react-native")
    return isVisible ? <View testID="delete-modal">{children}</View> : null
  },
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: {
        cancel: () => "Cancel",
        error: () => "Error",
        ok: () => "OK",
        warning: () => "Warning",
        yes: () => "Yes",
      },
      support: {
        bye: () => "Bye",
        delete: () => "delete",
        deleteAccount: () => "Delete account",
        deleteAccountBalanceWarning: () => "You still hold a balance",
        deleteAccountConfirmation: () => "Your account has been deleted",
        deleteAccountError: ({ email }: { email: string }) => `Write to ${email}`,
        deleteAccountWarning: () => "This cannot be undone",
        finalConfirmationAccountDeletionTitle: () => "Are you sure?",
        finalConfirmationAccountDeletionMessage: () => "This is permanent",
        typeDelete: ({ delete: word }: { delete: string }) => `Type ${word}`,
      },
      AccountScreen: {
        btcBalanceWarning: ({ balance }: { balance: string }) => `BTC ${balance}`,
        usdBalanceWarning: ({ balance }: { balance: string }) => `USD ${balance}`,
      },
    },
  }),
}))

/** The real theme rather than a mocked `@rn-vui/themed`: the screen renders that library's
 *  Button, Skeleton and Text, and stubbing the module would take those with it. */
const theme = createTheme({ lightColors: light, darkColors: dark, mode: "light" })

const renderDelete = () =>
  render(
    <ThemeProvider theme={theme}>
      <Delete />
    </ThemeProvider>,
  )

const walletsWith = (btcBalance: number, usdBalance: number) => ({
  me: {
    defaultAccount: {
      wallets: [
        { id: "btc", walletCurrency: "BTC", balance: btcBalance },
        { id: "usd", walletCurrency: "USD", balance: usdBalance },
      ],
    },
  },
})

/** Every path to the deletion runs through Alert buttons, so the spy has to hand them back
 *  rather than just record that an alert happened. */
const alertCalls: Array<{ title: string; body?: string; buttons?: AlertButton[] }> = []

const pressAlertButton = async (call: number, label: string) => {
  const button = alertCalls[call]?.buttons?.find((candidate) => candidate.text === label)
  await act(async () => {
    await button?.onPress?.()
  })
}

const openDeletionModal = async () => {
  renderDelete()
  await act(async () => {
    fireEvent.press(screen.getByText("Delete account"))
  })
}

const confirmDeletion = async () => {
  fireEvent.changeText(screen.getByPlaceholderText("delete"), "delete")
  await act(async () => {
    fireEvent.press(screen.getByText("Confirm"))
  })
  await pressAlertButton(alertCalls.length - 1, "OK")
}

describe("Delete", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    alertCalls.length = 0
    mockSettingsData = { me: { defaultAccount: { wallets: [] } } }
    mockSettingsLoading = false
    mockDeleteAccount.mockResolvedValue({
      data: { accountDelete: { success: true, errors: [] } },
    })
    mockSwitchToNextProfile.mockResolvedValue(SwitchProfileOutcome.Switched)
    jest
      .spyOn(Alert, "alert")
      .mockImplementation((title, body, buttons) =>
        alertCalls.push({ title, body, buttons }),
      )
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("shows a skeleton instead of the button while the balances load", () => {
    mockSettingsLoading = true
    renderDelete()

    expect(screen.queryByText("Delete account")).toBeNull()
  })

  it("opens the deletion modal straight away on an empty account", async () => {
    await openDeletionModal()

    expect(screen.getByTestId("delete-modal")).toBeTruthy()
    expect(alertCalls).toHaveLength(0)
  })

  /** Deleting an account with money in it burns the balance, so the warning names what is
   *  about to be lost before the modal is even reachable. */
  it("warns about the balances before opening the modal", async () => {
    mockSettingsData = walletsWith(1500, 200)
    await openDeletionModal()

    expect(screen.queryByTestId("delete-modal")).toBeNull()
    expect(alertCalls[0]?.title).toBe("Warning")
    expect(alertCalls[0]?.body).toBe("USD $200\nBTC $1500\nYou still hold a balance")

    await pressAlertButton(0, "Yes")

    expect(screen.getByTestId("delete-modal")).toBeTruthy()
  })

  it("stays put when the balance warning is dismissed", async () => {
    mockSettingsData = walletsWith(1500, 0)
    await openDeletionModal()
    await pressAlertButton(0, "Cancel")

    expect(screen.queryByTestId("delete-modal")).toBeNull()
  })

  it("keeps the confirm button disabled until the keyword is typed", async () => {
    await openDeletionModal()

    fireEvent.press(screen.getByText("Confirm"))
    expect(alertCalls).toHaveLength(0)

    fireEvent.changeText(screen.getByPlaceholderText("delete"), "delete")
    await act(async () => {
      fireEvent.press(screen.getByText("Confirm"))
    })

    expect(alertCalls[0]?.title).toBe("Are you sure?")
  })

  it("closes the modal and empties the field when it is cancelled", async () => {
    await openDeletionModal()
    fireEvent.changeText(screen.getByPlaceholderText("delete"), "delete")
    await act(async () => {
      fireEvent.press(screen.getByText("Cancel"))
    })

    expect(screen.queryByTestId("delete-modal")).toBeNull()
    expect(mockDeleteAccount).not.toHaveBeenCalled()
  })

  it("does not delete when the final confirmation is cancelled", async () => {
    await openDeletionModal()
    fireEvent.changeText(screen.getByPlaceholderText("delete"), "delete")
    await act(async () => {
      fireEvent.press(screen.getByText("Confirm"))
    })
    await pressAlertButton(0, "Cancel")

    expect(mockDeleteAccount).not.toHaveBeenCalled()
  })

  /** A deletion in flight cannot be backed out of half-way, so every exit is taken away
   *  for as long as it runs. */
  it("takes the back button and the swipe gesture away while the deletion runs", async () => {
    await openDeletionModal()
    await confirmDeletion()

    const [hideOptions] = mockSetOptions.mock.calls[0]
    expect(hideOptions.gestureEnabled).toBe(false)
    expect(hideOptions.headerLeft()).toBeNull()
    expect(mockSetAccountIsBeingDeleted).toHaveBeenCalledWith(true)
  })

  describe("when the deletion succeeds", () => {
    it("hands the deleted account's token to the profile switch", async () => {
      await openDeletionModal()
      await confirmDeletion()

      expect(mockDeleteAccount).toHaveBeenCalledTimes(1)
      expect(mockSwitchToNextProfile).toHaveBeenCalledWith("custodial-token")
    })

    /** Another profile is left on the device, so the app stays signed in on that one
     *  instead of dropping the user at the get-started screen. */
    it("keeps the session when another profile takes over", async () => {
      await openDeletionModal()
      await confirmDeletion()
      await pressAlertButton(alertCalls.length - 1, "OK")

      expect(mockLogout).not.toHaveBeenCalled()
      expect(mockReset).not.toHaveBeenCalled()
    })

    it("signs out and returns to get-started when it was the last profile", async () => {
      mockSwitchToNextProfile.mockResolvedValue(SwitchProfileOutcome.NoOtherProfile)
      await openDeletionModal()
      await confirmDeletion()

      expect(mockLogout).toHaveBeenCalledWith({
        stateToDefault: true,
        preserveStoredCredentials: false,
      })

      await pressAlertButton(alertCalls.length - 1, "OK")

      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: "getStarted" }],
      })
    })

    /** The logout erases every saved session, so it must not run when
     *  the store could not be read: the profiles it would delete are the ones
     *  the read never saw. Everything else still signs out. */
    it("keeps the saved profiles when the store is unreadable, and signs out of the rest", async () => {
      mockSwitchToNextProfile.mockResolvedValue(SwitchProfileOutcome.ProfilesUnreadable)
      await openDeletionModal()
      await confirmDeletion()

      expect(mockLogout).toHaveBeenCalledWith({
        stateToDefault: true,
        preserveStoredCredentials: true,
      })

      await pressAlertButton(alertCalls.length - 1, "OK")

      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: "getStarted" }],
      })
    })
  })

  describe("when the server refuses the deletion", () => {
    it("quotes the server's reason under the generic message", async () => {
      mockDeleteAccount.mockResolvedValue({
        data: {
          accountDelete: { success: false, errors: [{ message: "account is locked" }] },
        },
      })
      await openDeletionModal()
      await confirmDeletion()

      expect(alertCalls[alertCalls.length - 1]).toMatchObject({
        title: "Error",
        body: "Write to support@blink.sv\n\naccount is locked",
      })
    })

    /** The migration close reads this same payload and treats it as retryable, so it does
     *  reach this screen: reading the first error unguarded would throw a TypeError here and
     *  replace the reason with the generic catch-all. */
    it("falls back to the generic message when the payload carries no reason", async () => {
      mockDeleteAccount.mockResolvedValue({
        data: { accountDelete: { success: false, errors: [] } },
      })
      await openDeletionModal()
      await confirmDeletion()

      expect(alertCalls[alertCalls.length - 1]).toMatchObject({
        title: "Error",
        body: "Write to support@blink.sv",
      })
    })

    /** The deletion hid the back button and the swipe gesture; a deletion that did not
     *  happen has to give them back or the user is stuck on a dead screen. */
    it("gives the user their way off the screen back", async () => {
      mockDeleteAccount.mockResolvedValue({
        data: { accountDelete: { success: false, errors: [] } },
      })
      await openDeletionModal()
      await confirmDeletion()

      expect(mockSetOptions).toHaveBeenLastCalledWith({
        headerLeft: undefined,
        gestureEnabled: true,
      })
      expect(mockSetAccountIsBeingDeleted).toHaveBeenLastCalledWith(false)
    })
  })

  describe("when the mutation throws", () => {
    beforeEach(() => {
      jest.spyOn(console, "error").mockImplementation(() => {})
      mockDeleteAccount.mockRejectedValue(new Error("network down"))
    })

    it("shows the generic error rather than the crash", async () => {
      await openDeletionModal()
      await confirmDeletion()

      expect(alertCalls[alertCalls.length - 1]).toMatchObject({
        title: "Error",
        body: "Write to support@blink.sv",
      })
    })

    it("gives the user their way off the screen back", async () => {
      await openDeletionModal()
      await confirmDeletion()

      expect(mockSetOptions).toHaveBeenLastCalledWith({
        headerLeft: undefined,
        gestureEnabled: true,
      })
      expect(mockSetAccountIsBeingDeleted).toHaveBeenLastCalledWith(false)
    })
  })
})
