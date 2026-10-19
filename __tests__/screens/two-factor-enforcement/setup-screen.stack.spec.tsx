import React from "react"
import { Alert, AlertButton, BackHandler, Pressable, Text } from "react-native"
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
import { TotpRegistrationValidateScreen } from "@app/screens/totp-screen/totp-registration-validate"
import { TwoFactorSetupScreen } from "@app/screens/two-factor-enforcement"
import { TwoFactorTier } from "@app/types/two-factor-enforcement"

/**
 * The setup on a real stack: the sibling spec mocks the navigator and the hardware
 * back module-wide, so it can say which handler the screen installed but not what the
 * navigator does with a press, nor where the authenticator flow's `popTo` lands. Those
 * are the contracts here.
 */

loadLocale("en")
const LL = i18nObject("en")

const mockRegisterDismissal = jest.fn()
const mockEnforcement = {
  tier: TwoFactorTier.Nudge as TwoFactorTier,
  unmetTier: TwoFactorTier.Nudge as TwoFactorTier,
  hasAuthenticator: false,
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

/** The success alert is what moves on: its OK button carries the navigation. */
const alertSpy = jest.spyOn(Alert, "alert")
const pressSuccessOk = () => {
  const buttons = alertSpy.mock.calls.at(-1)?.[2] as AlertButton[] | undefined
  buttons?.[0]?.onPress?.()
}

const Stack = createNativeStackNavigator<RootStackParamList>()
const navigationRef = createNavigationContainerRef<RootStackParamList>()

const HomeStub = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  return (
    <Pressable testID="open-setup" onPress={() => navigation.navigate("twoFactorSetup")}>
      <Text>home</Text>
    </Pressable>
  )
}

/** Stands in for the QR step, which hands the code screen the route it was told to
 *  return to, the way the real one does. */
const TotpInitiateStub = ({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, "totpRegistrationInitiate">) => (
  <Pressable
    testID="to-code"
    onPress={() =>
      navigation.navigate("totpRegistrationValidate", {
        totpRegistrationId: "registration-id",
        returnTo: route.params?.returnTo,
      })
    }
  >
    <Text>to code</Text>
  </Pressable>
)

const NonCustodialStub = () => <Text>non-custodial</Text>

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
            <Stack.Screen name="totpRegistrationInitiate" component={TotpInitiateStub} />
            <Stack.Screen
              name="totpRegistrationValidate"
              component={TotpRegistrationValidateScreen}
            />
            <Stack.Screen name="twoFactorNonCustodial" component={NonCustodialStub} />
          </Stack.Navigator>
        </NavigationContainer>
      </TypesafeI18n>
    </ThemeProvider>,
  )
  await act(async () => {})
}

const currentRoute = () => navigationRef.getCurrentRoute()?.name

const openSetup = async () => {
  await act(async () => {
    fireEvent.press(screen.getByTestId("open-setup"))
  })
  expect(currentRoute()).toBe("twoFactorSetup")
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

  it("lands back on the home once the authenticator flow it opened succeeds", async () => {
    await renderStack()
    await openSetup()

    await act(async () => {
      fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.setAuthenticator()))
    })
    expect(currentRoute()).toBe("totpRegistrationInitiate")
    await act(async () => {
      fireEvent.press(screen.getByTestId("to-code"))
    })
    expect(currentRoute()).toBe("totpRegistrationValidate")

    await act(async () => {
      fireEvent.press(screen.getByTestId("submit-code"))
    })
    /** What the account reads as once the authenticator is registered. */
    mockEnforcement.hasAuthenticator = true
    await act(async () => {
      pressSuccessOk()
    })

    expect(currentRoute()).toBe("Primary")
  })

  it("opens the screen that explains leaving custody over the setup", async () => {
    await renderStack()
    await openSetup()

    await act(async () => {
      fireEvent.press(screen.getByText(LL.AccountMigration.moveToNonCustodial()))
    })

    expect(currentRoute()).toBe("twoFactorNonCustodial")
  })

  it("lets the close control out, charging the exit to the tier", async () => {
    await renderStack()
    await openSetup()

    await act(async () => {
      fireEvent.press(screen.getByTestId("icon-close"))
    })

    expect(currentRoute()).toBe("Primary")
    expect(mockRegisterDismissal).toHaveBeenCalledWith(TwoFactorTier.Nudge)
  })

  it("lets the hardware back out, charging the exit to the tier", async () => {
    await renderStack()
    await openSetup()

    await act(async () => {
      pressHardwareBack()
    })

    expect(currentRoute()).toBe("Primary")
    expect(mockRegisterDismissal).toHaveBeenCalledWith(TwoFactorTier.Nudge)
  })
})
