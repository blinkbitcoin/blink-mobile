import React from "react"
import { fireEvent, render, screen } from "@testing-library/react-native"

import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { TotpSetting } from "@app/screens/settings-screen/totp"
import { AccountType } from "@app/types/wallet"

import { flushEffects } from "../../helpers/flush-effects"
import { ContextForScreen } from "../helper"

jest.mock("react-native-modal", () =>
  jest.requireActual("@mocks/react-native-modal-mock"),
)

const mockNavigate = jest.fn()
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

let mockAccountType: string = AccountType.Custodial
jest.mock("@app/hooks/use-account-registry", () => ({
  ...jest.requireActual("@app/hooks/use-account-registry"),
  useAccountRegistry: () => ({ activeAccount: { type: mockAccountType } }),
}))

let mockTotpEnabled = true
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useSettingsScreenQuery: () => ({
    data: { me: { totpEnabled: mockTotpEnabled } },
    loading: false,
  }),
}))

let mockIsTurnOffBlocked = false
let mockIsTurnOffDecided = true
const mockReportAttempt = jest.fn()
const mockReportBlocked = jest.fn()
jest.mock("@app/custodial/hooks/use-two-factor-turn-off", () => ({
  useTwoFactorTurnOff: () => ({
    isTurnOffBlocked: mockIsTurnOffBlocked,
    isTurnOffDecided: mockIsTurnOffDecided,
    reportAttempt: mockReportAttempt,
    reportBlocked: mockReportBlocked,
  }),
}))

jest.mock("@app/hooks/use-contact-support", () => ({
  useContactSupport: () => ({ openSupport: jest.fn() }),
}))

loadLocale("en")
const LL = i18nObject("en")

const renderRow = async () => {
  render(
    <ContextForScreen>
      <TotpSetting />
    </ContextForScreen>,
  )
  await flushEffects()
}

/** The X the row draws where the other rows have their arrow. */
const closeIcons = () => screen.UNSAFE_queryAllByProps({ name: "close" })

const pressTurnOff = () =>
  fireEvent.press(screen.getByText(LL.TwoFactorTurnOff.statusEnabled()))

describe("TotpSetting", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockAccountType = AccountType.Custodial
    mockTotpEnabled = true
    mockIsTurnOffBlocked = false
    mockIsTurnOffDecided = true
  })

  it("says the authenticator is on, with a way to turn it off", async () => {
    await renderRow()

    expect(screen.getByText(LL.TwoFactorTurnOff.statusEnabled())).toBeTruthy()
    expect(closeIcons().length).toBeGreaterThan(0)
  })

  it("says it is off, and opens the setup key from the row", async () => {
    mockTotpEnabled = false
    await renderRow()

    fireEvent.press(screen.getByText(LL.TwoFactorTurnOff.statusDisabled()))

    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationInitiate")
    expect(closeIcons()).toHaveLength(0)
  })

  /** A tier-three account must not be offered the recommendation while its tier is
   *  still being read. */
  it("offers no way to turn it off until the tier reached is known", async () => {
    mockIsTurnOffDecided = false
    await renderRow()

    expect(closeIcons()).toHaveLength(0)
    expect(screen.queryByText(LL.TwoFactorTurnOff.statusEnabled())).toBeNull()
  })

  it("is not there for a self-custodial account", async () => {
    mockAccountType = AccountType.SelfCustodial
    await renderRow()

    expect(screen.queryByText(LL.TwoFactorTurnOff.statusEnabled())).toBeNull()
  })

  describe("where the authenticator is not mandatory", () => {
    it("recommends keeping it, and reports the attempt", async () => {
      await renderRow()

      pressTurnOff()

      expect(screen.getByText(LL.TwoFactorTurnOff.modalTitle())).toBeTruthy()
      expect(mockReportAttempt).toHaveBeenCalledTimes(1)
      expect(mockReportBlocked).not.toHaveBeenCalled()
    })

    it("keeps it from Keep me protected", async () => {
      await renderRow()
      pressTurnOff()

      fireEvent.press(screen.getByText(LL.TwoFactorTurnOff.keepProtected()))

      expect(screen.queryByText(LL.TwoFactorTurnOff.modalTitle())).toBeNull()
      expect(mockNavigate).not.toHaveBeenCalled()
    })

    /** Opened once the modal is off the screen, so its field takes the focus. */
    it("goes on to the code from Continue, once the modal is down", async () => {
      await renderRow()
      pressTurnOff()

      fireEvent.press(screen.getByText(LL.common.continue()))
      await flushEffects()

      expect(screen.queryByText(LL.TwoFactorTurnOff.modalTitle())).toBeNull()
      expect(mockNavigate).toHaveBeenCalledTimes(1)
      expect(mockNavigate).toHaveBeenCalledWith("totpDeleteValidate")
    })

    it("opens nothing once the modal is down from Keep me protected", async () => {
      await renderRow()
      pressTurnOff()

      fireEvent.press(screen.getByText(LL.TwoFactorTurnOff.keepProtected()))
      await flushEffects()

      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })

  describe("where the authenticator is mandatory", () => {
    beforeEach(() => {
      mockIsTurnOffBlocked = true
    })

    it("points to support instead, and reports the attempt as blocked", async () => {
      await renderRow()

      pressTurnOff()

      expect(screen.getByText(LL.TwoFactorTurnOff.manualResetTitle())).toBeTruthy()
      expect(screen.queryByText(LL.TwoFactorTurnOff.modalTitle())).toBeNull()
      expect(mockReportAttempt).toHaveBeenCalledTimes(1)
      expect(mockReportBlocked).toHaveBeenCalledTimes(1)
    })

    it("closes the sheet from Close, leaving the authenticator on", async () => {
      await renderRow()
      pressTurnOff()

      fireEvent.press(screen.getByText(LL.common.close()))

      expect(screen.queryByText(LL.TwoFactorTurnOff.manualResetTitle())).toBeNull()
      expect(mockNavigate).not.toHaveBeenCalled()
    })
  })
})
