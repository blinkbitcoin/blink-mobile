import React from "react"
import { Pressable, Text } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import {
  CommonActions,
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
import { EmailRegistrationValidateScreen } from "@app/screens/email-registration-screen/email-registration-validate"
import { TwoFactorSetupScreen } from "@app/screens/two-factor-enforcement"
import { TwoFactorMethod, TwoFactorTier } from "@app/types/two-factor-enforcement"

/**
 * The setup on a real stack: the sibling spec mocks the navigator module-wide, so it
 * can say which listener the screen installed but not which action types the
 * navigator actually hands it, nor where a flow's `popTo` lands. Those are the
 * contracts here.
 */

loadLocale("en")
const LL = i18nObject("en")

const mockEnforcement = {
  tier: TwoFactorTier.Nudge as TwoFactorTier,
  hasTwoFactor: false,
  missingMethod: TwoFactorMethod.Email as TwoFactorMethod,
  unverifiedEmail: null as string | null,
  shouldShowNudgeCard: true,
  shouldShowSettingsBanner: true,
  markPromptShown: jest.fn(),
  dismissNudgeCard: jest.fn(),
}
jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () => mockEnforcement,
}))

/** Whether a re-verification asked for from the setup is in flight. */
let mockIsReverifyingFromHere = false
jest.mock("@app/hooks/use-email-reverification", () => ({
  useEmailReverification: () => ({
    promptReverification: jest.fn(),
    spinner: mockIsReverifyingFromHere,
    isAskedHere: mockIsReverifyingFromHere,
  }),
}))

jest.mock("@app/utils/analytics", () => ({
  logTwoFactorSetupStarted: jest.fn(),
}))

/** The code screen's own collaborators, as its sibling spec mocks them. */
const mockEmailVerify = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useUserEmailRegistrationValidateMutation: () => [mockEmailVerify, { loading: false }],
}))

jest.mock("@app/hooks/use-save-session-profile", () => ({
  useSaveSessionProfile: () => ({
    updateCurrentProfile: jest.fn().mockResolvedValue(undefined),
  }),
}))

jest.mock("@app/components/success-animation", () => {
  const ReactActual = jest.requireActual("react")
  return {
    SuccessIconAnimation: ({ children }: { children: React.ReactNode }) =>
      ReactActual.createElement(ReactActual.Fragment, null, children),
  }
})

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

const SUCCESS_DELAY = 2000

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

/** Stands in for the address step, which hands the code screen the route it was told
 *  to return to, the way the real one does. */
const EmailInitiateStub = ({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, "emailRegistrationInitiate">) => (
  <Pressable
    testID="send-code"
    onPress={() =>
      navigation.navigate("emailRegistrationValidate", {
        emailRegistrationId: "registration-id",
        email: "someone@example.com",
        returnTo: route.params?.returnTo,
      })
    }
  >
    <Text>send code</Text>
  </Pressable>
)

const renderStack = async () => {
  render(
    <ThemeProvider theme={theme}>
      <TypesafeI18n locale="en">
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Primary" component={HomeStub} />
            <Stack.Screen name="twoFactorSetup" component={TwoFactorSetupScreen} />
            <Stack.Screen
              name="emailRegistrationInitiate"
              component={EmailInitiateStub}
            />
            <Stack.Screen
              name="emailRegistrationValidate"
              component={EmailRegistrationValidateScreen}
            />
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
    jest.useFakeTimers()
    loadLocale("en")
    mockIsReverifyingFromHere = false
    mockEnforcement.hasTwoFactor = false
    mockEnforcement.missingMethod = TwoFactorMethod.Email
    mockEnforcement.unverifiedEmail = null
    mockEmailVerify.mockResolvedValue({
      data: {
        userEmailRegistrationValidate: {
          errors: null,
          me: { id: "1", email: { address: "someone@example.com", verified: true } },
        },
      },
    })
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("lands back on the home once the email flow it opened succeeds", async () => {
    await renderStack()
    await openSetup()

    await act(async () => {
      fireEvent.press(screen.getByText(LL.TwoFactorEnforcement.addEmail()))
    })
    expect(currentRoute()).toBe("emailRegistrationInitiate")
    await act(async () => {
      fireEvent.press(screen.getByTestId("send-code"))
    })
    expect(currentRoute()).toBe("emailRegistrationValidate")

    /** What the account reads as once the address is verified. */
    mockEnforcement.hasTwoFactor = true
    await act(async () => {
      fireEvent.press(screen.getByTestId("submit-code"))
    })
    await act(async () => {
      jest.advanceTimersByTime(SUCCESS_DELAY)
    })

    expect(currentRoute()).toBe("Primary")
  })

  it("refuses the user's back while it holds, and lets a reset through", async () => {
    mockIsReverifyingFromHere = true
    await renderStack()
    await openSetup()

    await act(async () => {
      navigationRef.goBack()
    })
    expect(currentRoute()).toBe("twoFactorSetup")

    await act(async () => {
      navigationRef.dispatch(
        CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
      )
    })
    expect(currentRoute()).toBe("Primary")
  })

  it("lets the user back out while nothing is in flight", async () => {
    await renderStack()
    await openSetup()

    await act(async () => {
      navigationRef.goBack()
    })

    expect(currentRoute()).toBe("Primary")
  })
})
