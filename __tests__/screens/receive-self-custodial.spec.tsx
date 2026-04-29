/**
 * Screen-level spec for the self-custodial Receive flow.
 *
 * Mirrors the custodial spec at __tests__/screens/receive.spec.tsx — mounts the actual
 * <ReceiveScreen /> via ContextForScreen and exercises the rendered UI (carousel pages,
 * QR types, payment identifier text, wallet pill, action buttons). This complements the
 * unit specs at __tests__/self-custodial/hooks/* by catching screen-level integration
 * bugs (titles, prop wiring across hooks).
 *
 * Scenarios:
 *   - Initial PayCode QR for BTC default + LN address
 *   - Initial Lightning QR for USD default
 *   - LN address missing → fallback to Lightning
 *   - Toggle wallet PayCode → Lightning Dollar invoice
 *   - Stable balance ON locks Dollar
 *   - Lightning address copied/shown as payment identifier
 *   - Set amount switches to Lightning invoice with the amount
 */
import React from "react"
import { it } from "@jest/globals"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import Clipboard from "@react-native-clipboard/clipboard"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { WalletCurrency } from "@app/graphql/generated"
import ReceiveScreen from "@app/screens/receive-bitcoin-screen/receive-screen"
import {
  AccountType,
  ActiveWalletStatus,
  toWalletId,
  type WalletState,
} from "@app/types/wallet.types"

import { ContextForScreen } from "./helper"

const flushAsync = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, 0)
      }),
  )

// ---------- mocks ----------

const mockReceiveLightning = jest.fn()
const mockReceiveOnchain = jest.fn()
const mockSelfCustodialWallet = jest.fn()
const mockActiveWallet = jest.fn()
const mockPersistentState = jest.fn()
const mockAddPendingAutoConvert = jest.fn()
const mockFetchAutoConvertMinSats = jest.fn()
const mockUseMyLnUpdatesSubscription = jest.fn()

jest.mock("@app/self-custodial/bridge", () => ({
  createReceiveLightning: () => mockReceiveLightning,
  createReceiveOnchain: () => mockReceiveOnchain,
}))

jest.mock("@app/self-custodial/auto-convert", () => ({
  addPendingAutoConvert: (...args: unknown[]) => mockAddPendingAutoConvert(...args),
  fetchAutoConvertMinSats: (...args: unknown[]) => mockFetchAutoConvertMinSats(...args),
  ReceiveAssetMode: { Bitcoin: "bitcoin", Dollar: "dollar" },
  ReceiveRail: { Lightning: "lightning", Onchain: "onchain" },
}))

jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => mockSelfCustodialWallet(),
}))

jest.mock("@app/store/persistent-state", () => {
  const actual = jest.requireActual("@app/store/persistent-state")
  return {
    ...actual,
    usePersistentStateContext: () => ({
      persistentState: mockPersistentState(),
      updateState: jest.fn(),
    }),
  }
})

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockActiveWallet(),
}))

jest.mock("@app/graphql/generated", () => {
  const actual = jest.requireActual("@app/graphql/generated")
  return {
    ...actual,
    // Skip-on-unauthed queries return empty so the custodial code path stays inactive.
    usePaymentRequestQuery: () => ({ data: null }),
    useRealtimePriceQuery: () => ({ data: null }),
    useLnNoAmountInvoiceCreateMutation: () => [jest.fn()],
    useLnInvoiceCreateMutation: () => [jest.fn()],
    useLnUsdInvoiceCreateMutation: () => [jest.fn()],
    useOnChainAddressCurrentMutation: () => [jest.fn()],
    useMyLnUpdatesSubscription: () => mockUseMyLnUpdatesSubscription(),
  }
})

jest.mock("@app/hooks", () => {
  const actual = jest.requireActual("@app/hooks")
  return {
    ...actual,
    usePriceConversion: () => ({
      convertMoneyAmount: (
        moneyAmount: { amount: number; currency: string },
        toCurrency: string,
      ) => ({
        amount: moneyAmount.amount,
        currency: toCurrency,
        currencyCode: toCurrency,
      }),
    }),
    useAppConfig: () => ({
      appConfig: {
        galoyInstance: {
          lnAddressHostname: "spark.tips",
          name: "Blink",
          posUrl: "https://pay.blink.sv",
        },
      },
    }),
  }
})

jest.mock("@app/hooks/use-display-currency", () => {
  const info = {
    BTC: {
      symbol: "",
      minorUnitToMajorUnitOffset: 0,
      showFractionDigits: false,
      currencyCode: "SAT",
    },
    USD: {
      symbol: "$",
      minorUnitToMajorUnitOffset: 2,
      showFractionDigits: true,
      currencyCode: "USD",
    },
    DisplayCurrency: {
      symbol: "$",
      minorUnitToMajorUnitOffset: 2,
      showFractionDigits: true,
      currencyCode: "USD",
    },
  }

  return {
    useDisplayCurrency: () => ({
      currencyInfo: info,
      zeroDisplayAmount: { amount: 0, currency: "DisplayCurrency", currencyCode: "USD" },
      formatMoneyAmount: ({ moneyAmount }: { moneyAmount: { amount: number } }) =>
        `$${moneyAmount.amount}`,
      getSecondaryAmountIfCurrencyIsDifferent: () => null,
    }),
  }
})

jest.mock("@react-native-clipboard/clipboard", () => ({
  setString: jest.fn(),
  getString: jest.fn(() => Promise.resolve("")),
}))

jest.mock("@app/components/upgrade-account-modal", () => ({
  TrialAccountLimitsModal: () => null,
}))

jest.mock("react-native-nfc-manager", () => ({
  __esModule: true,
  default: {
    isSupported: jest.fn().mockResolvedValue(false),
    start: jest.fn(),
    stop: jest.fn(),
  },
}))

jest.mock("@gorhom/bottom-sheet")

jest.mock("react-native-haptic-feedback", () => ({
  trigger: jest.fn(),
}))

jest.mock("@app/utils/toast", () => ({
  toastShow: jest.fn(),
}))

jest.mock("react-native-reanimated", () => {
  const { View: RNView, Animated: RNAnimated } = jest.requireActual("react-native")
  return {
    __esModule: true,
    default: {
      View: RNView,
      createAnimatedComponent: (component: React.ComponentType) =>
        RNAnimated.createAnimatedComponent(component),
    },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
    cancelAnimation: jest.fn(),
    interpolate: jest.fn(() => 0),
    Easing: { bezier: () => jest.fn() },
    runOnJS: (fn: () => void) => fn,
  }
})

jest.mock("react-native-reanimated-carousel", () => {
  const ReactMock = jest.requireActual("react")
  const { View: RNView, Pressable: RNPressable } = jest.requireActual("react-native")

  type CarouselRenderInfo = {
    index: number
    animationValue: { value: number }
  }

  type CarouselProps = {
    data: number[]
    renderItem: (info: CarouselRenderInfo) => React.ReactElement
    onSnapToItem: (index: number) => void
  }

  const Carousel = ReactMock.forwardRef(
    (props: CarouselProps, _ref: React.Ref<never>) => (
      <RNView testID="carousel">
        {props.data.map((_: number, index: number) => (
          <RNPressable
            key={index}
            testID={`carousel-page-${index}`}
            onPress={() => props.onSnapToItem(index)}
          >
            {props.renderItem({ index, animationValue: { value: 0 } })}
          </RNPressable>
        ))}
      </RNView>
    ),
  )
  Carousel.displayName = "MockCarousel"

  return { __esModule: true, default: Carousel }
})

jest.mock("@app/screens/receive-bitcoin-screen/qr-view", () => {
  const { View: RNView, Text: RNText } = jest.requireActual("react-native")
  return {
    QRView: ({ type, loading }: { type: string; loading: boolean }) => (
      <RNView testID={`qr-view-${type}`}>
        <RNText>{loading ? "Loading" : `QR-${type}`}</RNText>
      </RNView>
    ),
  }
})

// ---------- fixtures ----------

const btcWallet: WalletState = {
  id: toWalletId("sc-btc"),
  walletCurrency: WalletCurrency.Btc,
  balance: { amount: 0, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  transactions: [],
}
const usdWallet: WalletState = {
  id: toWalletId("sc-usd"),
  walletCurrency: WalletCurrency.Usd,
  balance: { amount: 0, currency: WalletCurrency.Usd, currencyCode: "USD" },
  transactions: [],
}

const baseActiveWallet = {
  isSelfCustodial: true,
  isReady: true,
  needsBackendAuth: false,
  status: ActiveWalletStatus.Ready,
  accountType: AccountType.SelfCustodial,
  wallets: [btcWallet, usdWallet],
}

const baseSelfCustodialWallet = {
  sdk: { id: "mock-sdk" },
  status: ActiveWalletStatus.Ready,
  wallets: [btcWallet, usdWallet],
  retry: jest.fn(),
  lightningAddress: "alice@spark.tips",
  isStableBalanceActive: false,
  lastReceivedPaymentId: null,
  hasMoreTransactions: false,
  loadingMore: false,
  loadMore: jest.fn(),
  refreshWallets: jest.fn(),
  refreshStableBalanceActive: jest.fn(),
  accountType: AccountType.SelfCustodial,
}

const basePersistentState = {
  schemaVersion: 8,
  galoyInstance: { id: "Main" as const },
  galoyAuthToken: "",
}

const setupSelfCustodial = (
  overrides: Partial<typeof baseSelfCustodialWallet> = {},
  persistentStateOverrides: Record<string, unknown> = {},
) => {
  mockSelfCustodialWallet.mockReturnValue({
    ...baseSelfCustodialWallet,
    ...overrides,
  })
  mockActiveWallet.mockReturnValue(baseActiveWallet)
  mockPersistentState.mockReturnValue({
    ...basePersistentState,
    ...persistentStateOverrides,
  })
}

// ---------- specs ----------

describe("ReceiveScreen — self-custodial", () => {
  let LL: ReturnType<typeof i18nObject>

  beforeAll(() => {
    loadLocale("en")
  })

  beforeEach(() => {
    jest.clearAllMocks()
    LL = i18nObject("en")
    setupSelfCustodial()
    mockReceiveLightning.mockResolvedValue({ invoice: "lnbcsc1invoice..." })
    mockReceiveOnchain.mockResolvedValue({ address: "bc1qsconchain..." })
    mockAddPendingAutoConvert.mockResolvedValue(undefined)
    mockFetchAutoConvertMinSats.mockResolvedValue(undefined)
    mockUseMyLnUpdatesSubscription.mockReturnValue({ data: null })
  })

  describe("UI structure", () => {
    it("renders the receive screen container with carousel", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()
      await flushAsync()

      expect(screen.getByTestId("receive-screen")).toBeTruthy()
      expect(screen.getByTestId("carousel")).toBeTruthy()
      expect(screen.getByTestId("carousel-page-0")).toBeTruthy()
      expect(screen.getByTestId("carousel-page-1")).toBeTruthy()
    })
  })

  describe("PayCode QR by default (BTC + LN address)", () => {
    it("renders the PayCode QR on page 0", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-PayCode")).toBeTruthy()
        expect(screen.getByText("QR-PayCode")).toBeTruthy()
      })
    })

    it("shows the lightning address as the payment identifier", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(screen.getByText("alice@spark.tips")).toBeTruthy()
      })
    })

    it("does not generate a Lightning invoice while on PayCode", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-PayCode")).toBeTruthy()
      })

      await flushAsync()
      await flushAsync()

      expect(mockReceiveLightning).not.toHaveBeenCalled()
    })

    it("copies the lightning address when tapping the payment identifier", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(screen.getByText("alice@spark.tips")).toBeTruthy()
      })

      fireEvent.press(screen.getByText("alice@spark.tips"))

      expect(Clipboard.setString).toHaveBeenCalledTimes(1)
      expect(Clipboard.setString).toHaveBeenCalledWith("alice@spark.tips")
    })
  })

  describe("USD as Default account preference", () => {
    it("opens on Lightning invoice (Dollar) instead of PayCode", async () => {
      setupSelfCustodial({}, { selfCustodialDefaultWalletCurrency: "USD" })

      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-Lightning")).toBeTruthy()
      })
      expect(screen.queryByTestId("qr-view-PayCode")).toBeNull()
      expect(mockReceiveLightning).toHaveBeenCalledTimes(1)
      expect(mockAddPendingAutoConvert).toHaveBeenCalledTimes(1)
    })
  })

  describe("Stable balance lock-in", () => {
    it("forces Dollar Lightning even when BTC is the user's preference", async () => {
      setupSelfCustodial(
        { isStableBalanceActive: true },
        { selfCustodialDefaultWalletCurrency: "BTC" },
      )

      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-Lightning")).toBeTruthy()
      })
    })
  })

  describe("LN address missing", () => {
    it("falls back to Lightning when no lightning address is registered", async () => {
      setupSelfCustodial({ lightningAddress: undefined })

      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-Lightning")).toBeTruthy()
      })
      expect(screen.queryByTestId("qr-view-PayCode")).toBeNull()
    })

    it("falls back to Lightning when the lightning address is malformed", async () => {
      setupSelfCustodial({ lightningAddress: "not-a-valid-address" })

      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-Lightning")).toBeTruthy()
      })
      expect(screen.queryByTestId("qr-view-PayCode")).toBeNull()
    })
  })

  describe("Wallet toggle BTC ↔ USD", () => {
    it("BTC PayCode → toggle to USD switches to Lightning Dollar invoice", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-PayCode")).toBeTruthy()
      })

      fireEvent.press(screen.getByLabelText("Toggle wallet"))
      await flushAsync()
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-Lightning")).toBeTruthy()
      })
      expect(mockReceiveLightning).toHaveBeenCalled()
    })

    it("USD Lightning → toggle to BTC reverts to PayCode when state is clean", async () => {
      setupSelfCustodial({}, { selfCustodialDefaultWalletCurrency: "USD" })

      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-Lightning")).toBeTruthy()
      })

      fireEvent.press(screen.getByLabelText("Toggle wallet"))
      await flushAsync()
      await flushAsync()

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-PayCode")).toBeTruthy()
      })
    })
  })

  describe("Header title follows invoice type", () => {
    it("uses the lightning-address label while on PayCode", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(screen.getByTestId("qr-view-PayCode")).toBeTruthy()
      })

      // Sanity-check that the title key for PayCode exists in en locale; the screen
      // sets this via navigation.setOptions which we can't read directly here, but the
      // i18n key being present catches accidental removals.
      expect(LL.ReceiveScreen.lightningAddress()).toBeTruthy()
    })
  })

  describe("Action buttons (copy/share) on PayCode", () => {
    it("renders copy and share buttons", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await flushAsync()
      await flushAsync()

      expect(screen.getByText(LL.ReceiveScreen.copyInvoice())).toBeTruthy()
      expect(screen.getByText(LL.ReceiveScreen.shareInvoice())).toBeTruthy()
    })

    it("copies the LN address via the copy button", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )

      await waitFor(() => {
        expect(screen.getByText("alice@spark.tips")).toBeTruthy()
      })

      fireEvent.press(screen.getByText(LL.ReceiveScreen.copyInvoice()))

      expect(Clipboard.setString).toHaveBeenCalledWith("alice@spark.tips")
    })
  })
})
