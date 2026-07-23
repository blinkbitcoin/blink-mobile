import React from "react"
import { StyleSheet } from "react-native"

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import MerchantSelectionScreen from "@app/screens/send-bitcoin-screen/merchant-selection-screen"
import { DestinationDirection } from "@app/screens/send-bitcoin-screen/payment-destination/index.types"
import { resolveDestination } from "@app/screens/send-bitcoin-screen/payment-destination/resolve-destination"
import { PaymentType } from "@blinkbitcoin/blink-client"

import { ContextForScreenWithTheme } from "./helper"

const mockReplace = jest.fn()
const mockAccountDefaultWalletQuery = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useAccountDefaultWalletLazyQuery: () => [mockAccountDefaultWalletQuery],
}))

jest.mock("@app/hooks", () => ({
  ...jest.requireActual("@app/hooks"),
  useAppConfig: () => ({
    appConfig: {
      galoyInstance: { lnAddressHostname: "blink.sv" },
    },
  }),
  useDisplayCurrency: () => ({ displayCurrency: "USD" }),
}))

jest.mock("@app/hooks/use-scan-context", () => ({
  useScanContext: () => ({
    myWalletIds: ["btc-wallet-id"],
    bitcoinNetwork: "mainnet",
    lnurlDomains: ["blink.sv"],
  }),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => "MAINNET",
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ sdk: undefined }),
}))

jest.mock(
  "@app/screens/send-bitcoin-screen/payment-destination/resolve-destination",
  () => ({
    resolveDestination: jest.fn(),
  }),
)

jest.mock("@app/utils/analytics", () => ({
  logParseDestinationResult: jest.fn(),
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({
    replace: mockReplace,
  }),
}))

const merchants = [
  {
    id: "picknpay",
    lnurl:
      "00020129530023za.co.electrum.picknpay0122RD2HAK3KTI53EC%2Fconfirm520458125303710540115802ZA5916cryptoqrtestscan6002CT63049BE2@cryptoqr.net",
    category: "merchant-payment" as const,
    title: "Pick n Pay",
    description: "Pay at Pick n Pay with Bitcoin",
    companyName: "Money Badger",
    termsUrl: "https://www.moneybadger.co.za/deals/terms-and-conditions",
  },
  {
    id: "blink-boltz-usdc-arbitrum",
    lnurl: "0x52908400098527886E0F7030069857D2E4169EE7+USDC+Arbitrum@swap.blink.sv",
    category: "swap" as const,
    title: "USDC on Arbitrum",
    description: "Swap USDC on Arbitrum to Bitcoin",
    companyName: "Blink",
    termsUrl: "https://blink.sv/terms",
  },
]

const route = {
  key: "merchantSelection",
  name: "merchantSelection",
  params: { merchants },
} as const

const renderScreen = (mode: "light" | "dark" = "light", routeParams = route.params) =>
  render(
    <ContextForScreenWithTheme mode={mode}>
      <MerchantSelectionScreen route={{ ...route, params: routeParams }} />
    </ContextForScreenWithTheme>,
  )

describe("MerchantSelectionScreen", () => {
  const resolveDestinationMock = resolveDestination as jest.MockedFunction<
    typeof resolveDestination
  >

  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    resolveDestinationMock.mockResolvedValue({
      valid: true,
      destinationDirection: DestinationDirection.Send,
      validDestination: {
        valid: true,
        paymentType: PaymentType.Lnurl,
        lnurl: merchants[1].lnurl,
        isMerchant: true,
        merchant: merchants[1],
        lnurlParams: {} as never,
      },
      createPaymentDetail: jest.fn(),
    })
  })

  it("renders merchant rows in order with titles, descriptions, and fallback icons", () => {
    renderScreen()

    expect(screen.getByText(merchants[0].title)).toBeTruthy()
    expect(screen.getByText(merchants[0].description)).toBeTruthy()
    expect(screen.getByText(merchants[1].title)).toBeTruthy()
    expect(screen.getByText(merchants[1].description)).toBeTruthy()
    expect(screen.getByTestId("merchant-0-title").props.children).toBe(merchants[0].title)
    expect(screen.getByTestId("merchant-0-description").props.children).toBe(
      merchants[0].description,
    )
    expect(screen.getByTestId("merchant-1-title").props.children).toBe(merchants[1].title)
    expect(screen.getByTestId("merchant-1-description").props.children).toBe(
      merchants[1].description,
    )
    expect(screen.getByTestId("icon-storefront")).toBeTruthy()
    expect(screen.getByTestId("icon-coins")).toBeTruthy()
  })

  it("selects a row and continues directly to details with the selected merchant lnurl", async () => {
    renderScreen()

    fireEvent.press(
      screen.getByLabelText(`${merchants[1].title}. ${merchants[1].description}`),
    )

    expect(screen.getByTestId(`merchant-${merchants[1].id}-selected`)).toBeTruthy()

    await waitFor(() =>
      expect(resolveDestinationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          rawInput: merchants[1].lnurl,
          displayCurrency: "USD",
          accountDefaultWalletQuery: mockAccountDefaultWalletQuery,
        }),
        { sdk: undefined, network: "MAINNET" },
        "blink.sv",
      ),
    )
    expect(mockReplace).toHaveBeenCalledWith("sendBitcoinDetails", {
      paymentDestination: expect.objectContaining({
        valid: true,
        destinationDirection: DestinationDirection.Send,
      }),
    })
    expect(mockReplace).not.toHaveBeenCalledWith("sendBitcoinDestination", {
      payment: "0x52908400098527886E0F7030069857D2E4169EE7",
    })
    expect(mockReplace).not.toHaveBeenCalledWith("sendBitcoinDestination", {
      payment: merchants[0].lnurl,
    })
  })

  it("falls back to destination parsing screen if the selected merchant cannot resolve", async () => {
    resolveDestinationMock.mockResolvedValue({
      valid: false,
      invalidReason: "UnknownDestination",
      invalidPaymentDestination: {
        paymentType: PaymentType.Lnurl,
        valid: false,
      } as never,
    })
    renderScreen()

    fireEvent.press(
      screen.getByLabelText(`${merchants[1].title}. ${merchants[1].description}`),
    )

    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith("sendBitcoinDestination", {
        payment: merchants[1].lnurl,
      }),
    )
  })

  it("limits long merchant text without dropping row content", () => {
    const longMerchants = [
      {
        ...merchants[0],
        title:
          "A very long merchant title that should stay constrained to one rendered line",
        description:
          "A very long merchant description that should stay constrained to two rendered lines and ellipsize instead of breaking the compact row layout",
      },
    ]

    renderScreen("light", { merchants: longMerchants })

    expect(screen.getByTestId("merchant-0-title").props.numberOfLines).toBe(1)
    expect(screen.getByTestId("merchant-0-title").props.ellipsizeMode).toBe("tail")
    expect(screen.getByTestId("merchant-0-description").props.numberOfLines).toBe(2)
    expect(screen.getByTestId("merchant-0-description").props.ellipsizeMode).toBe("tail")
    expect(screen.getByText(longMerchants[0].title)).toBeTruthy()
    expect(screen.getByText(longMerchants[0].description)).toBeTruthy()
  })

  it("uses readable themed colors in light and dark mode", () => {
    const lightRender = renderScreen("light")
    const lightContainer = StyleSheet.flatten(
      screen.getByTestId("merchant-selection-screen").props.style,
    )
    const lightTitle = StyleSheet.flatten(
      screen.getByTestId("merchant-0-title").props.style,
    )
    const lightDescription = StyleSheet.flatten(
      screen.getByTestId("merchant-0-description").props.style,
    )

    expect(lightContainer.backgroundColor).toBeTruthy()
    expect(lightTitle.color).toBeTruthy()
    expect(lightDescription.color).toBeTruthy()
    expect(lightTitle.color).not.toBe(lightDescription.color)

    lightRender.unmount()

    renderScreen("dark")
    const darkContainer = StyleSheet.flatten(
      screen.getByTestId("merchant-selection-screen").props.style,
    )
    const darkTitle = StyleSheet.flatten(
      screen.getByTestId("merchant-0-title").props.style,
    )
    const darkDescription = StyleSheet.flatten(
      screen.getByTestId("merchant-0-description").props.style,
    )

    expect(screen.getByText(merchants[0].title)).toBeTruthy()
    expect(screen.getByText(merchants[1].title)).toBeTruthy()
    expect(darkContainer.backgroundColor).toBeTruthy()
    expect(darkTitle.color).toBeTruthy()
    expect(darkDescription.color).toBeTruthy()
    expect(darkTitle.color).not.toBe(darkDescription.color)
    expect(darkContainer.backgroundColor).not.toBe(lightContainer.backgroundColor)
  })
})
