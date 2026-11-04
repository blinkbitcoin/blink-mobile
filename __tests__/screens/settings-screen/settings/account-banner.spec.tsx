import React from "react"
import fs from "fs"
import path from "path"
import { StyleSheet } from "react-native"
import { ReactTestInstance } from "react-test-renderer"
import { render, screen } from "@testing-library/react-native"

import { AccountType } from "@app/types/wallet"

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

const mockUseAccountRegistry = jest.fn()
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

const mockUseSelfCustodialWallet = jest.fn()
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

jest.mock("@app/self-custodial/hooks/use-self-custodial-account-mode", () => ({
  useSelfCustodialAccountMode: () => ({ isAnonMode: false }),
}))

jest.mock("@app/components/enhanced-mode-prompt", () => ({
  useEnhancedModePrompt: () => ({ promptEnhancedMode: jest.fn() }),
}))

jest.mock("@app/components/restricted-region", () => ({
  useRestrictedRegion: () => ({
    isRestrictedRegion: false,
    isRestrictedRegionModalVisible: false,
    presentRestrictedRegionModal: jest.fn(),
  }),
}))

const mockCopyToClipboard = jest.fn()
jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { lnAddressHostname: "blink.sv" } },
  }),
  useClipboard: () => ({ copyToClipboard: mockCopyToClipboard }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({ useIsAuthed: () => true }))

const mockSettingsScreenQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  useSettingsScreenQuery: () => mockSettingsScreenQuery(),
}))

let mockCurrentLevel = "ONE"
jest.mock("@app/graphql/level-context", () => ({
  AccountLevel: {
    NonAuth: "NonAuth",
    Zero: "ZERO",
    One: "ONE",
    Two: "TWO",
    Three: "THREE",
  },
  useLevel: () => ({ currentLevel: mockCurrentLevel }),
}))

const mockNavigationReset = jest.fn()
jest.mock("@react-navigation/native", () => ({
  useNavigation: () => ({ reset: mockNavigationReset }),
}))

jest.mock("@rn-vui/themed", () => ({
  ...jest.requireActual("../../../helpers/transaction-detail-mocks").mockThemedText(),
  Skeleton: () => null,
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      common: { blinkUser: () => "Blink User" },
      SettingsScreen: {
        logInOrCreateAccount: () => "Log in or create account",
        nonCustodialAccount: () => "Non-custodial account",
        custodialAccount: () => "Custodial account",
        addressDisabled: () => "Address disabled",
      },
      GaloyAddressScreen: { copiedLightningAddressToClipboard: () => "Copied" },
    },
  }),
}))

import { AccountBanner } from "@app/screens/settings-screen/account/banner"

const TRANSLATIONS_DIR = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "..",
  "app",
  "i18n",
  "raw-i18n",
  "translations",
)

/** The row is the nearest ancestor laid out as one: it is the only flex row in the banner. */
const rowStyleOf = (text: string) => {
  let node: ReactTestInstance | null = screen.getByText(text)
  while (node && StyleSheet.flatten(node.props.style)?.flexDirection !== "row") {
    node = node.parent
  }
  return StyleSheet.flatten(node?.props.style)
}

const setCustodialAccount = (username: string | null) => {
  mockUseAccountRegistry.mockReturnValue({
    activeAccount: { id: "cust-1", type: AccountType.Custodial },
  })
  mockSettingsScreenQuery.mockReturnValue({
    data: username === null ? undefined : { me: { username } },
    loading: false,
  })
}

describe("AccountBanner (custodial)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockCurrentLevel = "ONE"
    mockUseSelfCustodialWallet.mockReturnValue({ lightningAddress: null })
    setCustodialAccount(null)
  })

  it("shows the lightning address with a Custodial account subtitle when logged in with a username", () => {
    setCustodialAccount("alice")

    render(<AccountBanner />)

    expect(screen.getByText("alice@blink.sv")).toBeTruthy()
    expect(screen.getByText("Custodial account")).toBeTruthy()
  })

  it("caps the lightning address to one line with a tail ellipsis, never a middle one", () => {
    setCustodialAccount("alice")

    render(<AccountBanner />)

    const title = screen.getByText("alice@blink.sv")
    expect(title.props.numberOfLines).toBe(1)
    expect(title.props.ellipsizeMode).toBeUndefined()
  })

  it("falls back to Blink User with a Custodial account subtitle when no username is set", () => {
    render(<AccountBanner />)

    expect(screen.getByText("Blink User")).toBeTruthy()
    expect(screen.getByText("Custodial account")).toBeTruthy()
  })

  it("lets the logged-out call to action wrap and hides the custody label", () => {
    mockCurrentLevel = "NonAuth"

    render(<AccountBanner />)

    const title = screen.getByText("Log in or create account")
    expect(title.props.numberOfLines).toBeUndefined()
    expect(title.props.ellipsizeMode).toBeUndefined()
    expect(screen.queryByText("Custodial account")).toBeNull()
  })

  it("keeps 70 as the row's floor so enlarged fonts can grow it", () => {
    setCustodialAccount("alice")

    render(<AccountBanner />)

    const row = rowStyleOf("alice@blink.sv")
    expect(row.minHeight).toBe(70)
    expect(row.height).toBeUndefined()
  })
})

describe("AccountBanner (self-custodial)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockUseAccountRegistry.mockReturnValue({
      activeAccount: { id: "sc-1", type: AccountType.SelfCustodial },
      selfCustodialEntries: [],
    })
    mockUseSelfCustodialWallet.mockReturnValue({ lightningAddress: "alice@blink.sv" })
    mockSettingsScreenQuery.mockReturnValue({ data: undefined, loading: false })
  })

  it("keeps the Non-custodial account subtitle and never shows the custodial one", () => {
    render(<AccountBanner />)

    expect(screen.getByText("alice@blink.sv")).toBeTruthy()
    expect(screen.getByText("Non-custodial account")).toBeTruthy()
    expect(screen.queryByText("Custodial account")).toBeNull()
  })

  it("keeps 70 as the row's floor so enlarged fonts can grow it", () => {
    render(<AccountBanner />)

    const row = rowStyleOf("alice@blink.sv")
    expect(row.minHeight).toBe(70)
    expect(row.height).toBeUndefined()
  })
})

describe("custodialAccount i18n coverage", () => {
  const localeFiles = fs
    .readdirSync(TRANSLATIONS_DIR)
    .filter((name) => name.endsWith(".json"))
    .sort()

  localeFiles.forEach((localeFile) => {
    it(`has SettingsScreen.custodialAccount in ${localeFile}`, () => {
      const parsed = JSON.parse(
        fs.readFileSync(path.join(TRANSLATIONS_DIR, localeFile), "utf8"),
      ) as { SettingsScreen?: Record<string, unknown> }
      expect(parsed.SettingsScreen?.custodialAccount).toBeDefined()
    })
  })
})
