import React from "react"

import { fireEvent, render } from "@testing-library/react-native"
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

const mockNavigationReset = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ reset: mockNavigationReset }),
}))

let mockLightningAddress: string | null = "satoshi@blink.sv"
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ lightningAddress: mockLightningAddress }),
}))

const mockCopyToClipboard = jest.fn()
jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { lnAddressHostname: "blink.sv" } },
  }),
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

let mockIsAnonMode = false
jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: mockIsAnonMode }),
}))

const mockPromptEnhancedMode = jest.fn()
jest.mock("@app/components/enhanced-mode-prompt", () => ({
  useEnhancedModePrompt: () => ({ promptEnhancedMode: mockPromptEnhancedMode }),
}))

let mockIsRestrictedRegion = false
const mockPresentRestrictedRegionModal = jest.fn()
jest.mock("@app/components/restricted-region", () => ({
  useRestrictedRegion: () => ({
    isRestrictedRegion: mockIsRestrictedRegion,
    isRestrictedRegionModalVisible: false,
    presentRestrictedRegionModal: mockPresentRestrictedRegionModal,
  }),
}))

const mockUseSettingsScreenQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  useSettingsScreenQuery: (...args: unknown[]) => mockUseSettingsScreenQuery(...args),
  AccountLevel: { NonAuth: "NonAuth", One: "One" },
}))

let mockIsAuthed = false
jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => mockIsAuthed,
}))

let mockCurrentLevel = "NonAuth"
jest.mock("@app/graphql/level-context", () => ({
  AccountLevel: { NonAuth: "NonAuth", One: "One" },
  useLevel: () => ({ currentLevel: mockCurrentLevel }),
}))

import { AccountBanner } from "@app/screens/settings-screen/account/banner"

loadLocale("en")
const LL = i18nObject("en")

const renderBanner = () =>
  render(
    <ThemeProvider>
      <TypesafeI18n locale="en">
        <AccountBanner />
      </TypesafeI18n>
    </ThemeProvider>,
  )

describe("SelfCustodialAccountBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveAccountType = "self-custodial"
    mockLightningAddress = "satoshi@blink.sv"
    mockIsAnonMode = false
    mockIsRestrictedRegion = false
    mockUseSettingsScreenQuery.mockReturnValue({ data: undefined, loading: false })
  })

  it("copies the lightning address on tap", () => {
    const { getByText } = renderBanner()

    fireEvent.press(getByText("satoshi@blink.sv"))

    expect(mockCopyToClipboard).toHaveBeenCalledWith({
      content: "satoshi@blink.sv",
      message: LL.GaloyAddressScreen.copiedLightningAddressToClipboard(),
    })
  })

  /** Incognito drops the copy affordance outright, rather than dimming it: the address
   *  cannot receive at all there, so there is nothing worth copying. A restricted region
   *  only dims it, since that same address pays again once the user leaves. */
  it("prompts Enhanced Mode instead of copying in Incognito", () => {
    mockIsAnonMode = true

    const { getByText, queryByTestId } = renderBanner()

    fireEvent.press(getByText(`satoshi@blink.sv ${LL.SettingsScreen.addressDisabled()}`))

    expect(mockPromptEnhancedMode).toHaveBeenCalledTimes(1)
    expect(mockCopyToClipboard).not.toHaveBeenCalled()
    expect(queryByTestId("account-banner-copy")).toBeNull()
  })

  it("marks the address disabled in Incognito", () => {
    mockIsAnonMode = true

    const { getByText } = renderBanner()

    expect(
      getByText(`satoshi@blink.sv ${LL.SettingsScreen.addressDisabled()}`),
    ).toBeTruthy()
  })

  it("opens the restricted-region modal instead of copying while restricted", () => {
    mockIsRestrictedRegion = true

    const { getByText, getByTestId } = renderBanner()

    fireEvent.press(getByText("satoshi@blink.sv"))

    expect(mockPresentRestrictedRegionModal).toHaveBeenCalledTimes(1)
    expect(mockPromptEnhancedMode).not.toHaveBeenCalled()
    expect(mockCopyToClipboard).not.toHaveBeenCalled()
    expect(getByTestId("account-banner-copy").props.style).toEqual({ opacity: 0.5 })
  })

  it("keeps the copy icon at full opacity when nothing gates it", () => {
    const { getByTestId } = renderBanner()

    expect(getByTestId("account-banner-copy").props.style).toBeFalsy()
  })

  it("leaves the prompt alone outside Incognito", () => {
    const { getByText } = renderBanner()

    fireEvent.press(getByText("satoshi@blink.sv"))

    expect(mockPromptEnhancedMode).not.toHaveBeenCalled()
  })

  it("renders nothing without a lightning address", () => {
    mockLightningAddress = null

    const { toJSON } = renderBanner()

    expect(toJSON()).toBeNull()
  })
})

describe("CustodialAccountBanner", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveAccountType = "custodial"
    mockIsAuthed = true
    mockCurrentLevel = "One"
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { username: "test1" } },
      loading: false,
    })
  })

  it("shows the lightning address for a logged-in user with a username", () => {
    const { getByText } = renderBanner()

    expect(getByText("test1@blink.sv")).toBeTruthy()
  })

  it("falls back to the generic user label without a username", () => {
    mockUseSettingsScreenQuery.mockReturnValue({
      data: { me: { username: null } },
      loading: false,
    })

    const { getByText } = renderBanner()

    expect(getByText(LL.common.blinkUser())).toBeTruthy()
  })

  it("offers login and resets to get-started when logged out", () => {
    mockIsAuthed = false
    mockCurrentLevel = "NonAuth"
    mockUseSettingsScreenQuery.mockReturnValue({ data: undefined, loading: false })

    const { getByText } = renderBanner()

    fireEvent.press(getByText(LL.SettingsScreen.logInOrCreateAccount()))

    expect(mockNavigationReset).toHaveBeenCalledWith({
      index: 0,
      routes: [{ name: "getStarted" }],
    })
  })

  it("does not reset navigation when a logged-in user taps the banner", () => {
    const { getByText } = renderBanner()

    fireEvent.press(getByText("test1@blink.sv"))

    expect(mockNavigationReset).not.toHaveBeenCalled()
  })

  it("shows a skeleton while the query loads", () => {
    mockUseSettingsScreenQuery.mockReturnValue({ data: undefined, loading: true })

    const { queryByText, toJSON } = renderBanner()

    expect(queryByText(LL.common.blinkUser())).toBeNull()
    expect(toJSON()).not.toBeNull()
  })
})
