import React from "react"
import { fireEvent, render, waitFor } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { UnclaimedDepositBanner } from "@app/components/unclaimed-deposit-banner/unclaimed-deposit-banner"
import { DepositStatus, type PendingDeposit } from "@app/types/payment"
import { WalletCurrency } from "@app/graphql/generated"

const mockNavigate = jest.fn()
const mockListPendingDeposits = jest.fn()
let mockWallets: unknown[] = []
let mockListPendingDepositsImpl: typeof mockListPendingDeposits | undefined =
  mockListPendingDeposits

jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
  useFocusEffect: (cb: () => void) => {
    cb()
  },
}))

jest.mock("@app/hooks/use-payments", () => ({
  usePayments: () => ({ listPendingDeposits: mockListPendingDepositsImpl }),
}))

jest.mock("@app/self-custodial/providers/wallet-provider", () => ({
  useSelfCustodialWallet: () => ({ wallets: mockWallets }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      UnclaimedDeposit: {
        title: ({ count }: { count: number }) => `${count} pending`,
        description: ({ sats }: { sats: number }) => `${sats} sats`,
      },
    },
  }),
}))

const buildDeposit = (overrides: Partial<PendingDeposit> = {}): PendingDeposit => ({
  id: "deposit-1",
  txid: "tx",
  vout: 0,
  amount: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
  status: DepositStatus.Claimable,
  errorReason: null,
  ...overrides,
})

const renderBanner = () =>
  render(
    <ThemeProvider theme={theme}>
      <UnclaimedDepositBanner />
    </ThemeProvider>,
  )

describe("UnclaimedDepositBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockWallets = []
    mockListPendingDepositsImpl = mockListPendingDeposits
    mockListPendingDeposits.mockResolvedValue({ deposits: [] })
  })

  it("renders nothing when there are no pending deposits", async () => {
    const { queryByTestId } = renderBanner()

    await waitFor(() => expect(mockListPendingDeposits).toHaveBeenCalled())

    expect(queryByTestId("unclaimed-deposit-banner")).toBeNull()
  })

  it("renders count and total sats when deposits are pending", async () => {
    mockListPendingDeposits.mockResolvedValue({
      deposits: [
        buildDeposit({
          id: "1",
          amount: { amount: 1000, currency: WalletCurrency.Btc, currencyCode: "BTC" },
        }),
        buildDeposit({
          id: "2",
          amount: { amount: 2500, currency: WalletCurrency.Btc, currencyCode: "BTC" },
        }),
      ],
    })

    const { findByText } = renderBanner()

    expect(await findByText("2 pending")).toBeTruthy()
    expect(await findByText("3500 sats")).toBeTruthy()
  })

  it("filters out refunded deposits from the count and total", async () => {
    mockListPendingDeposits.mockResolvedValue({
      deposits: [
        buildDeposit({ id: "1", status: DepositStatus.Claimable }),
        buildDeposit({
          id: "2",
          status: DepositStatus.Refunded,
          amount: { amount: 9999, currency: WalletCurrency.Btc, currencyCode: "BTC" },
        }),
      ],
    })

    const { findByText } = renderBanner()

    expect(await findByText("1 pending")).toBeTruthy()
    expect(await findByText("1000 sats")).toBeTruthy()
  })

  it("navigates to the unclaimed-deposits screen on press", async () => {
    mockListPendingDeposits.mockResolvedValue({
      deposits: [buildDeposit()],
    })

    const { findByTestId } = renderBanner()
    const banner = await findByTestId("unclaimed-deposit-banner")

    fireEvent.press(banner)

    expect(mockNavigate).toHaveBeenCalledWith("unclaimedDepositsScreen")
  })

  it("does nothing when listPendingDeposits is undefined (custodial / loading)", () => {
    mockListPendingDepositsImpl = undefined

    const { queryByTestId } = renderBanner()

    expect(queryByTestId("unclaimed-deposit-banner")).toBeNull()
    expect(mockListPendingDeposits).not.toHaveBeenCalled()
  })
})
