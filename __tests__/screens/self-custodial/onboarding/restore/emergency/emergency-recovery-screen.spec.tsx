import React from "react"

import { fireEvent, render, screen } from "@testing-library/react-native"

import { loadLocale } from "@app/i18n/i18n-util.sync"
import { i18nObject } from "@app/i18n/i18n-util"
import type { TranslationFunctions } from "@app/i18n/i18n-types"
import { EmergencyRecoveryScreen } from "@app/screens/self-custodial/onboarding/restore/emergency/emergency-recovery-screen"
import { EmergencyRecoveryStep } from "@app/screens/self-custodial/onboarding/restore/emergency/hooks/use-emergency-recovery"
import { EmergencyBundleRejection } from "@app/self-custodial/recovery-bundle/emergency-recovery"
import { RECOVERY_BUNDLE_SCHEMA } from "@app/self-custodial/recovery-bundle/types"

import { ContextForScreen } from "../../../../helper"

let LL: TranslationFunctions

const MNEMONIC = "abandon abandon about"

const mockNavigate = jest.fn()

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useRoute: () => ({ params: { mnemonic: MNEMONIC } }),
  useNavigation: () => ({ navigate: mockNavigate }),
}))

const verified = {
  bundle: {
    schema: RECOVERY_BUNDLE_SCHEMA,
    createdAt: "2026-08-05T10:00:00.000Z",
    network: "REGTEST",
    operatorSet: "regtest",
    walletIdentityPublicKey: "02aa",
    sparkSdkVersion: "1.0.0",
    appVersion: "5.0.0",
    leaves: [
      { id: "a", status: "AVAILABLE", valueSats: 20000, treeNodeHex: "aa" },
      { id: "b", status: "AVAILABLE", valueSats: 1000, treeNodeHex: "bb" },
    ],
    nodes: [],
    balances: {
      btcSats: "21000",
      usdb: { amount: "0", status: "not-covered-by-bitcoin-unilateral-exit" },
    },
  },
  metadata: {
    network: "REGTEST",
    walletIdentityPublicKey: "02aa",
    bundleCreatedAt: "2026-08-05T10:00:00.000Z",
  },
  payload: "{}",
}

const flow = {
  step: EmergencyRecoveryStep.Verifying as EmergencyRecoveryStep,
  rejection: null as EmergencyBundleRejection | null,
  verified: null as typeof verified | null,
  busy: false,
  fromCloud: jest.fn(),
  fromClipboard: jest.fn(),
  fromFile: jest.fn(),
  tryAnotherSource: jest.fn(),
  exportBundle: jest.fn(),
}

jest.mock(
  "@app/screens/self-custodial/onboarding/restore/emergency/hooks/use-emergency-recovery",
  () => ({
    ...jest.requireActual(
      "@app/screens/self-custodial/onboarding/restore/emergency/hooks/use-emergency-recovery",
    ),
    useEmergencyRecovery: () => flow,
  }),
)

const renderScreen = () =>
  render(
    <ContextForScreen>
      <EmergencyRecoveryScreen />
    </ContextForScreen>,
  )

describe("EmergencyRecoveryScreen", () => {
  beforeAll(() => {
    loadLocale("en")
    LL = i18nObject("en")
  })

  beforeEach(() => {
    jest.clearAllMocks()
    flow.step = EmergencyRecoveryStep.Verifying
    flow.rejection = null
    flow.verified = null
    flow.busy = false
  })

  const t = () => LL.EmergencyRecovery

  it("shows the check in progress, with nothing to tap", () => {
    renderScreen()

    expect(screen.getByTestId("bundle-verifying-view")).toBeTruthy()
    expect(screen.getByText(t().verifying())).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
  })

  describe("asking where the bundle is", () => {
    beforeEach(() => {
      flow.step = EmergencyRecoveryStep.Sources
    })

    it("offers all three places a bundle is kept", () => {
      renderScreen()

      expect(screen.getByTestId("bundle-source-cloud")).toBeTruthy()
      expect(screen.getByText(t().fromPasswordManager())).toBeTruthy()
      expect(screen.getByText(t().fromFile())).toBeTruthy()
    })

    it("wires each one to its own source", () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-source-cloud"))
      expect(flow.fromCloud).toHaveBeenCalled()

      fireEvent.press(screen.getByTestId("bundle-source-clipboard"))
      expect(flow.fromClipboard).toHaveBeenCalled()

      fireEvent.press(screen.getByTestId("bundle-source-file"))
      expect(flow.fromFile).toHaveBeenCalled()
    })

    it("closes the buttons while one attempt is running", () => {
      // Two overlapping attempts land the user on whichever verdict finished
      // last, which need not be the one they asked for.
      flow.busy = true
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-source-clipboard"))
      expect(flow.fromClipboard).not.toHaveBeenCalled()
    })

    it("links to support for help", () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-source-help"))
      expect(mockNavigate).toHaveBeenCalledWith("onboarding", {
        screen: "supportScreen",
      })
    })
  })

  describe("a bundle that did not check out", () => {
    it("blames the phrase when a real bundle would not decrypt", () => {
      flow.step = EmergencyRecoveryStep.Rejected
      flow.rejection = EmergencyBundleRejection.WrongPhrase
      renderScreen()

      expect(screen.getByText(t().rejectedTitle())).toBeTruthy()
      expect(screen.getByText(t().rejectedWrongPhrase())).toBeTruthy()
    })

    it("blames the file when it was never a bundle", () => {
      // Sending this user to re-check a phrase that is fine wastes the one
      // thing they are short of.
      flow.step = EmergencyRecoveryStep.Rejected
      flow.rejection = EmergencyBundleRejection.NotABundle
      renderScreen()

      expect(screen.getByText(t().rejectedNotABundle())).toBeTruthy()
      expect(screen.queryByText(t().rejectedWrongPhrase())).toBeNull()
    })

    it("goes back to the sources on try-again", () => {
      flow.step = EmergencyRecoveryStep.Rejected
      flow.rejection = EmergencyBundleRejection.WrongPhrase
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-rejected-try-again"))
      expect(flow.tryAnotherSource).toHaveBeenCalled()
    })

    it("leaves for another wallet on restore-other", () => {
      flow.step = EmergencyRecoveryStep.Rejected
      flow.rejection = EmergencyBundleRejection.WrongPhrase
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-rejected-restore-other"))
      expect(mockNavigate).toHaveBeenCalledWith("selfCustodialRestoreMethod")
    })

    it("links to support for help", () => {
      flow.step = EmergencyRecoveryStep.Rejected
      flow.rejection = EmergencyBundleRejection.WrongPhrase
      renderScreen()

      fireEvent.press(screen.getByTestId("bundle-rejected-help"))
      expect(mockNavigate).toHaveBeenCalledWith("onboarding", {
        screen: "supportScreen",
      })
    })

    it("keeps checking rather than showing an empty verdict", () => {
      // Rejected without a reason has nothing honest to say; the flow sets both
      // together, so this only guards the render.
      flow.step = EmergencyRecoveryStep.Rejected
      flow.rejection = null
      renderScreen()

      expect(screen.getByTestId("bundle-verifying-view")).toBeTruthy()
    })
  })

  it("confirms a verified bundle with nothing to tap", () => {
    flow.step = EmergencyRecoveryStep.Verified
    renderScreen()

    expect(screen.getByTestId("bundle-verified-view")).toBeTruthy()
    expect(screen.getByText(t().verified())).toBeTruthy()
    expect(screen.queryByRole("button")).toBeNull()
  })

  describe("the summary", () => {
    beforeEach(() => {
      flow.step = EmergencyRecoveryStep.Summary
      flow.verified = verified
    })

    it("says what the bundle covers", () => {
      renderScreen()

      expect(screen.getByText(t().summaryTitle())).toBeTruthy()
      expect(screen.getByText("21,000 sats")).toBeTruthy()
      expect(screen.getByText("2")).toBeTruthy()
    })

    it("does not claim the exit has happened", () => {
      // The app cannot broadcast it; a green tick alone would read as "your
      // funds are on their way back".
      renderScreen()

      expect(screen.getByText(t().summaryBody())).toBeTruthy()
      expect(screen.getByText(t().summarySupport())).toBeTruthy()
    })

    it("offers the bundle as a file", () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("summary-export-button"))
      expect(flow.exportBundle).toHaveBeenCalled()
    })

    it("shows an unparseable creation date as it stands", () => {
      flow.verified = {
        ...verified,
        metadata: { ...verified.metadata, bundleCreatedAt: "sometime" },
      }
      renderScreen()

      expect(screen.getByText("sometime")).toBeTruthy()
    })

    it("links to support", () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("summary-support-button"))
      expect(mockNavigate).toHaveBeenCalledWith("onboarding", {
        screen: "supportScreen",
      })
    })

    it("leaves the flow on close", () => {
      renderScreen()

      fireEvent.press(screen.getByTestId("summary-close-button"))
      expect(mockNavigate).toHaveBeenCalledWith("selfCustodialRestoreMethod")
    })

    it("keeps checking rather than showing an empty summary", () => {
      flow.verified = null
      renderScreen()

      expect(screen.getByTestId("bundle-verifying-view")).toBeTruthy()
    })
  })
})
