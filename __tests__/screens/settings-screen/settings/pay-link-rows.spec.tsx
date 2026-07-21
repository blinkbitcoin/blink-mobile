import React from "react"
import { it } from "@jest/globals"
import { act, render } from "@testing-library/react-native"
import { Linking } from "react-native"

import { AccountType } from "@app/types/wallet"

const mockSettingsRow = jest.fn((_props: Record<string, unknown>) => null)
jest.mock("@app/screens/settings-screen/row", () => ({
  SettingsRow: mockSettingsRow,
}))

jest.mock("@app/components/atomic/galoy-icon", () => ({
  GaloyIcon: () => null,
}))

jest.mock("phosphor-react-native", () => ({
  QrCodeIcon: () => null,
}))

const mockUseAccountRegistry = jest.fn()
jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => mockUseAccountRegistry(),
}))

const mockUseSelfCustodialWallet = jest.fn()
jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => mockUseSelfCustodialWallet(),
}))

jest.mock("@app/hooks", () => ({
  useAppConfig: () => ({
    appConfig: { galoyInstance: { posUrl: "https://pay.blink.sv" } },
  }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({ useIsAuthed: () => true }))
const mockSettingsScreenQuery = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  useSettingsScreenQuery: () => mockSettingsScreenQuery(),
}))

jest.mock("@rn-vui/themed", () => ({
  useTheme: () => ({ theme: { colors: { primary: "#fc5805", black: "#000" } } }),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      SettingsScreen: {
        pos: () => "Point of Sale",
        staticQr: () => "Printable static QR",
        donationButton: () => "Donation Button",
        btcpayServer: () => "BTCPay Server",
        woocommerce: () => "Woocommerce",
      },
    },
  }),
}))

import { AccountPOS } from "@app/screens/settings-screen/settings/account-pos"
import { AccountStaticQR } from "@app/screens/settings-screen/settings/account-static-qr"
import { AccountDonationButton } from "@app/screens/settings-screen/settings/account-donation-button"
import { AccountBtcpay } from "@app/screens/settings-screen/settings/account-btcpay"
import { AccountWoocommerce } from "@app/screens/settings-screen/settings/account-woocommerce"

const lastRowProps = (): Record<string, unknown> =>
  (mockSettingsRow.mock.calls.at(-1)?.[0] ?? {}) as Record<string, unknown>

const pressRow = () => act(() => (lastRowProps().action as () => void)())

const asCustodial = () => {
  mockUseAccountRegistry.mockReturnValue({
    activeAccount: { id: "cust-1", type: AccountType.Custodial },
    selfCustodialEntries: [],
  })
  mockSettingsScreenQuery.mockReturnValue({
    data: { me: { username: "bob" } },
    loading: false,
  })
}

const asSelfCustodial = () => {
  mockUseAccountRegistry.mockReturnValue({
    activeAccount: { id: "sc-1", type: AccountType.SelfCustodial },
    selfCustodialEntries: [],
  })
  mockUseSelfCustodialWallet.mockReturnValue({
    lightningAddress: "alice@staging.blink.sv",
  })
}

describe("ways to get paid rows", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(Linking, "openURL").mockResolvedValue(true)
    mockSettingsScreenQuery.mockReturnValue({ data: undefined, loading: false })
    mockUseSelfCustodialWallet.mockReturnValue({ lightningAddress: null })
  })

  describe("custodial links use the galoy pay server and account username", () => {
    beforeEach(asCustodial)

    it("POS", () => {
      render(<AccountPOS />)
      pressRow()
      expect(Linking.openURL).toHaveBeenCalledWith("https://pay.blink.sv/bob")
    })

    it("printable QR", () => {
      render(<AccountStaticQR />)
      pressRow()
      expect(Linking.openURL).toHaveBeenCalledWith("https://pay.blink.sv/bob/print")
    })

    it("donation button", () => {
      render(<AccountDonationButton />)
      pressRow()
      expect(Linking.openURL).toHaveBeenCalledWith("https://donation-button.blink.sv/bob")
    })
  })

  describe("self-custodial links use the terminal and the lightning address username", () => {
    beforeEach(asSelfCustodial)

    it("POS", () => {
      render(<AccountPOS />)
      pressRow()
      expect(Linking.openURL).toHaveBeenCalledWith("https://terminal.blinkbtc.com/alice")
    })

    it("printable QR", () => {
      render(<AccountStaticQR />)
      pressRow()
      expect(Linking.openURL).toHaveBeenCalledWith(
        "https://terminal.blinkbtc.com/alice/print",
      )
    })

    it("donation button", () => {
      render(<AccountDonationButton />)
      pressRow()
      expect(Linking.openURL).toHaveBeenCalledWith(
        "https://donation-button.blink.sv/alice",
      )
    })

    it("does not fall back to the custodial username when no address is registered", () => {
      mockUseSelfCustodialWallet.mockReturnValue({ lightningAddress: null })
      mockSettingsScreenQuery.mockReturnValue({
        data: { me: { username: "bob" } },
        loading: false,
      })

      render(
        <>
          <AccountPOS />
          <AccountStaticQR />
          <AccountDonationButton />
        </>,
      )

      expect(mockSettingsRow).not.toHaveBeenCalled()
    })
  })

  describe("plugin rows open a static page in both modes", () => {
    it.each([
      {
        name: "BTCPay Server",
        make: () => <AccountBtcpay />,
        url: "https://www.blink.sv/en/btcpay-blink-plugin",
      },
      {
        name: "Woocommerce",
        make: () => <AccountWoocommerce />,
        url: "https://www.blink.sv/en/woocommerce",
      },
    ])("$name", ({ make, url }) => {
      asCustodial()
      render(make())
      pressRow()
      expect(Linking.openURL).toHaveBeenCalledWith(url)

      jest.clearAllMocks()
      jest.spyOn(Linking, "openURL").mockResolvedValue(true)

      asSelfCustodial()
      render(make())
      pressRow()
      expect(Linking.openURL).toHaveBeenCalledWith(url)
    })

    it.each([
      { name: "BTCPay Server", make: () => <AccountBtcpay /> },
      { name: "Woocommerce", make: () => <AccountWoocommerce /> },
    ])("$name stays hidden until the account has a username", ({ make }) => {
      mockUseAccountRegistry.mockReturnValue({
        activeAccount: { id: "cust-1", type: AccountType.Custodial },
        selfCustodialEntries: [],
      })
      mockSettingsScreenQuery.mockReturnValue({
        data: { me: { username: null } },
        loading: false,
      })

      render(make())

      expect(mockSettingsRow).not.toHaveBeenCalled()
    })
  })
})
