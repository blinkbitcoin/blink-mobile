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

/** The Android back, as React Native raises it: the handlers still installed, the
 *  latest first, until one takes it. The navigator's own is among them. */
type HardwareBackHandler = () => boolean | null | undefined
const hardwareBackHandlers: HardwareBackHandler[] = []
jest
  .spyOn(BackHandler, "addEventListener")
  .mockImplementation((_event, handler: HardwareBackHandler) => {
    hardwareBackHandlers.push(handler)
    return {
      remove: () => {
        const index = hardwareBackHandlers.lastIndexOf(handler)
        if (index !== -1) hardwareBackHandlers.splice(index, 1)
      },
    }
  })
const pressHardwareBack = () => {
  ;[...hardwareBackHandlers].reverse().some((handler) => handler())
}
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => mockEnforcement,
}))

jest.mock("@app/utils/analytics", () => ({
  logTwoFactorSetupStarted: jest.fn(),
  logTwoFactorSetupCompleted: jest.fn(),
  logTwoFactorPromptShown: jest.fn(),
  logTwoFactorNonCustodialChosen: jest.fn(),
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
const mockReadRegistrationState = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserTotpRegistrationValidateMutation: () => [mockTotpValidate, { loading: false }],
  useTotpRegistrationStateLazyQuery: () => [mockReadRegistrationState],
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
const WALL_ORIGIN: TwoFactorPromptOrigin = {
  prompt: TwoFactorPrompt.ProtectionRequiredScreen,
}

const Stack = createNativeStackNavigator<RootStackParamList>()
const navigationRef = createNavigationContainerRef<RootStackParamList>()

/** The home, with the card that opens the setup and the blocking screen's Set
 *  authenticator, which opens the onboarding directly. */
const HomeStub = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  return (
    <>
      <Pressable
        testID="open-setup"
        onPress={() => navigation.navigate("twoFactorSetup", { origin: CARD_ORIGIN })}
      >
        <Text>home</Text>
      </Pressable>
      <Pressable
        testID="open-from-wall"
        onPress={() =>
          navigation.navigate("totpRegistrationIntro", { origin: WALL_ORIGIN })
        }
      >
        <Text>wall</Text>
      </Pressable>
    </>
  )
}

/** The settings, whose Two-factor authentication opens the setup key directly. */
const SettingsStub = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  return (
    <Pressable
      testID="open-from-settings"
      onPress={() => navigation.navigate("totpRegistrationInitiate")}
    >
      <Text>settings</Text>
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
            <Stack.Screen name="accountScreen" component={SettingsStub} />
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

/** From the onboarding to the code screen, through every step of it. */
const walkOnboardingToCode = async () => {
  expect(currentRoute()).toBe("totpRegistrationIntro")
  await press(screen.getByText(LL.AuthenticatorOnboarding.getStarted()))
  expect(currentRoute()).toBe("totpRegistrationApps")
  await press(screen.getByText(LL.AuthenticatorOnboarding.haveAnApp()))
  expect(currentRoute()).toBe("totpRegistrationInitiate")
  await press(screen.getByTestId("to-code"))
  expect(currentRoute()).toBe("totpRegistrationValidate")
}

/** From the setup to the code screen, through every step of the onboarding. */
const walkToCode = async () => {
  await press(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator()))
  await walkOnboardingToCode()
}

/** The code accepted, the key kept, and the account read as protected. */
const finishFromCode = async () => {
  await press(screen.getByTestId("submit-code"))
  expect(currentRoute()).toBe("totpRegistrationBackup")
  mockEnforcement.hasAuthenticator = true
  await press(screen.getByText(LL.AuthenticatorOnboarding.savedIt()))
  expect(currentRoute()).toBe("totpRegistrationDone")
}

describe("TwoFactorSetupScreen in a stack", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    mockEnforcement.hasAuthenticator = false
    mockReadRegistrationState.mockResolvedValue({
      data: { me: { id: "1", totpEnabled: false } },
    })
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
    await finishFromCode()

    await press(screen.getByText(LL.AuthenticatorOnboarding.done()))

    expect(currentRoute()).toBe("Primary")
    expect(mockRegisterDismissal).not.toHaveBeenCalled()
  })

  /** The done screen took the backup's place, so its back controls go where Done goes
   *  and never show the key again. */
  it("goes where Done goes on the done screen's back, never to the key", async () => {
    await renderStack()
    await openSetup()
    await walkToCode()
    await finishFromCode()
    expect(stackRouteNames()).toEqual([
      "Primary",
      "twoFactorSetup",
      "totpRegistrationDone",
    ])

    await act(async () => {
      pressHardwareBack()
    })

    expect(currentRoute()).toBe("Primary")
    expect(mockRegisterDismissal).not.toHaveBeenCalled()
  })

  it("keeps the backup up on the hardware back, the one chance to keep the key", async () => {
    await renderStack()
    await openSetup()
    await walkToCode()
    await press(screen.getByTestId("submit-code"))

    await act(async () => {
      pressHardwareBack()
    })

    expect(currentRoute()).toBe("totpRegistrationBackup")
  })

  describe("while a code is checked", () => {
    /** An answer that never comes keeps the check out. */
    const submitPendingCode = async () => {
      mockTotpValidate.mockReturnValue(new Promise(() => {}))
      await press(screen.getByTestId("submit-code"))
    }

    it("keeps the code screen up on the hardware back", async () => {
      await renderStack()
      await openSetup()
      await walkToCode()
      await submitPendingCode()
      expect(navigationRef.getCurrentRoute()?.params).toMatchObject({ isChecking: true })

      await act(async () => {
        pressHardwareBack()
      })

      expect(currentRoute()).toBe("totpRegistrationValidate")
    })

    /** The header's arrow goes back through the navigator, as this does. */
    it("keeps the code screen up on the header's back", async () => {
      await renderStack()
      await openSetup()
      await walkToCode()
      await submitPendingCode()

      await act(async () => {
        navigationRef.goBack()
      })

      expect(currentRoute()).toBe("totpRegistrationValidate")
    })

    it("tells the stack the code is out, and lets the user back once it is answered", async () => {
      let answer: (value: unknown) => void = () => {}
      mockTotpValidate.mockReturnValue(
        new Promise((resolve) => {
          answer = resolve
        }),
      )
      await renderStack()
      await openSetup()
      await walkToCode()
      await press(screen.getByTestId("submit-code"))
      expect(navigationRef.getCurrentRoute()?.params).toMatchObject({ isChecking: true })

      await act(async () => {
        answer({
          data: {
            userTotpRegistrationValidate: {
              errors: [{ message: "Invalid code" }],
              me: null,
            },
          },
        })
      })
      expect(navigationRef.getCurrentRoute()?.params).toMatchObject({ isChecking: false })

      await act(async () => {
        pressHardwareBack()
      })

      expect(currentRoute()).toBe("totpRegistrationInitiate")
    })
  })

  /** The two ways in that skip the setup, both live on release whatever the flag. */
  it("lands back on the settings once a registration started there is done", async () => {
    await renderStack()
    await act(async () => {
      navigationRef.navigate("accountScreen")
    })
    await press(screen.getByTestId("open-from-settings"))
    await press(screen.getByTestId("to-code"))
    await finishFromCode()

    await press(screen.getByText(LL.AuthenticatorOnboarding.done()))

    expect(currentRoute()).toBe("accountScreen")
    expect(stackRouteNames()).toEqual(["Primary", "accountScreen"])
  })

  it("lands back on the home once a registration the blocking screen opened is done", async () => {
    await renderStack()
    await press(screen.getByTestId("open-from-wall"))
    await walkOnboardingToCode()
    await finishFromCode()

    await press(screen.getByText(LL.AuthenticatorOnboarding.done()))

    expect(stackRouteNames()).toEqual(["Primary"])
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
