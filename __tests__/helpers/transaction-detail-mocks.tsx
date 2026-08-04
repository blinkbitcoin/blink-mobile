import * as React from "react"

/**
 * Shared mocks for the transaction-detail-screen specs.
 *
 * The screen pulls in the whole themed/hook stack, so every spec that renders
 * it needs the same stubs. Keeping them here means a change to the screen's
 * hooks is a one-line change instead of the same edit in three files.
 *
 * Pull each one in from inside the factory, the way card-flow-mocks is used:
 *
 *   jest.mock("@rn-vui/themed", () =>
 *     jest.requireActual("../helpers/transaction-detail-mocks").mockThemedText(),
 *   )
 *
 * Importing these at the top of a spec instead looks tidier but breaks. A
 * factory fires the first time its module is required, which happens midway
 * through importing the screen under test — so any binding the spec declares
 * after that import is still in its TDZ. That is also why mockAppHooks takes
 * a thunk rather than a spy.
 */

export const TEST_GALOY_INSTANCE = {
  name: "Blink",
  blockExplorer: "https://mempool.space/tx/",
  sparkExplorer: "https://sparkscan.io/tx/",
}

const colors: Record<string, string> = {
  grey5: "#f5f5f5",
  primary: "#fc5805",
  black: "#000",
  white: "#fff",
}

/**
 * `@rn-vui/themed` reduced to the pieces the screen uses. Text renders as a
 * host "Text" element keeping its props, so specs can assert on `type`,
 * `numberOfLines` and children.
 */
export const mockThemedText = () => ({
  makeStyles:
    (
      fn: (
        theme: { colors: Record<string, string> },
        params: Record<string, unknown>,
      ) => Record<string, object>,
    ) =>
    (params: Record<string, unknown> = {}) =>
      fn({ colors }, params),
  Text: ({ children, ...props }: { children: React.ReactNode }) =>
    React.createElement("Text", props, children),
  useTheme: () => ({ theme: { colors, mode: "light" } }),
})

export const mockSafeAreaInsets = () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
})

export const mockScreen = () => ({
  Screen: ({ children }: { children: React.ReactNode }) =>
    React.createElement("View", { testID: "screen" }, children),
})

/**
 * IconAction renders a GaloyIconButton; reduce it to a plain Pressable so the
 * explorer / copy icons can be pressed by testID without the themed internals.
 */
export const mockGaloyIconButton = () => {
  const { Pressable } = jest.requireActual("react-native")
  return {
    GaloyIconButton: ({ name, onPress }: { name: string; onPress: () => void }) =>
      React.createElement(Pressable, { testID: name, onPress }),
  }
}

export const mockGaloyPrimaryButton = () => {
  const { Pressable, Text } = jest.requireActual("react-native")
  return {
    GaloyPrimaryButton: ({ title, onPress }: { title: string; onPress: () => void }) =>
      React.createElement(
        Pressable,
        { testID: "primary-button", onPress },
        React.createElement(Text, null, title),
      ),
  }
}

export const mockGeneratedGraphql = () => ({
  TransactionFragmentDoc: {},
  WalletCurrency: { Btc: "BTC", Usd: "USD" },
  useTransactionListForDefaultAccountLazyQuery: () => [jest.fn()],
  useHomeAuthedQuery: () => ({ data: undefined }),
})

/**
 * `getCopyToClipboard` is a thunk, not the spy itself: the factory runs while
 * the screen is still being imported, so a spy passed by value would be read
 * before its `const` initializes. Resolving it inside useClipboard defers the
 * read to render time.
 */
export const mockAppHooks = ({
  getCopyToClipboard,
}: { getCopyToClipboard?: () => jest.Mock } = {}) => {
  const unobservedCopy = jest.fn()
  return {
    useAppConfig: () => ({ appConfig: { galoyInstance: TEST_GALOY_INSTANCE } }),
    useClipboard: () => ({
      copyToClipboard: getCopyToClipboard ? getCopyToClipboard() : unobservedCopy,
    }),
    useTransactionSeenState: () => ({
      latestBtcTxId: undefined,
      latestUsdTxId: undefined,
      markTxSeen: jest.fn(),
    }),
  }
}

export const mockDisplayCurrency = () => ({
  useDisplayCurrency: () => ({
    formatMoneyAmount: () => "1,000 sats",
    formatCurrency: () => "$1.00",
  }),
})

export const mockNavigation = () => ({
  useNavigation: () => ({ goBack: jest.fn() }),
})
