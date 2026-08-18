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

/** Rendered by name so a missing copy affordance is an absent node, not a styled one. */
jest.mock("@app/components/atomic/galoy-icon", () => {
  const { View } = jest.requireActual("react-native")
  return {
    GaloyIcon: ({ name }: { name: string }) => <View testID={`galoy-icon-${name}`} />,
  }
})

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
    mockIsAuthed = false
    mockCurrentLevel = "NonAuth"
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

  it("offers the copy affordance and no suffix outside Incognito", () => {
    const { getByText, queryByTestId } = renderBanner()

    expect(getByText("satoshi@blink.sv")).toBeTruthy()
    expect(queryByTestId("galoy-icon-copy-paste")).toBeTruthy()
  })

  /** Incognito cannot receive, so the address reads as disabled and loses the copy icon
   *  rather than being offered as one that could be paid. */
  it("marks the address disabled and drops the copy icon in Incognito", () => {
    mockIsAnonMode = true

    const { getByText, queryByTestId } = renderBanner()

    expect(
      getByText(`satoshi@blink.sv ${LL.SettingsScreen.addressDisabled()}`),
    ).toBeTruthy()
    expect(queryByTestId("galoy-icon-copy-paste")).toBeNull()
  })

  /** The row must not keep copying behind a label that says it cannot receive. */
  it("does not copy on tap in Incognito", () => {
    mockIsAnonMode = true

    const { getByText } = renderBanner()

    fireEvent.press(getByText(`satoshi@blink.sv ${LL.SettingsScreen.addressDisabled()}`))

    expect(mockCopyToClipboard).not.toHaveBeenCalled()
  })

  it("renders nothing without a lightning address", () => {
    mockLightningAddress = null

    const { toJSON } = renderBanner()

    expect(toJSON()).toBeNull()
  })
})
