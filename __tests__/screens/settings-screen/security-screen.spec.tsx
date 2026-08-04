import React from "react"
import { fireEvent, render, waitFor } from "@testing-library/react-native"
import { ThemeProvider } from "@rn-vui/themed"

import { SecurityScreen } from "@app/screens/settings-screen/security-screen"
import theme from "@app/rne-theme/theme"
import { AccountType } from "@app/types/wallet"

const mockActiveAccount = jest.fn()
const mockBackupState = jest.fn()
const mockNavigate = jest.fn()
const mockIsAtLeastLevelOne = jest.fn()
const mockSettingsData = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount() }),
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  ...jest.requireActual("@app/self-custodial/providers/backup-state"),
  useBackupState: () => ({ backupState: mockBackupState() }),
}))

jest.mock("@app/graphql/generated", () => ({
  useHideBalanceQuery: () => ({ data: { hideBalance: false } }),
  useSettingsScreenQuery: () => ({ data: mockSettingsData() }),
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => true,
}))

jest.mock("@app/graphql/level-context", () => ({
  useLevel: () => ({ isAtLeastLevelOne: mockIsAtLeastLevelOne() }),
}))

jest.mock("@apollo/client", () => ({
  useApolloClient: () => ({}),
}))

jest.mock("@app/graphql/client-only-query", () => ({
  saveHideBalance: jest.fn(),
  saveHiddenBalanceToolTip: jest.fn(),
}))

jest.mock("@app/components/atomic/switch", () => ({
  Switch: () => null,
}))

jest.mock("@app/utils/biometricAuthentication", () => ({
  __esModule: true,
  default: {
    isSensorAvailable: jest.fn().mockResolvedValue(false),
    authenticate: jest.fn(),
  },
}))

jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    getIsBiometricsEnabled: jest.fn().mockResolvedValue(false),
    getIsPinEnabled: jest.fn().mockResolvedValue(false),
  },
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: jest.fn(),
}))

jest.mock("@app/components/screen", () => ({
  Screen: ({ children }: { children: React.ReactNode }) =>
    jest.requireActual("react").createElement("View", null, children),
}))

jest.mock("@app/i18n/i18n-react", () => ({
  useI18nContext: () => ({
    LL: {
      AuthenticationScreen: {
        setUpAuthenticationDescription: () => "Set up authentication",
      },
      SecurityScreen: {
        biometricTitle: () => "Biometric",
        biometricDescription: () => "Unlock with fingerprint or facial recognition.",
        hideBalanceTitle: () => "Always hide balance",
        pinTitle: () => "PIN code",
        pinDescription: () => "Set a 4-digit numerical PIN to unlock",
        securityScore: {
          title: ({ done, total }: { done: number; total: number }) =>
            `Security score ${done}/${total}`,
          levelLow: () => "low",
          levelMedium: () => "medium",
          levelHigh: () => "high",
          set: () => "Set",
          enabled: () => "Enabled",
          signals: {
            cloudBackup: () => "Cloud backup",
            manualBackup: () => "Manual backup",
            appLock: () => "App lock (biometrics or PIN)",
            hideBalance: () => "Hide balance",
            twoFactor: () => "Two-factor authentication (2FA)",
            emailVerified: () => "Verified email",
          },
        },
      },
    },
  }),
}))

/* eslint-disable @typescript-eslint/no-explicit-any */
const renderScreen = () =>
  render(
    <ThemeProvider theme={theme}>
      <SecurityScreen
        navigation={{ navigate: mockNavigate } as any}
        route={{ params: { mIsBiometricsEnabled: false, mIsPinEnabled: false } } as any}
      />
    </ThemeProvider>,
  )
/* eslint-enable @typescript-eslint/no-explicit-any */

describe("SecurityScreen security score card", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockActiveAccount.mockReturnValue({ type: AccountType.SelfCustodial })
    mockBackupState.mockReturnValue({ status: "none", method: null })
    mockIsAtLeastLevelOne.mockReturnValue(true)
    mockSettingsData.mockReturnValue({
      me: { totpEnabled: false, email: { address: null, verified: false } },
    })
  })

  it("shows the card for a self-custodial account", () => {
    const { getByTestId } = renderScreen()

    expect(getByTestId("security-score-card")).toBeTruthy()
  })

  it("shows account signals for a custodial account instead of backup rows", () => {
    mockActiveAccount.mockReturnValue({ type: AccountType.Custodial })

    const { getByTestId, queryByTestId } = renderScreen()

    expect(getByTestId("security-score-twoFactor")).toBeTruthy()
    expect(getByTestId("security-score-emailVerified")).toBeTruthy()
    expect(queryByTestId("security-score-cloudBackup")).toBeNull()
  })

  it("shows only device signals for a level-0 custodial account", () => {
    mockActiveAccount.mockReturnValue({ type: AccountType.Custodial })
    mockIsAtLeastLevelOne.mockReturnValue(false)

    const { getByTestId, queryByTestId } = renderScreen()

    expect(getByTestId("security-score-appLock")).toBeTruthy()
    expect(getByTestId("security-score-hideBalance")).toBeTruthy()
    expect(queryByTestId("security-score-twoFactor")).toBeNull()
    expect(queryByTestId("security-score-emailVerified")).toBeNull()
  })

  it("routes the 2FA signal to TOTP registration", () => {
    mockActiveAccount.mockReturnValue({ type: AccountType.Custodial })

    const { getByTestId } = renderScreen()
    fireEvent.press(getByTestId("security-score-twoFactor"))

    expect(mockNavigate).toHaveBeenCalledWith("totpRegistrationInitiate")
  })

  it("routes the email signal to email registration", () => {
    mockActiveAccount.mockReturnValue({ type: AccountType.Custodial })

    const { getByTestId } = renderScreen()
    fireEvent.press(getByTestId("security-score-emailVerified"))

    expect(mockNavigate).toHaveBeenCalledWith("emailRegistrationInitiate")
  })

  it("routes the cloud-backup signal straight to the cloud backup screen", () => {
    const { getByTestId } = renderScreen()

    fireEvent.press(getByTestId("security-score-cloudBackup"))

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialCloudBackup")
  })

  it("routes the manual-backup signal to the manual backup chain", () => {
    const { getByTestId } = renderScreen()

    fireEvent.press(getByTestId("security-score-manualBackup"))

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialBackupSecurityChecks")
  })

  it("routes the app-lock signal into the existing biometric enrollment flow", async () => {
    const BiometricWrapper = jest.requireMock(
      "@app/utils/biometricAuthentication",
    ).default
    BiometricWrapper.isSensorAvailable.mockResolvedValue(true)

    const { getByTestId } = renderScreen()

    fireEvent.press(getByTestId("security-score-appLock"))

    await waitFor(() => expect(BiometricWrapper.authenticate).toHaveBeenCalled())
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("turns hide balance on in place from its Set row", () => {
    const { saveHideBalance } = jest.requireMock("@app/graphql/client-only-query")

    const { getByTestId } = renderScreen()

    fireEvent.press(getByTestId("security-score-hideBalance"))

    expect(saveHideBalance).toHaveBeenCalledWith(expect.anything(), true)
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it("keeps a completed backup signal tappable so the flow can be re-run (#3828)", () => {
    mockBackupState.mockReturnValue({
      status: "completed",
      method: "cloud",
      completedMethods: ["cloud"],
    })

    const { getByTestId } = renderScreen()

    fireEvent.press(getByTestId("security-score-cloudBackup"))

    expect(mockNavigate).toHaveBeenCalledWith("selfCustodialCloudBackup")
  })
})
