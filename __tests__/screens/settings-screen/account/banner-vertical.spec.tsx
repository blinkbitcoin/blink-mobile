import React from "react"

import { render } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"
import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"

let mockActiveAccountType = "self-custodial"
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: { type: mockActiveAccountType },
  }),
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ reset: jest.fn() }),
}))

let mockLightningAddress: string | null = "satoshi@blink.sv"
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ lightningAddress: mockLightningAddress }),
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { lnAddressHostname: "blink.sv" } },
  }),
}))

let mockIsAnonMode = false
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: mockIsAnonMode }),
}))

const mockUseSettingsScreenQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  useSettingsScreenQuery: (...args: unknown[]) => mockUseSettingsScreenQuery(...args),
}))

let mockCurrentLevel = "One"
jest.mock("@app/graphql/level-context", () => ({
  AccountLevel: { NonAuth: "NonAuth", One: "One" },
  useLevel: () => ({ currentLevel: mockCurrentLevel }),
}))

import { AccountBannerVertical } from "@app/screens/settings-screen/account/banner-vertical"

loadLocale("en")
const LL = i18nObject("en")

const renderBanner = () =>
  render(
    <ThemeProvider>
      <TypesafeI18n locale="en">
        <AccountBannerVertical />
      </TypesafeI18n>
    </ThemeProvider>,
  )

describe("AccountBannerVertical (self-custodial)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveAccountType = "self-custodial"
    mockLightningAddress = "satoshi@blink.sv"
    mockIsAnonMode = false
    mockCurrentLevel = "One"
    mockUseSettingsScreenQuery.mockReturnValue({ data: undefined, loading: false })
  })

  it("shows the address bare outside Incognito", () => {
    const { getByText } = renderBanner()

    expect(getByText("satoshi@blink.sv")).toBeTruthy()
  })

  /** The settings row and the horizontal banner both label a withheld address; this
   *  screen presenting it as usable is the contradiction the label exists to prevent. */
  it("marks the address disabled in Incognito", () => {
    mockIsAnonMode = true

    const { getByText, queryByText } = renderBanner()

    expect(
      getByText(`satoshi@blink.sv ${LL.SettingsScreen.addressDisabled()}`),
    ).toBeTruthy()
    expect(queryByText("satoshi@blink.sv")).toBeNull()
  })

  /** Nothing to disable, so the suffix must not appear on its own. */
  it("shows no address line at all in Incognito when none is registered", () => {
    mockLightningAddress = null
    mockIsAnonMode = true

    const { getByText, queryByText } = renderBanner()

    expect(getByText(LL.SettingsScreen.nonCustodialAccount())).toBeTruthy()
    expect(queryByText(LL.SettingsScreen.addressDisabled(), { exact: false })).toBeNull()
  })
})
