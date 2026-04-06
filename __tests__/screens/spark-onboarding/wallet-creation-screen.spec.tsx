import React from "react"
import { render, waitFor } from "@testing-library/react-native"

import { SparkWalletCreationScreen } from "@app/screens/spark-onboarding/wallet-creation-screen"

const mockDispatch = jest.fn()
const mockCreateWallet = jest.fn()
const mockUpdateState = jest.fn()
const mockDeleteMnemonic = jest.fn()

jest.mock("@react-navigation/native", () => ({
  CommonActions: {
    reset: (params: Record<string, unknown>) => ({ type: "RESET", ...params }),
  },
  useNavigation: () => ({ dispatch: mockDispatch }),
}))

jest.mock("@react-navigation/stack", () => ({
  StackNavigationProp: jest.fn(),
}))

jest.mock("@app/self-custodial/bridge", () => ({
  selfCustodialCreateWallet: () => mockCreateWallet(),
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({
    updateState: mockUpdateState,
  }),
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: { deleteMnemonic: () => mockDeleteMnemonic() },
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
    mockCreateWallet.mockResolvedValue("test-mnemonic")
    mockDeleteMnemonic.mockResolvedValue(true)
  })

  it("shows loading state on mount", () => {
    const { getByTestId } = render(<SparkWalletCreationScreen />)

    expect(getByTestId("creating-text")).toBeTruthy()
  })

  it("calls selfCustodialCreateWallet on mount", async () => {
    render(<SparkWalletCreationScreen />)

    await waitFor(() => {
      expect(mockCreateWallet).toHaveBeenCalledTimes(1)
    })
  })

  it("updates activeAccountId on success", async () => {
    render(<SparkWalletCreationScreen />)

    await waitFor(() => {
      expect(mockUpdateState).toHaveBeenCalledTimes(1)
    })
  })

  it("navigates to Primary on success", async () => {
    render(<SparkWalletCreationScreen />)

    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "RESET",
          index: 0,
          routes: [{ name: "Primary" }],
        }),
      )
    })
  })

  it("shows error state on failure", async () => {
    mockCreateWallet.mockRejectedValue(new Error("SDK error"))

    const { findByTestId } = render(<SparkWalletCreationScreen />)

    const errorTitle = await findByTestId("error-title")
    expect(errorTitle).toBeTruthy()
  })

  it("does not clean up mnemonic on success", async () => {
    render(<SparkWalletCreationScreen />)

    await waitFor(() => {
      expect(mockCreateWallet).toHaveBeenCalledTimes(1)
    })

    expect(mockDeleteMnemonic).not.toHaveBeenCalled()
  })
})
