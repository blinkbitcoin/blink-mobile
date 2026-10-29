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
 *   - New on-chain address: offered on the on-chain page, rotates once per tap
 */
import React from "react"
import { it } from "@jest/globals"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native"
import Clipboard from "@react-native-clipboard/clipboard"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import { WalletCurrency } from "@app/graphql/generated"
import ReceiveScreen from "@app/screens/receive-bitcoin-screen/receive-screen"
import { ActionButton } from "@app/components/action-button"
import { toastShow } from "@app/utils/toast"
import {
  AccountType,
  ActiveWalletStatus,
  toWalletId,
  type WalletState,
} from "@app/types/wallet"

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

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockSelfCustodialWallet(),
}))

// The receive hook consults unclaimed deposits before reusing an address; the listing
// itself belongs to its own spec, so it stays empty here.
jest.mock("@app/self-custodial/hooks/use-pending-deposits", () => ({
  usePendingDeposits: () => ({ deposits: [], refetch: jest.fn() }),
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

jest.mock("@app/hooks/use-dollar-balance-restricted", () => ({
  useDollarBalanceGate: () => ({ isGated: false, isRegionPending: false }),
  useDollarBalanceGated: () => false,
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
    useOnChainAddressCreateMutation: () => [jest.fn()],
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

jest.mock("@app/hooks/use-price-conversion", () => {
  const convertMoneyAmount = (
    moneyAmount: { amount: number; currency: string },
    toCurrency: string,
  ) => ({
    amount: moneyAmount.amount,
    currency: toCurrency,
    currencyCode: toCurrency,
  })
  const result = { convertMoneyAmount }
  return { usePriceConversion: () => result }
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
    QRView: ({ type, loading, err }: { type: string; loading: boolean; err: string }) => (
      <RNView testID={`qr-view-${type}`}>
        <RNText>{err || (loading ? "Loading" : `QR-${type}`)}</RNText>
      </RNView>
    ),
  }
})

// ---------- fixtures ----------

const btcWallet: WalletState = {
  id: toWalletId("self-custodial-btc"),
  walletCurrency: WalletCurrency.Btc,
  balance: { amount: 0, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  transactions: [],
}
const usdWallet: WalletState = {
  id: toWalletId("self-custodial-usd"),
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
    allTransactions: [],
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
      setupSelfCustodial(
        {},
        {
          activeAccountId: "self-custodial-id",
          selfCustodialDefaultWalletCurrencyByAccountId: { "self-custodial-id": "USD" },
        },
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
      expect(screen.queryByTestId("qr-view-PayCode")).toBeNull()
      expect(mockReceiveLightning).toHaveBeenCalledTimes(1)
      expect(mockAddPendingAutoConvert).toHaveBeenCalledTimes(1)
    })
  })

  describe("Stable balance lock-in", () => {
    it("forces Dollar Lightning even when BTC is the user's preference", async () => {
      setupSelfCustodial(
        { isStableBalanceActive: true },
        {
          activeAccountId: "self-custodial-id",
          selfCustodialDefaultWalletCurrencyByAccountId: { "self-custodial-id": "BTC" },
        },
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
      setupSelfCustodial(
        {},
        {
          activeAccountId: "self-custodial-id",
          selfCustodialDefaultWalletCurrencyByAccountId: { "self-custodial-id": "USD" },
        },
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

  describe("new on-chain address", () => {
    const currentAddress = "bc1qcurrentaddressxxxxxxxxxxxxxxxxxxxxx1current"
    const freshAddress = "bc1qfreshaddressxxxxxxxxxxxxxxxxxxxxxxxxx9fresh"
    const shown = (address: string) => `${address.slice(0, 10)}...${address.slice(-10)}`

    beforeEach(() => {
      mockReceiveOnchain.mockImplementation((params?: { newAddress?: boolean }) =>
        Promise.resolve({ address: params?.newAddress ? freshAddress : currentAddress }),
      )
    })

    const renderOnOnchainPage = async () => {
      const view = render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )
      await flushAsync()
      await flushAsync()
      fireEvent.press(screen.getByTestId("carousel-page-1"))
      await waitFor(() => {
        expect(screen.getByText(shown(currentAddress))).toBeTruthy()
      })
      return view
    }

    it("is only offered on the on-chain page", async () => {
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )
      await flushAsync()
      await flushAsync()

      expect(screen.queryByText(LL.ReceiveScreen.newAddress())).toBeNull()

      fireEvent.press(screen.getByTestId("carousel-page-1"))

      await waitFor(() => {
        expect(screen.getByText(LL.ReceiveScreen.newAddress())).toBeTruthy()
      })
    })

    it("asks the SDK for a fresh address, shows it and confirms it", async () => {
      await renderOnOnchainPage()

      fireEvent.press(screen.getByText(LL.ReceiveScreen.newAddress()))

      await waitFor(() => {
        expect(screen.getByText(shown(freshAddress))).toBeTruthy()
      })
      expect(mockReceiveOnchain).toHaveBeenLastCalledWith({ newAddress: true })
      expect(toastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          message: LL.ReceiveScreen.newAddressGenerated(),
          type: "success",
        }),
      )
    })

    it("does not confirm a fresh address once the screen has been left", async () => {
      // Regression: the rotation finishes after a back-press and reported Created, so the
      // toast landed on Home, or on a reopened Receive not showing that address yet.
      const view = await renderOnOnchainPage()
      let finishRotation: () => void = () => {}
      mockReceiveOnchain.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishRotation = () => resolve({ address: freshAddress })
          }),
      )

      fireEvent.press(screen.getByText(LL.ReceiveScreen.newAddress()))
      await flushAsync()
      expect(mockReceiveOnchain).toHaveBeenLastCalledWith({ newAddress: true })
      view.unmount()

      await act(async () => {
        finishRotation()
      })
      await flushAsync()

      expect(toastShow).not.toHaveBeenCalled()
    })

    it("rotates once for a double tap", async () => {
      await renderOnOnchainPage()

      // Both taps reach the handler before React re-renders, which is the case the
      // in-flight guard exists for: fireEvent would see the disabled button and skip.
      const { onPress } = screen
        .UNSAFE_getAllByType(ActionButton)
        .find((button) => button.props.label === LL.ReceiveScreen.newAddress())!.props
      await act(async () => {
        onPress()
        onPress()
      })

      await waitFor(() => {
        expect(screen.getByText(shown(freshAddress))).toBeTruthy()
      })
      const rotations = mockReceiveOnchain.mock.calls.filter(
        ([params]) => params?.newAddress === true,
      )
      expect(rotations).toHaveLength(1)
    })

    it("keeps the current address and reports the failure", async () => {
      await renderOnOnchainPage()
      mockReceiveOnchain.mockResolvedValueOnce({ errors: [{ message: "sdk down" }] })

      fireEvent.press(screen.getByText(LL.ReceiveScreen.newAddress()))

      await waitFor(() => {
        expect(toastShow).toHaveBeenCalledWith(
          expect.objectContaining({
            message: LL.ReceiveScreen.newAddressFailed(),
            type: "error",
          }),
        )
      })
      expect(screen.getByText(shown(currentAddress))).toBeTruthy()
    })

    it("retries from New after the first address request failed", async () => {
      mockReceiveOnchain.mockResolvedValueOnce({ errors: [{ message: "offline" }] })
      render(
        <ContextForScreen>
          <ReceiveScreen />
        </ContextForScreen>,
      )
      await flushAsync()
      await flushAsync()
      fireEvent.press(screen.getByTestId("carousel-page-1"))
      await flushAsync()
      expect(screen.queryByText(shown(currentAddress))).toBeNull()

      const identifier = screen.getByTestId("readable-payment-request")
      expect(identifier.props.children).toBeFalsy()
      expect(screen.getByText(LL.ReceiveScreen.onchainAddressLoadFailed())).toBeTruthy()
      expect(screen.queryByText("QR-OnChain")).toBeNull()
      fireEvent.press(identifier)
      expect(Clipboard.setString).not.toHaveBeenCalled()

      fireEvent.press(screen.getByText(LL.ReceiveScreen.copyInvoice()))
      expect(Clipboard.setString).not.toHaveBeenCalled()

      fireEvent.press(screen.getByText(LL.ReceiveScreen.newAddress()))

      await waitFor(() => {
        expect(screen.getByText(shown(freshAddress))).toBeTruthy()
      })
      expect(toastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          message: LL.ReceiveScreen.newAddressGenerated(),
          type: "success",
        }),
      )
    })
  })
})
