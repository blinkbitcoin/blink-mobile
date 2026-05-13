import React from "react"
import { Linking } from "react-native"
import { render, fireEvent, act } from "@testing-library/react-native"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import QRCode from "react-native-qrcode-svg"

import { NwcConnectionCreatedScreen } from "@app/screens/nostr-wallet-connect/connection-created-screen"
import { ContextForScreen } from "../helper"

loadLocale("en")
const LL = i18nObject("en")

const mockNavigate = jest.fn()
const mockDispatch = jest.fn()
const SCRIPT_RETURN_URL = ["java", "script:alert(1)"].join("")
let mockRouteParams: Record<string, unknown> = {
  connectionString:
    "nostr+walletconnect://testpubkey?relay=wss%3A%2F%2Frelay.blink.sv&secret=testsecret&lud16=TestApp",
  appName: "TestApp",
}

jest.mock("@react-navigation/native", () => {
  const actualNav = jest.requireActual("@react-navigation/native")
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: mockNavigate,
      dispatch: mockDispatch,
    }),
    useRoute: () => ({
      params: mockRouteParams,
    }),
  }
})

const mockCopyToClipboard = jest.fn()

jest.mock("@app/hooks/use-clipboard", () => ({
  useClipboard: () => ({
    copyToClipboard: mockCopyToClipboard,
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
      `${moneyAmount.amount} SAT`,
  }),
}))

jest.mock("react-native-qrcode-svg", () => {
  const { View: RNView } = jest.requireActual("react-native")

  return {
    __esModule: true,
    default: jest.fn((props: { value: string }) => (
      <RNView testID="qr-code" accessibilityLabel={props.value} />
    )),
  }
})

describe("NwcConnectionCreatedScreen", () => {
  beforeEach(() => {
    loadLocale("en")
    jest.clearAllMocks()
    jest.spyOn(Linking, "canOpenURL").mockResolvedValue(true)
    jest.spyOn(Linking, "openURL").mockResolvedValue({} as never)
    mockRouteParams = {
      connectionString:
        "nostr+walletconnect://testpubkey?relay=wss%3A%2F%2Frelay.blink.sv&secret=testsecret&lud16=TestApp",
      appName: "TestApp",
    }
  })

  it("renders the QR code section", async () => {
    const { getByTestId } = render(
      <ContextForScreen>
        <NwcConnectionCreatedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(getByTestId("qr-code")).toBeTruthy()
    expect(QRCode).toHaveBeenCalledWith(
      expect.objectContaining({
        ecl: "H",
        logoSize: 32,
      }),
      {},
    )
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

  it("navigates on Done button press with reset dispatch", async () => {
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

    expect(mockDispatch).toHaveBeenCalledWith(expect.any(Function))

    const dispatchCallback = mockDispatch.mock.calls[0][0]
    const action = dispatchCallback({
      index: 2,
      routes: [
        { name: "Primary", key: "primary-key" },
        { name: "nwcNewConnection", key: "new-key" },
        { name: "nwcConnectionCreated", key: "created-key" },
      ],
    })

    expect(action.payload.index).toBe(1)
    expect(action.payload.routes).toEqual([
      { name: "Primary", key: "primary-key" },
      { name: "nwcConnectedApps" },
    ])
  })

  it("renders authorization success summary without exposing the connection string", async () => {
    mockRouteParams = {
      appName: "Amethyst",
      successMode: "authorization",
      permissions: ["GET_INFO", "PAY_INVOICE"],
      budgets: [{ amountSats: 10_000, period: "WEEKLY" }],
    }

    const { getByText, queryByText, queryByTestId } = render(
      <ContextForScreen>
        <NwcConnectionCreatedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      getByText(LL.NostrWalletConnect.authorizationSuccessTitle({ appName: "Amethyst" })),
    ).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.authorizationSummary())).toBeTruthy()
    expect(getByText(LL.NostrWalletConnect.permissionPayInvoice())).toBeTruthy()
    expect(getByText("10000 SAT per Weekly")).toBeTruthy()
    expect(queryByText("nostr+walletconnect://secret")).toBeNull()
    expect(queryByTestId("qr-code")).toBeNull()
  })

  it("renders the non-resetting budget period as annually", async () => {
    mockRouteParams = {
      appName: "Amethyst",
      successMode: "authorization",
      permissions: ["GET_INFO"],
      budgets: [{ amountSats: 10_000, period: "NEVER" }],
    }

    const { getByText } = render(
      <ContextForScreen>
        <NwcConnectionCreatedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    expect(
      getByText(
        LL.NostrWalletConnect.budgetPreview({
          amount: "10000 SAT",
          period: LL.NostrWalletConnect.periodAnnually(),
        }),
      ),
    ).toBeTruthy()
  })

  it("opens a safe return URL after authorization success", async () => {
    mockRouteParams = {
      appName: "Satsback",
      successMode: "authorization",
      permissions: ["GET_INFO"],
      returnUrl: "satsback://nwc/success",
    }

    const { getByText } = render(
      <ContextForScreen>
        <NwcConnectionCreatedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText(LL.NostrWalletConnect.done()))
    })

    expect(Linking.canOpenURL).toHaveBeenCalledWith("satsback://nwc/success")
    expect(Linking.openURL).toHaveBeenCalledWith("satsback://nwc/success")
    expect(mockDispatch).not.toHaveBeenCalled()
  })

  it("falls back home when the authorization return URL is unsafe", async () => {
    mockRouteParams = {
      appName: "Amethyst",
      successMode: "authorization",
      permissions: ["GET_INFO"],
      returnUrl: SCRIPT_RETURN_URL,
    }

    const { getByText } = render(
      <ContextForScreen>
        <NwcConnectionCreatedScreen />
      </ContextForScreen>,
    )

    await act(async () => {})

    await act(async () => {
      fireEvent.press(getByText(LL.NostrWalletConnect.done()))
    })

    expect(Linking.openURL).not.toHaveBeenCalled()
    expect(mockDispatch).toHaveBeenCalledWith(expect.any(Function))
  })
})
