import React from "react"
import { fireEvent, render, waitFor } from "@testing-library/react-native"

import { SelfCustodialBitcoinDepositScreen } from "@app/screens/settings-screen/self-custodial/bitcoin-deposit-screen"

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = {
    grey2: "#999",
    grey5: "#f5f5f5",
    black: "#000",
    error: "#f00",
    primary: "#007",
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
  }
})

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) =>
    React.createElement("Screen", null, children),
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

jest.mock("@app/components/totp-export", () => ({
  QrCodeComponent: ({ value }: { value: string }) =>
    React.createElement("QrCodeComponent", { "data-value": value }),
}))

const mockCreateReceiveOnchain = jest.fn()
const mockCopyToClipboard = jest.fn()
const mockUseSelfCustodialWallet = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  createReceiveOnchain: (...args: unknown[]) => mockCreateReceiveOnchain(...args),
}))

jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

jest.mock("@app/hooks", () => ({
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SettingsScreen: {
        WaysToGetPaid: {
          onchainDescription: () => "Send BTC to this address",
          loadError: () => "Could not load your payment details.",
        },
      },
    },
  }),
}))

describe("SelfCustodialBitcoinDepositScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the loading indicator initially when sdk is null", () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: null })

    const { queryByTestId } = render(<SelfCustodialBitcoinDepositScreen />)

    expect(queryByTestId("bitcoin-deposit-error")).toBeNull()
    expect(queryByTestId("bitcoin-deposit-qr")).toBeNull()
  })

  it("renders the QR + address when the bridge returns an onchain address", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: { id: "sdk" } })
    mockCreateReceiveOnchain.mockReturnValue(() =>
      Promise.resolve({ address: "bc1qabc" }),
    )

    const { findByTestId, getByText } = render(<SelfCustodialBitcoinDepositScreen />)

    await findByTestId("bitcoin-deposit-qr")
    expect(getByText("bc1qabc")).toBeTruthy()
  })

  it("renders the error message when the bridge returns an errors payload", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: { id: "sdk" } })
    mockCreateReceiveOnchain.mockReturnValue(() =>
      Promise.resolve({ errors: [{ message: "boom" }] }),
    )

    const { findByTestId, getByText } = render(<SelfCustodialBitcoinDepositScreen />)

    await findByTestId("bitcoin-deposit-error")
    expect(getByText("Could not load your payment details.")).toBeTruthy()
  })

  it("copies the address when the user taps the copy row", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: { id: "sdk" } })
    mockCreateReceiveOnchain.mockReturnValue(() =>
      Promise.resolve({ address: "bc1qabc" }),
    )

    const { findByTestId } = render(<SelfCustodialBitcoinDepositScreen />)

    const copyRow = await findByTestId("bitcoin-deposit-copy")
    fireEvent.press(copyRow)

    await waitFor(() =>
      expect(mockCopyToClipboard).toHaveBeenCalledWith({ content: "bc1qabc" }),
    )
  })

  it("renders the error fallback when the bridge throws", async () => {
    mockUseSelfCustodialWallet.mockReturnValue({ sdk: { id: "sdk" } })
    mockCreateReceiveOnchain.mockReturnValue(() =>
      Promise.reject(new Error("network down")),
    )

    const { findByTestId } = render(<SelfCustodialBitcoinDepositScreen />)

    await findByTestId("bitcoin-deposit-error")
  })
})
