import React from "react"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"

import { NwcConnectionCreatedScreen } from "@app/screens/nostr-wallet-connect/connection-created-screen"
import { ContextForScreen } from "../helper"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
const mockReset = jest.fn()

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      reset: mockReset,
    }),
    useRoute: () => ({
      params: {
        connectionString:
          "nostr+walletconnect://testpubkey?relay=wss%3A%2F%2Frelay.blink.sv&secret=testsecret&lud16=TestApp",
        appName: "TestApp",
      },
    }),
  }
})

const mockCopyToClipboard = jest.fn()

jest.mock("@app/hooks/use-clipboard", () => ({
  useClipboard: () => ({
    copyToClipboard: mockCopyToClipboard,
  }),
}))

jest.mock("react-native-qrcode-svg", () => {
  const { View: RNView } = jest.requireActual("react-native")
  return {
    __esModule: true,
    default: (props: { value: string }) => (
      <RNView testID="qr-code" accessibilityLabel={props.value} />
    ),
  }
})

describe("NwcConnectionCreatedScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
  })

  it("renders the QR code section", async () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <NwcConnectionCreatedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByTestId("qr-code")).toBeTruthy()
  })

  it("renders the connection string label", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcConnectionCreatedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByText(LL.NostrWalletConnect.nwcConnectionString())).toBeTruthy()
  })

  it("renders the connection string value", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcConnectionCreatedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      getByText(
        "nostr+walletconnect://testpubkey?relay=wss%3A%2F%2Frelay.blink.sv&secret=testsecret&lud16=TestApp",
      ),
    ).toBeTruthy()
  })

  it("copies connection string on press", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcConnectionCreatedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const connectionStringText = getByText(
      "nostr+walletconnect://testpubkey?relay=wss%3A%2F%2Frelay.blink.sv&secret=testsecret&lud16=TestApp",
    )
    await act(async () => {
      fireEvent.press(connectionStringText)
    })

    expect(mockCopyToClipboard).toHaveBeenCalledWith({
      content:
        "nostr+walletconnect://testpubkey?relay=wss%3A%2F%2Frelay.blink.sv&secret=testsecret&lud16=TestApp",
      message: LL.NostrWalletConnect.nwcStringCopied(),
    })
  })

  it("navigates on Done button press with reset", async () => {
    const { getByText } = render(
      <ContextForScreen>
        <NwcConnectionCreatedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    const doneButton = getByText(LL.NostrWalletConnect.done())
    await act(async () => {
      fireEvent.press(doneButton)
    })

    expect(mockReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: "Primary" }, { name: "nwcConnectedApps" }],
    })
  })
})
