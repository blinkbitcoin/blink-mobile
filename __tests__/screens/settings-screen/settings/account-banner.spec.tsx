import React from "react"
import fs from "fs"
import path from "path"
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

  it("falls back to Blink User with a Custodial account subtitle when no username is set", () => {
    render(<AccountBanner />)

    expect(screen.getByText("Blink User")).toBeTruthy()
    expect(screen.getByText("Custodial account")).toBeTruthy()
  })

  it("keeps the logged-out state single-line and hides the custody label", () => {
    mockCurrentLevel = "NonAuth"

    render(<AccountBanner />)

    expect(screen.getByText("Log in or create account")).toBeTruthy()
    expect(screen.queryByText("Custodial account")).toBeNull()
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
