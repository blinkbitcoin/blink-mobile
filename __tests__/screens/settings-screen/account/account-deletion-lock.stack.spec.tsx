import React from "react"
import { BackHandler, Text } from "react-native"
import { act, render } from "@testing-library/react-native"
import {
  createNavigationContainerRef,
  NavigationContainer,
  useNavigation,
} from "@react-navigation/native"
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from "@react-navigation/native-stack"
import { createTheme, ThemeProvider } from "@rn-vui/themed"

import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { light, dark } from "@app/rne-theme/colors"
import {
  AccountDeleteContextProvider,
  useAccountDeleteContext,
} from "@app/screens/settings-screen/account/account-delete-context"
import { navigateAfterAccountDelete } from "@app/screens/settings-screen/self-custodial/navigate-after-account-delete"
import { type DeleteAccountOutcome } from "@app/self-custodial/hooks/use-delete-account"

/**
 * The lock on a real stack: the provider's own spec mocks `usePreventRemove`, so it can
 * say a refused action was re-dispatched but not whether the screen actually left, or
 * what was left underneath. A removal that only pushed Primary kept the locked screen
 * alive below it, and that only shows in the route list.
 */

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
/** Whether anything took the press. */
const pressHardwareBack = () =>
  [...hardwareBackHandlers].reverse().some((handler) => handler())

type LockControls = {
  setAccountIsBeingDeleted: (isBeingDeleted: boolean, identifier?: string) => void
  leaveWhileDeleting: (navigate: () => void) => void
  navigation: NativeStackNavigationProp<RootStackParamList>
}
const controls: Partial<LockControls> = {}

const LockedScreen = () => {
  const { setAccountIsBeingDeleted, leaveWhileDeleting } = useAccountDeleteContext()
  controls.setAccountIsBeingDeleted = setAccountIsBeingDeleted
  controls.leaveWhileDeleting = leaveWhileDeleting
  controls.navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  return <Text>account screen</Text>
}

const AccountScreenStub = () => (
  <AccountDeleteContextProvider>
    <LockedScreen />
  </AccountDeleteContextProvider>
)

const Stack = createNativeStackNavigator<RootStackParamList>()
const navigationRef = createNavigationContainerRef<RootStackParamList>()

const PrimaryStub = () => <Text>home</Text>
const SettingsStub = () => <Text>settings</Text>
const GetStartedStub = () => <Text>get started</Text>

const theme = createTheme({ lightColors: light, darkColors: dark, mode: "light" })

/** Primary → settings → accountScreen, the way a user reaches the Danger zone. */
const renderOnAccountScreen = async () => {
  const utils = render(
    <ThemeProvider theme={theme}>
      <TypesafeI18n locale="en">
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Primary" component={PrimaryStub} />
            <Stack.Screen name="settings" component={SettingsStub} />
            <Stack.Screen name="accountScreen" component={AccountScreenStub} />
            <Stack.Screen name="getStarted" component={GetStartedStub} />
          </Stack.Navigator>
        </NavigationContainer>
      </TypesafeI18n>
    </ThemeProvider>,
  )
  await act(async () => {
    navigationRef.navigate("settings")
  })
  await act(async () => {
    navigationRef.navigate("accountScreen")
  })
  return utils
}

const routeNames = () => navigationRef.getRootState()?.routes.map((route) => route.name)

const raiseLock = async () => {
  await act(async () => {
    controls.setAccountIsBeingDeleted?.(true, "satoshi")
  })
}

/** The removal's own way off the screen, as `useAccountRemoval` runs it once it lands.
 *  The logout route owns the lock flag; here it only has to take the locked screen off
 *  the stack the way that route does when the lock went with the wallet. */
const leaveWith = async (outcome: DeleteAccountOutcome) => {
  const routeAfterLogout = (isAppLockKept: boolean) => {
    if (!controls.navigation || isAppLockKept) return
    controls.navigation.reset({ index: 0, routes: [{ name: "getStarted" }] })
  }
  const navigate = () => {
    if (controls.navigation)
      navigateAfterAccountDelete(controls.navigation, routeAfterLogout, outcome)
  }
  await act(async () => {
    controls.leaveWhileDeleting?.(navigate)
  })
}

describe("account deletion lock on a stack", () => {
  beforeEach(() => {
    loadLocale("en")
  })

  it("refuses the Android back key while the lock is up", async () => {
    await renderOnAccountScreen()
    await raiseLock()

    await act(async () => {
      pressHardwareBack()
    })

    expect(routeNames()).toEqual(["Primary", "settings", "accountScreen"])
  })

  it("lets the Android back key through again once the lock is released", async () => {
    await renderOnAccountScreen()
    await raiseLock()
    await act(async () => {
      controls.setAccountIsBeingDeleted?.(false)
    })

    await act(async () => {
      pressHardwareBack()
    })

    expect(routeNames()).toEqual(["Primary", "settings"])
  })

  const outcomes: Array<{ outcome: DeleteAccountOutcome; routes: string[] }> = [
    { outcome: "switched-to-self-custodial", routes: ["Primary"] },
    { outcome: "switched-to-custodial", routes: ["Primary"] },
    { outcome: "remained", routes: ["Primary"] },
    { outcome: "logged-out", routes: ["getStarted"] },
  ]

  outcomes.forEach(({ outcome, routes }) => {
    /** Nothing locked may stay behind: a screen left under the new one would keep its
     *  lock, and a later swipe or `goBack` would land on a cover with no way out. */
    it(`leaves no locked screen behind for ${outcome}`, async () => {
      await renderOnAccountScreen()
      await raiseLock()

      await leaveWith(outcome)

      expect(routeNames()).toEqual(routes)
    })
  })

  /** The back key must still belong to whatever screen is in front once the removal has
   *  left: nothing the lock installed may keep taking the press. */
  it("does not take the back key once the removal has left", async () => {
    await renderOnAccountScreen()
    await raiseLock()
    await leaveWith("switched-to-self-custodial")

    let wasTaken = true
    await act(async () => {
      wasTaken = pressHardwareBack()
    })

    expect(wasTaken).toBe(false)
  })
})
