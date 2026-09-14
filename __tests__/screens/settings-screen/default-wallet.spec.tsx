import React from "react"

import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import theme from "@app/rne-theme/theme"
import { DefaultWalletScreen } from "@app/screens/settings-screen/default-wallet"

const mockGuard = jest.fn()

jest.mock("@app/hooks/use-dollar-balance-restriction-guard", () => ({
  useDollarBalanceRestrictionGuard: () => mockGuard(),
}))

/** The picker itself is covered by its own suites; this file is about which of the three
 *  answers the screen renders, so the content is stood in for by a marker. */
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: { type: "custodial" } }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => true,
}))

jest.mock("@app/graphql/generated", () => ({
  WalletCurrency: { Btc: "BTC", Usd: "USD" },
  useSetDefaultWalletScreenQuery: () => ({ data: undefined, loading: false }),
  useAccountUpdateDefaultWalletIdMutation: () => [jest.fn(), { loading: false }],
}))

jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({ persistentState: {}, updateState: jest.fn() }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: { bitcoin: () => "Bitcoin", dollar: () => "Dollar" },
      DefaultWalletScreen: {
        infoBtc: () => "info btc",
        infoUsdSelfCustodial: () => "info usd",
      },
    },
  }),
}))

jest.mock("@app/components/screen", () => {
  const ReactActual = jest.requireActual("react")
  const { View } = jest.requireActual("react-native")
  return {
    Screen: ({ children }: { children?: React.ReactNode }) =>
      ReactActual.createElement(View, { testID: "screen" }, children),
  }
})

const PENDING_TEST_ID = "default-wallet-region-pending"

const renderScreen = () =>
  render(
    <ThemeProvider theme={theme}>
      <DefaultWalletScreen />
    </ThemeProvider>,
  )

describe("DefaultWalletScreen region gate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockGuard.mockReturnValue({ isGated: false, isRegionPending: false })
  })

  /**
   * A wait is not a refusal. Reading the two as one boolean returned null here, which is a
   * blank screen under the header for as long as the region takes to resolve.
   */
  it("renders a loader while the region is still resolving", () => {
    mockGuard.mockReturnValue({ isGated: false, isRegionPending: true })

    const { getByTestId } = renderScreen()

    expect(getByTestId(PENDING_TEST_ID)).toBeTruthy()
  })

  /** A resolved restriction is already resetting to Primary, so a loader would promise a
   *  screen the user is being taken off. */
  it("renders nothing once the region resolves to a restriction", () => {
    mockGuard.mockReturnValue({ isGated: true, isRegionPending: false })

    const { queryByTestId } = renderScreen()

    expect(queryByTestId(PENDING_TEST_ID)).toBeNull()
    expect(queryByTestId("screen")).toBeNull()
  })

  it("renders the picker once the region resolves to allowed", () => {
    const { getByTestId, queryByTestId } = renderScreen()

    expect(getByTestId("screen")).toBeTruthy()
    expect(queryByTestId(PENDING_TEST_ID)).toBeNull()
  })
})
