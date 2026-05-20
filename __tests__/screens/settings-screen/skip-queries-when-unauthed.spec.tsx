import React from "react"
import { it } from "@jest/globals"
import { render, renderHook } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { IsAuthedContextProvider } from "@app/graphql/is-authed-context"
import theme from "@app/rne-theme/theme"

const mockUseSettingsScreenQuery = jest.fn()
const mockUseUnacknowledgedNotificationCountQuery = jest.fn()

jest.mock("@app/graphql/generated", () => ({
  useSettingsScreenQuery: (opts: unknown) => mockUseSettingsScreenQuery(opts),
  useUnacknowledgedNotificationCountQuery: (opts: unknown) =>
    mockUseUnacknowledgedNotificationCountQuery(opts),
  useExportCsvSettingLazyQuery: () => [jest.fn(), { loading: false }],
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: jest.fn() }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: {
        language: () => "Language",
        csvExport: () => "CSV",
        blinkUser: () => "Blink User",
        bitcoin: () => "Bitcoin",
        dollar: () => "USD",
      },
      SettingsScreen: {
        setByOs: () => "Default",
        setYourLightningAddress: () => "Set address",
        pos: () => "POS",
        staticQr: () => "Static QR",
        logInOrCreateAccount: () => "Login",
      },
      DefaultWalletScreen: { title: () => "Default wallet" },
      GaloyAddressScreen: { copiedLightningAddressToClipboard: () => "Copied" },
    },
  }),
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: {
      galoyInstance: {
        lnAddressHostname: "blink.sv",
        posUrl: "https://pos.test",
      },
    },
  }),
  useClipboard: () => ({ copyToClipboard: jest.fn() }),
}))

jest.mock("@rn-vui/themed", () => ({
  ...jest.requireActual("@rn-vui/themed"),
  useTheme: () => ({
    theme: {
      colors: {
        primary: "#000",
        error: "#f00",
        grey4: "#ddd",
        grey5: "#eee",
        black: "#000",
      },
    },
  }),
}))

jest.mock("@app/graphql/level-context", () => ({
  AccountLevel: { NonAuth: "NonAuth", Zero: "Zero", One: "One" },
  useLevel: () => ({ currentLevel: "NonAuth" }),
}))

jest.mock("@app/components/set-lightning-address-modal", () => ({
  SetLightningAddressModal: () => null,
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: jest.fn(),
}))

jest.mock("react-native-share", () => ({
  __esModule: true,
  default: { open: jest.fn() },
}))

import { AccountBanner } from "@app/screens/settings-screen/account/banner"
import { useLoginMethods } from "@app/screens/settings-screen/account/login-methods-hook"
import { DefaultWallet } from "@app/screens/settings-screen/settings/account-default-wallet"
import { AccountLNAddress } from "@app/screens/settings-screen/settings/account-ln-address"
import { AccountPOS } from "@app/screens/settings-screen/settings/account-pos"
import { AccountStaticQR } from "@app/screens/settings-screen/settings/account-static-qr"
import { ExportCsvSetting } from "@app/screens/settings-screen/settings/advanced-export-csv"
import { LanguageSetting } from "@app/screens/settings-screen/settings/preferences-language"

const renderWithAuth = (component: React.ReactElement, isAuthed: boolean) =>
  render(
    <ThemeProvider theme={theme}>
      <IsAuthedContextProvider value={isAuthed}>{component}</IsAuthedContextProvider>
    </ThemeProvider>,
  )

describe("settings skips graphql queries when unauthenticated", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseSettingsScreenQuery.mockReturnValue({ data: undefined, loading: false })
    mockUseUnacknowledgedNotificationCountQuery.mockReturnValue({ data: undefined })
  })

  describe("useSettingsScreenQuery consumers without fetchPolicy", () => {
    const consumers = [
      { name: "LanguageSetting", make: () => <LanguageSetting /> },
      { name: "DefaultWallet", make: () => <DefaultWallet /> },
      { name: "AccountPOS", make: () => <AccountPOS /> },
      { name: "AccountStaticQR", make: () => <AccountStaticQR /> },
      { name: "AccountLNAddress", make: () => <AccountLNAddress /> },
      { name: "ExportCsvSetting", make: () => <ExportCsvSetting /> },
    ]

    it.each(consumers)("$name passes skip: true when unauthed", ({ make }) => {
      renderWithAuth(make(), false)

      expect(mockUseSettingsScreenQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: true }),
      )
    })

    it.each(consumers)("$name passes skip: false when authed", ({ make }) => {
      renderWithAuth(make(), true)

      expect(mockUseSettingsScreenQuery).toHaveBeenCalledWith(
        expect.objectContaining({ skip: false }),
      )
    })
  })

  describe("AccountBanner", () => {
    it("applies skip: !isAuthed while preserving fetchPolicy: cache-first", () => {
      renderWithAuth(<AccountBanner />, false)

      expect(mockUseSettingsScreenQuery).toHaveBeenCalledWith({
        skip: true,
        fetchPolicy: "cache-first",
      })
    })

    it("does not skip when authed and keeps fetchPolicy: cache-first", () => {
      renderWithAuth(<AccountBanner />, true)

      expect(mockUseSettingsScreenQuery).toHaveBeenCalledWith({
        skip: false,
        fetchPolicy: "cache-first",
      })
    })
  })

  describe("useLoginMethods", () => {
    const wrap = (isAuthed: boolean) => {
      const Wrapper = ({ children }: { children: React.ReactNode }) => (
        <IsAuthedContextProvider value={isAuthed}>{children}</IsAuthedContextProvider>
      )
      Wrapper.displayName = "AuthWrapper"
      return Wrapper
    }

    it("applies skip: !isAuthed while preserving fetchPolicy: cache-and-network", () => {
      renderHook(() => useLoginMethods(), { wrapper: wrap(false) })

      expect(mockUseSettingsScreenQuery).toHaveBeenCalledWith({
        skip: true,
        fetchPolicy: "cache-and-network",
      })
    })

    it("does not skip when authed and keeps fetchPolicy: cache-and-network", () => {
      renderHook(() => useLoginMethods(), { wrapper: wrap(true) })

      expect(mockUseSettingsScreenQuery).toHaveBeenCalledWith({
        skip: false,
        fetchPolicy: "cache-and-network",
      })
    })
  })
})
