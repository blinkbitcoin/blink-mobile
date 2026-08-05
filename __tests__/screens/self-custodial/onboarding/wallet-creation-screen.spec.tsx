import React from "react"
import { render, waitFor, fireEvent } from "@testing-library/react-native"

import { WalletCreationScreen } from "@app/screens/self-custodial/onboarding/wallet-creation-screen"
import { AccountMode } from "@app/types/account"

const mockCreate = jest.fn()
let mockStatus = "idle"
let mockRouteParams: { mode?: AccountMode } | undefined = { mode: AccountMode.Enhanced }

jest.mock("@react-navigation/native", () => ({
  useRoute: () => ({ params: mockRouteParams }),
}))

jest.mock("@app/screens/self-custodial/onboarding/hooks/use-create-wallet", () => ({
  CreationStatus: { Idle: "idle", Creating: "creating", Error: "error" },
  useCreateWallet: () => ({
    status: mockStatus,
    create: mockCreate,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      WalletCreationScreen: {
        creating: () => "Creating your wallet...",
        errorTitle: () => "Wallet creation failed",
        errorDescription: () => "Something went wrong. Please try again.",
        retry: () => "Try again",
      },
    },
  }),
}))

jest.mock("@rn-vui/themed", () => ({
  makeStyles: (fn: (args: Record<string, never>) => Record<string, object>) => () =>
    fn({}),
  Text: ({ children, ...props }: { children: React.ReactNode }) =>
    React.createElement("Text", props, children),
}))

jest.mock("@app/components/atomic/galoy-primary-button", () => ({
  GaloyPrimaryButton: ({
    title,
    onPress,
    ...props
  }: {
    title: string
    onPress: () => void
  }) =>
    React.createElement(
      "Pressable",
      { onPress, ...props },
      React.createElement("Text", {}, title),
    ),
}))

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) =>
    React.createElement("View", {}, children),
}))

jest.mock("@app/utils/testProps", () => ({
  testProps: (id: string) => ({ testID: id }),
}))

describe("WalletCreationScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStatus = "idle"
    mockRouteParams = { mode: AccountMode.Enhanced }
  })

  it("creates on mount with the chosen mode from the route", () => {
    render(<WalletCreationScreen />)

    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate).toHaveBeenCalledWith(AccountMode.Enhanced)
  })

  it("creates with no mode when the route carries none", () => {
    mockRouteParams = undefined
    render(<WalletCreationScreen />)

    expect(mockCreate).toHaveBeenCalledWith(undefined)
  })

  it("shows loading state when creating", () => {
    mockStatus = "creating"
    const { getByTestId } = render(<WalletCreationScreen />)

    expect(getByTestId("creating-text")).toBeTruthy()
  })

  it("shows error state with retry button on error", () => {
    mockStatus = "error"
    const { getByTestId, getByText } = render(<WalletCreationScreen />)

    expect(getByTestId("error-title")).toBeTruthy()
    expect(getByText("Try again")).toBeTruthy()
  })

  /** Anon rather than the default, so a retry that dropped the mode and fell back to
   *  Enhanced would fail here instead of passing on the call count alone. */
  it("carries the chosen mode through a retry press", async () => {
    mockStatus = "error"
    mockRouteParams = { mode: AccountMode.Anon }
    const { getByText } = render(<WalletCreationScreen />)

    fireEvent.press(getByText("Try again"))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(2)
    })
    expect(mockCreate).toHaveBeenNthCalledWith(2, AccountMode.Anon)
  })
})
