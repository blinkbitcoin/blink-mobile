import React from "react"
import { BackHandler, Pressable, Text } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import {
  createNavigationContainerRef,
  NavigationContainer,
  useNavigation,
} from "@react-navigation/native"
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack"
import { ThemeProvider } from "@rn-vui/themed"

import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import theme from "@app/rne-theme/theme"
import {
  AuthenticatorAppsScreen,
  AuthenticatorIntroScreen,
  AuthenticatorProtectedScreen,
  SetupKeyBackupScreen,
  TotpRegistrationValidateScreen,
} from "@app/screens/totp-screen"
import {
  TwoFactorNonCustodialScreen,
  TwoFactorSetupScreen,
} from "@app/screens/two-factor-enforcement"
import {
  TwoFactorPrompt,
  TwoFactorPromptOrigin,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"

/**
 * The setup on a real stack: the sibling spec mocks the navigator and the hardware
 * back module-wide, so it can say which handler the screen installed but not what the
 * navigator does with a press, nor where the authenticator onboarding's exits land.
 * Those are the contracts here.
 */

loadLocale("en")
const LL = i18nObject("en")

const mockRegisterDismissal = jest.fn()
const mockEnforcement = {
  tier: TwoFactorTier.Suggested as TwoFactorTier,
  unmetTier: TwoFactorTier.Suggested as TwoFactorTier,
  hasAuthenticator: false,
  isEnforced: true,
  isCustodyExitOffered: true,
  remainingDismissals: 3,
  shouldShowNudgeCard: true,
  shouldShowSettingsBanner: true,
  markPromptShown: jest.fn(),
  dismissNudgeCard: jest.fn(),
  consumeSessionStart: jest.fn(),
  registerDismissal: mockRegisterDismissal,
}

/** The Android back, raised on the handler the focused screen last installed. */
const hardwareBackListeners = jest.spyOn(BackHandler, "addEventListener")
const pressHardwareBack = () => {
  const onHardwareBack = hardwareBackListeners.mock.calls.at(-1)?.[1]
  onHardwareBack?.()
}
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => mockEnforcement,
}))

jest.mock("@app/utils/analytics", () => ({
  logTwoFactorSetupStarted: jest.fn(),
  logTwoFactorSetupCompleted: jest.fn(),
  logTwoFactorPromptShown: jest.fn(),
  logTwoFactorNonCustodialChosen: jest.fn(),
  logAuthenticatorEducationStarted: jest.fn(),
  logAuthenticatorAppSelected: jest.fn(),
  logAuthenticatorEducationCompleted: jest.fn(),
}))

/** The backup's own collaborators are its spec's to cover; here it only has to be a
 *  screen on the stack. */
jest.mock("@app/screens/totp-screen/hooks/use-setup-key-backup", () => ({
  useSetupKeyBackup: () => ({
    saveToPasswordManager: jest.fn(),
    reportManualCopy: jest.fn(),
  }),
}))

/** The code screen's own collaborators, as its sibling spec mocks them. */
const mockTotpValidate = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserTotpRegistrationValidateMutation: () => [mockTotpValidate, { loading: false }],
}))

jest.mock("@app/hooks", () => ({
  ...jest.requireActual("@app/hooks"),
  useAppConfig: () => ({ appConfig: { token: "session-token" } }),
}))

jest.mock("@app/components/code-input", () => {
  const ReactActual = jest.requireActual("react")
  const { Pressable: PressableActual, Text: TextActual } =
    jest.requireActual("react-native")
  return {
    CodeInput: ({ send }: { send: (code: string) => void }) =>
      ReactActual.createElement(
        PressableActual,
        { testID: "submit-code", onPress: () => send("123456") },
        ReactActual.createElement(TextActual, null, "submit"),
      ),
  }
})

const CARD_ORIGIN: TwoFactorPromptOrigin = { prompt: TwoFactorPrompt.HomeCard }

const Stack = createNativeStackNavigator<RootStackParamList>()
const navigationRef = createNavigationContainerRef<RootStackParamList>()

const HomeStub = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  return (
    <Pressable
      testID="open-setup"
      onPress={() => navigation.navigate("twoFactorSetup", { origin: CARD_ORIGIN })}
    >
      <Text>home</Text>
    </Pressable>
  )
}

/** Stands in for the setup key step, which hands the code screen the registration and
 *  its key, the way the real one does. */
const TotpInitiateStub = ({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "totpRegistrationInitiate">) => (
  <Pressable
    testID="to-code"
    onPress={() =>
      navigation.navigate("totpRegistrationValidate", {
        totpRegistrationId: "registration-id",
        secret: "SECRET",
      })
    }
  >
    <Text>to code</Text>
  </Pressable>
)

const renderStack = async () => {
  render(
    <ThemeProvider theme={theme}>
      <TypesafeI18n locale="en">
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Primary" component={HomeStub} />
            {/** With its header, so the close control the screen installs is on the
             *   stack like everything else. */}
            <Stack.Screen
              name="twoFactorSetup"
              component={TwoFactorSetupScreen}
              options={{ headerShown: true }}
            />
            <Stack.Screen
              name="totpRegistrationIntro"
              component={AuthenticatorIntroScreen}
              options={{ headerShown: true }}
            />
            <Stack.Screen
              name="totpRegistrationApps"
              component={AuthenticatorAppsScreen}
            />
            <Stack.Screen name="totpRegistrationInitiate" component={TotpInitiateStub} />
            <Stack.Screen
              name="totpRegistrationValidate"
              component={TotpRegistrationValidateScreen}
            />
            <Stack.Screen
              name="totpRegistrationBackup"
              component={SetupKeyBackupScreen}
            />
            <Stack.Screen
              name="totpRegistrationDone"
              component={AuthenticatorProtectedScreen}
            />
            <Stack.Screen
              name="twoFactorNonCustodial"
              component={TwoFactorNonCustodialScreen}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </TypesafeI18n>
    </ThemeProvider>,
  )
  await act(async () => {})
}

const currentRoute = () => navigationRef.getCurrentRoute()?.name
const stackRouteNames = () => navigationRef.getRootState().routes.map(({ name }) => name)

const press = async (element: Parameters<typeof fireEvent.press>[0]) => {
  await act(async () => {
    fireEvent.press(element)
  })
}

const openSetup = async () => {
  await press(screen.getByTestId("open-setup"))
  expect(currentRoute()).toBe("twoFactorSetup")
}

/** From the setup to the code screen, through every step of the onboarding. */
const walkToCode = async () => {
  await press(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator()))
  expect(currentRoute()).toBe("totpRegistrationIntro")
  await press(screen.getByText(LL.AuthenticatorOnboarding.getStarted()))
  expect(currentRoute()).toBe("totpRegistrationApps")
  await press(screen.getByText(LL.AuthenticatorOnboarding.haveAnApp()))
  expect(currentRoute()).toBe("totpRegistrationInitiate")
  await press(screen.getByTestId("to-code"))
  expect(currentRoute()).toBe("totpRegistrationValidate")
}

describe("TwoFactorSetupScreen in a stack", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockEnforcement.hasAuthenticator = false
    mockTotpValidate.mockResolvedValue({
      data: {
        userTotpRegistrationValidate: {
          errors: null,
          me: { id: "1", totpEnabled: true },
        },
      },
    })
  })

  /** Once the code is accepted, the onboarding and the setup key have nothing left to
   *  offer, and the key they showed must not be reachable by going back. */
  it("puts the backup in place of the onboarding once the code is accepted", async () => {
    await renderStack()
    await openSetup()
    await walkToCode()

    await press(screen.getByTestId("submit-code"))

    expect(currentRoute()).toBe("totpRegistrationBackup")
    expect(stackRouteNames()).toEqual([
      "Primary",
      "twoFactorSetup",
      "totpRegistrationBackup",
    ])
  })

  it("lands back on the home once the onboarding it opened is done", async () => {
    await renderStack()
    await openSetup()
    await walkToCode()
    await press(screen.getByTestId("submit-code"))
    /** What the account reads as once the authenticator is registered. */
    mockEnforcement.hasAuthenticator = true

    await press(screen.getByText(LL.AuthenticatorOnboarding.savedIt()))
    expect(currentRoute()).toBe("totpRegistrationDone")
    await press(screen.getByText(LL.AuthenticatorOnboarding.done()))

    expect(currentRoute()).toBe("Primary")
    expect(mockRegisterDismissal).not.toHaveBeenCalled()
  })

  /** The setup stays under the onboarding: backing out of it lands back on the setup,
   *  and only leaving the setup counts. */
  it("lands back on the setup when the onboarding is backed out of, charging nothing", async () => {
    await renderStack()
    await openSetup()
    await press(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator()))
    expect(currentRoute()).toBe("totpRegistrationIntro")

    await act(async () => {
      pressHardwareBack()
    })

    expect(currentRoute()).toBe("twoFactorSetup")
    expect(mockRegisterDismissal).not.toHaveBeenCalled()
  })

  it("opens the screen that explains leaving custody over the setup", async () => {
    await renderStack()
    await openSetup()

    await press(screen.getByText(LL.AccountMigration.moveToNonCustodial()))

    expect(currentRoute()).toBe("twoFactorNonCustodial")
  })

  /** The setup stays under the explanation: backing out of it lands back on the setup,
   *  and only leaving the setup counts. */
  it("lands back on the setup when leaving custody is backed out of, charging nothing", async () => {
    await renderStack()
    await openSetup()
    await press(screen.getByText(LL.AccountMigration.moveToNonCustodial()))

    await press(screen.getByTestId("two-factor-non-custodial-cancel"))

    expect(currentRoute()).toBe("twoFactorSetup")
    expect(mockRegisterDismissal).not.toHaveBeenCalled()
  })

  it("lets the close control out, charging the exit to the tier", async () => {
    await renderStack()
    await openSetup()

    await press(screen.getByTestId("icon-close"))

    expect(currentRoute()).toBe("Primary")
    expect(mockRegisterDismissal).toHaveBeenCalledWith(
      TwoFactorTier.Suggested,
      CARD_ORIGIN,
    )
  })

  it("lets the hardware back out, charging the exit to the tier", async () => {
    await renderStack()
    await openSetup()

    await act(async () => {
      pressHardwareBack()
    })

    expect(currentRoute()).toBe("Primary")
    expect(mockRegisterDismissal).toHaveBeenCalledWith(
      TwoFactorTier.Suggested,
      CARD_ORIGIN,
    )
  })
})
