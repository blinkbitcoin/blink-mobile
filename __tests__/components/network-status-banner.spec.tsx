import React from "react"
import { render } from "@testing-library/react-native"

import { ActiveWalletStatus } from "@app/types/wallet"

import { NetworkStatusBanner } from "@app/components/network-status-banner/network-status-banner"

jest.mock("@rn-vui/themed", () => {
  const colors: Record<string, string> = {
    warning: "#f90",
    grey4: "#ddd",
    grey5: "#f5f5f5",
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

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

const mockUseActiveWallet = jest.fn()

jest.mock("@app/hooks/use-active-wallet", () => ({
  useActiveWallet: () => mockUseActiveWallet(),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: { NetworkStatus: { degradedBanner: () => "Network degraded" } },
  }),
}))

describe("NetworkStatusBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("renders the warning when active wallet status is Degraded", () => {
    mockUseActiveWallet.mockReturnValue({ status: ActiveWalletStatus.Degraded })

    const { getByText, queryByTestId } = render(<NetworkStatusBanner />)

    expect(getByText("Network degraded")).toBeTruthy()
    expect(queryByTestId("network-status-banner-degraded")).toBeTruthy()
  })

  it("renders nothing when status is Ready", () => {
    mockUseActiveWallet.mockReturnValue({ status: ActiveWalletStatus.Ready })

    const { queryByTestId } = render(<NetworkStatusBanner />)

    expect(queryByTestId("network-status-banner-degraded")).toBeNull()
  })

  it("renders nothing when status is Loading", () => {
    mockUseActiveWallet.mockReturnValue({ status: ActiveWalletStatus.Loading })

    const { queryByTestId } = render(<NetworkStatusBanner />)

    expect(queryByTestId("network-status-banner-degraded")).toBeNull()
  })

  it("renders nothing when status is Offline", () => {
    mockUseActiveWallet.mockReturnValue({ status: ActiveWalletStatus.Offline })

    const { queryByTestId } = render(<NetworkStatusBanner />)

    expect(queryByTestId("network-status-banner-degraded")).toBeNull()
  })
})
