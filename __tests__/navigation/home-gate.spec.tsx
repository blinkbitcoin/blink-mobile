import React, { useSyncExternalStore } from "react"
import { Pressable, Text } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import {
  createNavigationContainerRef,
  NavigationContainer,
  useNavigation,
} from "@react-navigation/native"
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from "@react-navigation/native-stack"

import { HomeGate } from "@app/navigation/home-gate"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { TwoFactorTier } from "@app/types/two-factor-enforcement"

/**
 * The enforcement as a store every mounted screen subscribes to, the way the provider's
 * context reaches them: a change under a mounted stack re-renders the gate in place.
 */
type TwoFactorState = {
  unmetTier: TwoFactorTier
  isPreparingSessionStart: boolean
  isProtectionGateActive: boolean
}
const AT_REST: TwoFactorState = {
  unmetTier: TwoFactorTier.Reminder,
  isPreparingSessionStart: false,
  isProtectionGateActive: false,
}
const mockTwoFactor = { current: AT_REST }
const mockListeners = new Set<() => void>()
const mockSubscribe = (listener: () => void) => {
  mockListeners.add(listener)
  return () => mockListeners.delete(listener)
}
const setTwoFactor = (next: Partial<TwoFactorState>) => {
  mockTwoFactor.current = { ...mockTwoFactor.current, ...next }
  act(() => mockListeners.forEach((listener) => listener()))
}

jest.mock("@app/custodial/providers/two-factor-enforcement", () => ({
  useTwoFactorEnforcement: () =>
    useSyncExternalStore(mockSubscribe, () => mockTwoFactor.current),
}))

const mockMigrationBlocker = { isVisible: false }
jest.mock("@app/screens/account-migration/hooks/use-migration-blocker", () => ({
  useMigrationBlocker: () => mockMigrationBlocker,
}))

jest.mock("@app/screens/account-migration/to-non-custodial/migration-gate", () => {
  const ReactActual = jest.requireActual("react")
  const { Text: TextActual } = jest.requireActual("react-native")
  return {
    MigrationGate: () => ReactActual.createElement(TextActual, null, "migration gate"),
  }
})

/** The protection screen as the gate mounts it: each mount is counted, since the gate
 *  must remount it for a tier raised past the one on screen. */
const mockProtectionMounts = jest.fn()
jest.mock("@app/screens/two-factor-enforcement", () => {
  const ReactActual = jest.requireActual("react")
  const { Text: TextActual } = jest.requireActual("react-native")
  const TwoFactorProtectionRequiredScreen = () => {
    ReactActual.useEffect(() => {
      mockProtectionMounts()
    }, [])
    return ReactActual.createElement(TextActual, null, "protection screen")
  }
  return { TwoFactorProtectionRequiredScreen }
})

const Stack = createNativeStackNavigator<RootStackParamList>()
const navigationRef = createNavigationContainerRef<RootStackParamList>()

const HomeTabs = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  return (
    <>
      <Text>home tabs</Text>
      <Pressable
        testID="open-send"
        onPress={() => navigation.navigate("sendBitcoinDestination")}
      >
        <Text>send</Text>
      </Pressable>
    </>
  )
}

const HomeRoute = () => (
  <HomeGate>
    <HomeTabs />
  </HomeGate>
)

const WorkingScreen = () => <Text>send screen</Text>
const RemedyScreen = () => <Text>setup screen</Text>

const renderStack = async () => {
  render(
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Primary" component={HomeRoute} />
        <Stack.Screen name="sendBitcoinDestination" component={WorkingScreen} />
        <Stack.Screen name="twoFactorSetup" component={RemedyScreen} />
      </Stack.Navigator>
    </NavigationContainer>,
  )
  await act(async () => {})
}

const goBack = async () => {
  await act(async () => {
    navigationRef.goBack()
  })
}

describe("HomeGate", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMigrationBlocker.isVisible = false
    mockTwoFactor.current = AT_REST
  })

  it("shows the home when nothing stands in for it", async () => {
    await renderStack()

    expect(screen.getByText("home tabs")).toBeTruthy()
  })

  it("lets the account-closed gate stand in first, whatever the two-factor prompt owes", async () => {
    mockMigrationBlocker.isVisible = true
    mockTwoFactor.current = { ...AT_REST, isProtectionGateActive: true }
    await renderStack()

    expect(screen.getByText("migration gate")).toBeTruthy()
    expect(screen.queryByText("protection screen")).toBeNull()
  })

  it("shows nothing while the record is read before the home has first shown", async () => {
    mockTwoFactor.current = { ...AT_REST, isPreparingSessionStart: true }
    await renderStack()

    expect(screen.queryByText("home tabs")).toBeNull()
    expect(screen.queryByText("protection screen")).toBeNull()
  })

  it("keeps the home up through a record read once the home has shown", async () => {
    await renderStack()
    expect(screen.getByText("home tabs")).toBeTruthy()

    setTwoFactor({ isPreparingSessionStart: true })

    expect(screen.getByText("home tabs")).toBeTruthy()
  })

  it("stands the protection screen in for the home it is owed on", async () => {
    mockTwoFactor.current = { ...AT_REST, isProtectionGateActive: true }
    await renderStack()

    expect(screen.getByText("protection screen")).toBeTruthy()
    expect(screen.queryByText("home tabs")).toBeNull()
  })

  it("lets the home back once the prompt is resolved", async () => {
    mockTwoFactor.current = { ...AT_REST, isProtectionGateActive: true }
    await renderStack()

    setTwoFactor({ isProtectionGateActive: false })

    expect(screen.getByText("home tabs")).toBeTruthy()
  })

  /** A payment, a scan or the settings is the user's own screen: the prompt that
   *  blocks must not tear it down, it waits for the way back. */
  it("waits while the user is away in a screen of their own, and arms on the way back", async () => {
    await renderStack()
    await act(async () => {
      fireEvent.press(screen.getByTestId("open-send"))
    })
    expect(screen.getByText("send screen")).toBeTruthy()

    setTwoFactor({ isProtectionGateActive: true })
    expect(screen.getByText("send screen")).toBeTruthy()
    expect(screen.queryByText("protection screen")).toBeNull()

    await goBack()

    expect(screen.getByText("protection screen")).toBeTruthy()
  })

  /** A remedy the prompt itself opened sits above the gate, not above the home. */
  it("stays armed under a remedy of its own", async () => {
    mockTwoFactor.current = { ...AT_REST, isProtectionGateActive: true }
    await renderStack()
    await act(async () => {
      navigationRef.navigate("twoFactorSetup")
    })
    expect(screen.getByText("setup screen")).toBeTruthy()

    await goBack()

    expect(screen.getByText("protection screen")).toBeTruthy()
    expect(mockProtectionMounts).toHaveBeenCalledTimes(1)
  })

  /** The migration a remedy leads into pushes steps of its own: the gate stays armed
   *  under the flow it started, whatever that flow pushed after it. */
  it("stays armed under whatever a remedy of its own pushed after it", async () => {
    mockTwoFactor.current = { ...AT_REST, isProtectionGateActive: true }
    await renderStack()
    await act(async () => {
      navigationRef.navigate("twoFactorSetup")
    })
    await act(async () => {
      navigationRef.navigate("sendBitcoinDestination")
    })
    expect(screen.getByText("send screen")).toBeTruthy()

    await goBack()
    await goBack()

    expect(screen.getByText("protection screen")).toBeTruthy()
    expect(mockProtectionMounts).toHaveBeenCalledTimes(1)
  })

  it("remounts the protection screen for a tier raised past the one on screen", async () => {
    mockTwoFactor.current = { ...AT_REST, isProtectionGateActive: true }
    await renderStack()
    expect(mockProtectionMounts).toHaveBeenCalledTimes(1)

    setTwoFactor({ unmetTier: TwoFactorTier.HighBalance })

    expect(mockProtectionMounts).toHaveBeenCalledTimes(2)
    expect(screen.getByText("protection screen")).toBeTruthy()
  })
})
