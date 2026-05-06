import React from "react"
import { render, waitFor, fireEvent } from "@testing-library/react-native"

import { SparkWalletCreationScreen } from "@app/screens/spark-onboarding/wallet-creation-screen"

const mockCreate = jest.fn()
let mockStatus = "idle"

jest.mock("@app/screens/spark-onboarding/hooks/use-create-wallet", () => ({
  CreationStatus: { Idle: "idle", Creating: "creating", Error: "error" },
  useCreateWallet: () => ({
    status: mockStatus,
    create: mockCreate,
  }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SparkWalletCreationScreen: {
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

describe("SparkWalletCreationScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockStatus = "idle"
  })

  it("calls create on mount", () => {
    render(<SparkWalletCreationScreen />)

    expect(mockCreate).toHaveBeenCalledTimes(1)
  })

  it("shows loading state when creating", () => {
    mockStatus = "creating"
    const { getByTestId } = render(<SparkWalletCreationScreen />)

    expect(getByTestId("creating-text")).toBeTruthy()
  })

  it("shows error state with retry button on error", () => {
    mockStatus = "error"
    const { getByTestId, getByText } = render(<SparkWalletCreationScreen />)

    expect(getByTestId("error-title")).toBeTruthy()
    expect(getByText("Try again")).toBeTruthy()
  })

  it("calls create on retry press", async () => {
    mockStatus = "error"
    const { getByText } = render(<SparkWalletCreationScreen />)

    fireEvent.press(getByText("Try again"))

    await waitFor(() => {
      expect(mockCreate).toHaveBeenCalledTimes(2)
    })
  })
})
