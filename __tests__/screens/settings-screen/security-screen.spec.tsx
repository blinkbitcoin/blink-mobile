import React from "react"
import { Alert, AlertButton } from "react-native"
import { act, fireEvent, render, waitFor } from "@testing-library/react-native"
import type { ReactTestInstance } from "react-test-renderer"
import { ThemeProvider } from "@rn-vui/themed"

import { SecurityScreen } from "@app/screens/settings-screen/security-screen"
import theme from "@app/rne-theme/theme"
import { PersistentStateContext } from "@app/store/persistent-state"
import { PersistentState } from "@app/store/persistent-state/state-migrations"
import { AccountType } from "@app/types/wallet"

const mockActiveAccount = jest.fn()
const mockBackupState = jest.fn()
const mockNavigate = jest.fn()
const mockIsAtLeastLevelOne = jest.fn()
const mockSettingsData = jest.fn()
const mockUseFocusEffect = jest.fn()
const mockGetIsBiometricsEnabled = jest.fn()
const mockGetIsPinEnabled = jest.fn()
const mockRemovePin = jest.fn()
const mockClearPinFailureState = jest.fn()
const mockEmailDelete = jest.fn()
const mockRegistrationInitiate = jest.fn()
const mockUpdateState = jest.fn()
const mockResetState = jest.fn()

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ activeAccount: mockActiveAccount() }),
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  ...jest.requireActual("@app/self-custodial/providers/backup-state"),
  useBackupState: () => ({ backupState: mockBackupState() }),
}))

jest.mock("@app/graphql/generated", () => ({
  useSettingsScreenQuery: () => ({ data: mockSettingsData() }),
  useUserEmailDeleteMutation: () => [mockEmailDelete, { loading: false }],
  useUserEmailRegistrationInitiateMutation: () => [
    mockRegistrationInitiate,
    { loading: false },
  ],
}))

jest.mock("@app/graphql/is-authed-context", () => ({
  useIsAuthed: () => true,
}))

jest.mock("@app/graphql/level-context", () => ({
  useLevel: () => ({ isAtLeastLevelOne: mockIsAtLeastLevelOne() }),
}))

jest.mock("@apollo/client", () => ({
  useApolloClient: () => ({}),
  gql: () => undefined,
}))

/** The real Switch renders, so the hide-balance row can be driven by testID. */
jest.mock("react-native-reanimated", () => {
  const RNView = jest.requireActual<typeof import("react-native")>("react-native").View
  return {
    __esModule: true,
    default: {
      View: RNView,
      createAnimatedComponent: (component: React.ComponentType) => component,
    },
    useSharedValue: (initial: number) => ({ value: initial }),
    useAnimatedStyle: () => ({}),
    withTiming: (value: number) => value,
    interpolateColor: () => "transparent",
    View: RNView,
  }
})

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
    getIsBiometricsEnabled: () => mockGetIsBiometricsEnabled(),
    getIsPinEnabled: () => mockGetIsPinEnabled(),
    removePin: () => mockRemovePin(),
    clearPinFailureState: () => mockClearPinFailureState(),
  },
}))

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useFocusEffect: (callback: () => void) => mockUseFocusEffect(callback),
  useNavigation: () => ({ navigate: mockNavigate }),
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
      AccountScreen: {
        emailUnverified: () => "Email not verified",
        emailUnverifiedContent: () => "Send the code again?",
      },
      common: {
        cancel: () => "Cancel",
        ok: () => "OK",
        switch: () => "switch",
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
            appLock: () => "Biometrics/PIN",
            hideBalance: () => "Hide balance",
            twoFactor: () => "Two-factor authentication (2FA)",
            emailVerified: () => "Verified email",
          },
        },
      },
    },
  }),
}))

const baseState: PersistentState = {
  schemaVersion: 20,
  galoyInstance: { id: "Main" },
  galoyAuthToken: "",
}

/** Declared at module scope so `rerender(screenElement())` re-renders the same
 *  component type and keeps the state the screen has already written. */
const Harness: React.FC<{ initialState: PersistentState }> = ({ initialState }) => {
  const [persistentState, setPersistentState] = React.useState(initialState)

  return (
    <PersistentStateContext.Provider
      value={{
        persistentState,
        updateState: (update) => {
          mockUpdateState(update)
          setPersistentState((prev) => update(prev) ?? prev)
        },
        resetState: mockResetState,
        clearToken: async () => {},
      }}
    >
      {/* eslint-disable @typescript-eslint/no-explicit-any */}
      <ThemeProvider theme={theme}>
        <SecurityScreen
          navigation={{ navigate: mockNavigate } as any}
          route={{ params: { mIsBiometricsEnabled: false, mIsPinEnabled: false } } as any}
        />
      </ThemeProvider>
      {/* eslint-enable @typescript-eslint/no-explicit-any */}
    </PersistentStateContext.Provider>
  )
}

const screenElement = (initialState: PersistentState = baseState) => (
  <Harness initialState={initialState} />
)

const renderScreen = (initialState?: PersistentState) =>
  render(screenElement(initialState))

const hideBalanceChecked = (element: ReactTestInstance): boolean =>
  element.props.accessibilityState.checked

const focusCallbacks = (): (() => void)[] =>
  mockUseFocusEffect.mock.calls.map(([callback]) => callback)

const pressAlertButton = async (label: string) => {
  const [, , buttons] = jest.mocked(Alert.alert).mock.calls[0]
  const button = (buttons as AlertButton[]).find(({ text }) => text === label)

  await button?.onPress?.()
}

const applyDefaultMocks = () => {
  jest.clearAllMocks()
  mockActiveAccount.mockReturnValue({ type: AccountType.SelfCustodial })
  mockBackupState.mockReturnValue({ status: "none", method: null })
  mockIsAtLeastLevelOne.mockReturnValue(true)
  mockSettingsData.mockReturnValue({
    me: { totpEnabled: false, email: { address: null, verified: false } },
  })
  mockGetIsBiometricsEnabled.mockResolvedValue(false)
  mockGetIsPinEnabled.mockResolvedValue(false)
  mockRemovePin.mockResolvedValue(true)
  mockClearPinFailureState.mockResolvedValue(true)
  mockEmailDelete.mockResolvedValue({ data: {} })
  mockRegistrationInitiate.mockResolvedValue({
    data: {
      userEmailRegistrationInitiate: {
        errors: [],
        emailRegistrationId: "registration-id",
      },
    },
  })
  jest.spyOn(Alert, "alert").mockImplementation(() => {})
}

describe("SecurityScreen security score card", () => {
  beforeEach(applyDefaultMocks)

  it("shows the card for a self-custodial account", () => {
    const { getByTestId } = renderScreen()

    expect(getByTestId("security-score-card")).toBeTruthy()
  })

  /** Queries return matches in tree order, so this pins both the toggle order
   *  and the card sitting below all of them. */
  it("renders the card under the device toggles", () => {
    const { getAllByText } = renderScreen()

    const sectionTitles = getAllByText(
      /^(Biometric|Always hide balance|PIN code|Security score .+)$/,
    )

    expect(sectionTitles.map((node) => node.props.children)).toEqual([
      "Biometric",
      "Always hide balance",
      "PIN code",
      "Security score 0/4",
    ])
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

  /** Registration is refused while the account already holds an address, so the
   *  card can't send this user through the sign-up screen (#4076 review). */
  it("re-verifies instead of registering when the address is already on the account", () => {
    mockActiveAccount.mockReturnValue({ type: AccountType.Custodial })
    mockSettingsData.mockReturnValue({
      me: {
        totpEnabled: false,
        email: { address: "someone@example.com", verified: false },
      },
    })

    const { getByTestId } = renderScreen()
    fireEvent.press(getByTestId("security-score-emailVerified"))

    expect(Alert.alert).toHaveBeenCalledWith(
      "Email not verified",
      "Send the code again?",
      expect.any(Array),
    )
    expect(mockNavigate).not.toHaveBeenCalledWith("emailRegistrationInitiate")
  })

  it("takes the confirmed re-verification to the code screen", async () => {
    mockActiveAccount.mockReturnValue({ type: AccountType.Custodial })
    mockSettingsData.mockReturnValue({
      me: {
        totpEnabled: false,
        email: { address: "someone@example.com", verified: false },
      },
    })

    const { getByTestId } = renderScreen()
    fireEvent.press(getByTestId("security-score-emailVerified"))
    await act(async () => {
      await pressAlertButton("OK")
    })

    expect(mockEmailDelete).toHaveBeenCalledWith({ fetchPolicy: "no-cache" })
    expect(mockNavigate).toHaveBeenCalledWith("emailRegistrationValidate", {
      email: "someone@example.com",
      emailRegistrationId: "registration-id",
    })
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
    const { getByTestId } = renderScreen()

    fireEvent.press(getByTestId("security-score-hideBalance"))

    expect(mockUpdateState).toHaveBeenCalledTimes(1)
    expect(mockUpdateState.mock.calls[0][0](baseState)).toEqual(
      expect.objectContaining({ alwaysHideBalance: true }),
    )
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  /** The signal reads the persisted setting, not the Apollo cache the screen
   *  stopped writing when the setting moved into PersistentState (#4124). */
  it("scores hide balance from the persisted setting", () => {
    const { getByText } = renderScreen({ ...baseState, alwaysHideBalance: true })

    expect(getByText("Security score 1/4")).toBeTruthy()
  })

  /** useFocusEffect lists its callback in its own deps, so a fresh closure per
   *  render re-subscribes the listener and re-reads the keystore every time. */
  it("hands useFocusEffect one callback across renders", () => {
    const { rerender } = renderScreen()
    rerender(screenElement())

    const [first, ...rest] = focusCallbacks()

    expect(rest.length).toBeGreaterThan(0)
    expect(rest.every((callback) => callback === first)).toBe(true)
  })

  it("scores app lock from the keystore state the focus effect reads", async () => {
    mockGetIsBiometricsEnabled.mockResolvedValueOnce(true)

    const { getByText } = renderScreen()

    await act(async () => {
      focusCallbacks()[0]()
    })

    expect(getByText("Security score 1/4")).toBeTruthy()
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

describe("SecurityScreen — always hide balance", () => {
  beforeEach(applyDefaultMocks)

  it("reflects the stored setting", () => {
    const { getByTestId } = renderScreen({ ...baseState, alwaysHideBalance: true })

    expect(hideBalanceChecked(getByTestId("always-hide-balance-switch"))).toBe(true)
  })

  it("is off when nothing is stored", () => {
    const { getByTestId } = renderScreen()

    expect(hideBalanceChecked(getByTestId("always-hide-balance-switch"))).toBe(false)
  })

  it("persists the setting and follows the stored value, not a local copy", () => {
    const { getByTestId } = renderScreen()

    fireEvent(getByTestId("always-hide-balance-switch"), "pressIn")

    expect(mockUpdateState).toHaveBeenCalledTimes(1)
    expect(mockUpdateState.mock.calls[0][0](baseState)).toEqual(
      expect.objectContaining({ alwaysHideBalance: true }),
    )
    expect(hideBalanceChecked(getByTestId("always-hide-balance-switch"))).toBe(true)
  })

  it("turns the setting back off", () => {
    const { getByTestId } = renderScreen({ ...baseState, alwaysHideBalance: true })

    fireEvent(getByTestId("always-hide-balance-switch"), "pressIn")

    expect(mockUpdateState.mock.calls[0][0](baseState)).toEqual(
      expect.objectContaining({ alwaysHideBalance: false }),
    )
    expect(hideBalanceChecked(getByTestId("always-hide-balance-switch"))).toBe(false)
  })
})

describe("SecurityScreen — turning the PIN off", () => {
  beforeEach(applyDefaultMocks)

  const renderWithPinOn = async () => {
    mockGetIsPinEnabled.mockResolvedValue(true)
    const rendered = renderScreen()

    await act(async () => {
      focusCallbacks().forEach((callback) => callback())
    })

    return rendered
  }

  it("clears the lockout along with the PIN", async () => {
    // Otherwise a lock outlives the PIN that produced it and greets the next
    // PIN the user sets.
    const { getByTestId } = await renderWithPinOn()

    await act(async () => {
      fireEvent(getByTestId("pin-switch"), "pressIn")
    })

    expect(mockRemovePin).toHaveBeenCalledTimes(1)
    expect(mockClearPinFailureState).toHaveBeenCalledTimes(1)
  })

  it("leaves the lockout in place when the PIN itself could not be removed", async () => {
    mockRemovePin.mockResolvedValue(false)
    const { getByTestId } = await renderWithPinOn()

    await act(async () => {
      fireEvent(getByTestId("pin-switch"), "pressIn")
    })

    expect(mockClearPinFailureState).not.toHaveBeenCalled()
  })
})
