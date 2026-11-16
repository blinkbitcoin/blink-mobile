jest.mock("react-native-bootsplash", () => ({
  __esModule: true,
  default: { hide: jest.fn() },
}))

import React, { useSyncExternalStore } from "react"
import { Alert, AlertButton, BackHandler, Text } from "react-native"
import { act, fireEvent, render, screen } from "@testing-library/react-native"
import {
  CommonActions,
  createNavigationContainerRef,
  NavigationContainer,
} from "@react-navigation/native"
import { createNativeStackNavigator } from "@react-navigation/native-stack"
import { createTheme, ThemeProvider } from "@rn-vui/themed"

import TypesafeI18n from "@app/i18n/i18n-react"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { light, dark } from "@app/rne-theme/colors"
import { AccountDeleteContextProvider } from "@app/screens/settings-screen/account/account-delete-context"
import { DangerZoneSettings } from "@app/screens/settings-screen/account/settings/danger-zone"
import { type DeleteAccountResult } from "@app/self-custodial/hooks/use-delete-account"
import { AccountType } from "@app/types/wallet"

/**
 * The Danger zone inside the real lock provider, on a real stack. The component specs
 * mock the lock's context, so they can't show what the user sees when the component
 * running a removal is swapped out mid-removal, or whether the custodial deletion still
 * behaves now that its screen stays mounted under a cover instead of being replaced.
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
const pressHardwareBack = () =>
  [...hardwareBackHandlers].reverse().some((handler) => handler())

const SC_ACCOUNT_ID = "sc-alice"

type ActiveAccount = { id: string; type: AccountType }
const SELF_CUSTODIAL: ActiveAccount = {
  id: SC_ACCOUNT_ID,
  type: AccountType.SelfCustodial,
}
const CUSTODIAL: ActiveAccount = { id: "custodial", type: AccountType.Custodial }

/** The active account, read through a store every mounted component subscribes to, so a
 *  switch made mid-removal re-renders the Danger zone the way the real registry does. */
const registry = { active: SELF_CUSTODIAL }
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
const switchActiveAccount = (account: ActiveAccount) => {
  registry.active = account
  listeners.forEach((listener) => listener())
}

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({
    activeAccount: useSyncExternalStore(subscribe, () => registry.active),
    selfCustodialEntries: [{ id: "sc-alice", lightningAddress: "alice@breez.tips" }],
  }),
}))

jest.mock("@app/graphql/level-context", () => {
  const actual = jest.requireActual("@app/graphql/level-context")
  return {
    ...actual,
    useLevel: () => ({
      currentLevel: actual.AccountLevel.One,
      isAtLeastLevelOne: true,
      isAtLeastLevelZero: true,
    }),
  }
})

const mockDeleteWallet = jest.fn<Promise<DeleteAccountResult>, [string]>()
jest.mock("@app/self-custodial/hooks/use-delete-account", () => ({
  useDeleteAccount: () => ({ deleteWallet: mockDeleteWallet }),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ wallets: [], lightningAddress: null }),
}))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => "mainnet",
}))

jest.mock("@app/components/card-screen", () => ({
  InfoCard: () => null,
}))

/** The confirm modal's own animation is its spec's business; here it only has to hand
 *  back the confirm and the hide that starts the removal. */
const confirmModal: { onConfirm?: () => void; onModalHide?: () => Promise<void> } = {}
jest.mock(
  "@app/screens/settings-screen/self-custodial/delete-account-confirm-modal",
  () => ({
    DeleteAccountConfirmModal: (props: {
      onConfirm: () => void
      onModalHide: () => Promise<void>
    }) => {
      confirmModal.onConfirm = props.onConfirm
      confirmModal.onModalHide = props.onModalHide
      return null
    },
  }),
)

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (...args: unknown[]) => mockToastShow(...args),
}))

const mockAccountDelete = jest.fn()
jest.mock("@app/graphql/generated", () => ({
  ...jest.requireActual("@app/graphql/generated"),
  useAccountDeleteMutation: () => [mockAccountDelete],
  useSettingsScreenQuery: () => ({
    data: { me: { defaultAccount: { wallets: [] } } },
    loading: false,
  }),
}))

/** The profile switch runs for real, so the way it leaves meets the real lock on the real
 *  stack. Only what it reaches past the screen is stood in for: the saved profiles, the
 *  token store, and the app lock's flag. */
const mockReadSessionProfiles = jest.fn()
jest.mock("@app/utils/storage/secureStorage", () => ({
  __esModule: true,
  default: {
    readSessionProfiles: (...args: unknown[]) => mockReadSessionProfiles(...args),
  },
}))

jest.mock("@app/navigation/navigation-container-wrapper", () => ({
  useAuthenticationContext: () => ({
    readIsAppLocked: () => false,
    setAppLocked: jest.fn(),
  }),
}))

const mockLogout = jest.fn()
jest.mock("@app/hooks/use-logout", () => ({
  __esModule: true,
  default: () => ({ logout: mockLogout }),
}))

const mockRouteAfterLogout = jest.fn()
jest.mock("@app/hooks/use-logout-and-route", () => ({
  useLogoutAndRoute: () => ({ routeAfterLogout: mockRouteAfterLogout }),
}))

jest.mock("@app/hooks", () => ({
  ...jest.requireActual("@app/hooks"),
  useAppConfig: () => ({
    appConfig: { token: "custodial-token" },
    saveToken: jest.fn().mockResolvedValue(undefined),
  }),
}))

jest.mock("@app/hooks/use-display-currency", () => ({
  useDisplayCurrency: () => ({ formatMoneyAmount: () => "$0" }),
}))

jest.mock("@app/screens/settings-screen/account/settings/logout", () => ({
  LogOut: () => null,
}))

jest.mock("react-native-modal", () => ({
  __esModule: true,
  default: ({
    isVisible,
    children,
  }: {
    isVisible: boolean
    children: React.ReactNode
  }) => (isVisible ? children : null),
}))

const AccountScreenStub = () => (
  <AccountDeleteContextProvider>
    <DangerZoneSettings />
  </AccountDeleteContextProvider>
)

const Stack = createNativeStackNavigator<RootStackParamList>()
const navigationRef = createNavigationContainerRef<RootStackParamList>()

const PrimaryStub = () => <Text>home</Text>
const SettingsStub = () => <Text>settings</Text>

const theme = createTheme({ lightColors: light, darkColors: dark, mode: "light" })

/** Primary → settings → accountScreen, with the Danger zone opened. */
const renderDangerZone = async () => {
  render(
    <ThemeProvider theme={theme}>
      <TypesafeI18n locale="en">
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Primary" component={PrimaryStub} />
            <Stack.Screen name="settings" component={SettingsStub} />
            <Stack.Screen name="accountScreen" component={AccountScreenStub} />
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
  await act(async () => {
    fireEvent.press(screen.getByText("Danger zone"))
  })
}

const routeNames = () => navigationRef.getRootState()?.routes.map((route) => route.name)

const deferred = <T,>() => {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe("Danger zone removal under the real lock", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    loadLocale("en")
    registry.active = SELF_CUSTODIAL
  })

  /** The last self-custodial account goes and a custodial one takes over: the Danger zone
   *  swaps the self-custodial DeleteAccount, the component running the removal, for the
   *  custodial controls while the removal is still in flight. */
  describe("when the active account switches to custodial mid-removal", () => {
    const startRemoval = async () => {
      const removal = deferred<DeleteAccountResult>()
      mockDeleteWallet.mockImplementation(() => {
        switchActiveAccount(CUSTODIAL)
        return removal.promise
      })
      await renderDangerZone()
      await act(async () => {
        fireEvent.press(screen.getByText("Delete account and data"))
      })
      await act(async () => {
        confirmModal.onConfirm?.()
      })
      let finished: Promise<void> | undefined
      await act(async () => {
        finished = confirmModal.onModalHide?.()
      })
      return { removal, finished }
    }

    it("keeps the named cover up after the component running the removal is gone", async () => {
      await startRemoval()

      expect(screen.queryByText("Delete account and data")).toBeNull()
      expect(screen.getByTestId("account-deletion-lock")).toBeTruthy()
      expect(screen.getByText("alice@breez.tips")).toBeTruthy()
    })

    it("still refuses the Android back key once that component is gone", async () => {
      await startRemoval()

      await act(async () => {
        pressHardwareBack()
      })

      expect(routeNames()).toEqual(["Primary", "settings", "accountScreen"])
    })

    it("sees the removal through: leaves for Home and names the account", async () => {
      const { removal, finished } = await startRemoval()

      await act(async () => {
        removal.resolve({ removed: true, outcome: "switched-to-custodial" })
        await finished
      })

      expect(routeNames()).toEqual(["Primary"])
      expect(mockToastShow).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "success",
          message: "You removed account alice@breez.tips.",
        }),
      )
    })
  })

  /** The custodial deletion used to unmount its screen while it ran; it now runs under
   *  the same cover, with the screen and its Alert-driven flow still mounted beneath. */
  describe("custodial deletion", () => {
    const alertCalls: Array<{ title: string; buttons?: AlertButton[] }> = []
    /** Not awaited: the final confirmation's OK runs the whole deletion, and the
     *  mutation is held open so the test can look at the screen mid-deletion. */
    const pressLastAlertButton = async (label: string) => {
      const button = alertCalls
        .at(-1)
        ?.buttons?.find((candidate) => candidate.text === label)
      await act(async () => {
        button?.onPress?.()
      })
    }

    const startDeletion = async () => {
      const mutation = deferred<unknown>()
      mockAccountDelete.mockReturnValue(mutation.promise)
      registry.active = CUSTODIAL
      await renderDangerZone()
      await act(async () => {
        fireEvent.press(screen.getByText("Close account"))
      })
      fireEvent.changeText(screen.getByPlaceholderText("delete"), "delete")
      await act(async () => {
        fireEvent.press(screen.getByText("Confirm"))
      })
      await pressLastAlertButton("OK")
      return mutation
    }

    beforeEach(() => {
      alertCalls.length = 0
      jest
        .spyOn(Alert, "alert")
        .mockImplementation((title, _body, buttons) =>
          alertCalls.push({ title, buttons }),
        )
      mockReadSessionProfiles.mockResolvedValue({
        status: "found",
        profiles: [{ token: "custodial-token" }, { token: "next-token" }],
      })
      mockLogout.mockResolvedValue({ isAppLockKept: false })
      /** Get started is not on this stack; resetting to Home stands in for it, which is
       *  enough to show whether the lock lets the way out through. */
      mockRouteAfterLogout.mockImplementation(() =>
        navigationRef.dispatch(
          CommonActions.reset({ index: 0, routes: [{ name: "Primary" }] }),
        ),
      )
    })

    it("covers the screen and refuses the back key while the mutation runs", async () => {
      await startDeletion()

      expect(screen.getByTestId("account-deletion-lock")).toBeTruthy()
      /** Still mounted under the cover, but out of reach of a screen reader. */
      expect(
        screen.getByText("Close account", { includeHiddenElements: true }),
      ).toBeTruthy()
      expect(screen.queryByText("Close account")).toBeNull()

      await act(async () => {
        pressHardwareBack()
      })
      expect(routeNames()).toEqual(["Primary", "settings", "accountScreen"])
    })

    /** The account is gone once the mutation lands, and the switch then reads the store,
     *  signs the dead session out and saves the next token: all that time the screen
     *  under the cover renders for whichever session comes next. */
    it("keeps the cover up and the back key refused while the profile switch runs", async () => {
      const profilesRead = deferred<unknown>()
      mockReadSessionProfiles.mockReturnValue(profilesRead.promise)
      const mutation = await startDeletion()

      await act(async () => {
        mutation.resolve({ data: { accountDelete: { success: true, errors: [] } } })
      })

      expect(screen.getByTestId("account-deletion-lock")).toBeTruthy()
      await act(async () => {
        pressHardwareBack()
      })
      expect(routeNames()).toEqual(["Primary", "settings", "accountScreen"])

      await act(async () => {
        profilesRead.resolve({
          status: "found",
          profiles: [{ token: "custodial-token" }, { token: "next-token" }],
        })
      })

      expect(routeNames()).toEqual(["Primary"])
      expect(alertCalls.at(-1)?.title).toBe("Bye!")
    })

    /** `navigate("Primary")` pushed a second Home over the deleted account's screen, and
     *  back from Home went back to it. */
    it("leaves no way back to the deleted account's screen once switched", async () => {
      const mutation = await startDeletion()

      await act(async () => {
        mutation.resolve({ data: { accountDelete: { success: true, errors: [] } } })
      })
      await act(async () => {
        pressHardwareBack()
      })

      expect(routeNames()).toEqual(["Primary"])
      expect(
        screen.queryByText("Close account", { includeHiddenElements: true }),
      ).toBeNull()
    })

    it("stays covered until the farewell is acknowledged when it was the last profile, then leaves", async () => {
      mockReadSessionProfiles.mockResolvedValue({
        status: "found",
        profiles: [{ token: "custodial-token" }],
      })
      const mutation = await startDeletion()

      await act(async () => {
        mutation.resolve({ data: { accountDelete: { success: true, errors: [] } } })
      })

      expect(alertCalls.at(-1)?.title).toBe("Bye!")
      expect(screen.getByTestId("account-deletion-lock")).toBeTruthy()
      expect(routeNames()).toEqual(["Primary", "settings", "accountScreen"])

      await pressLastAlertButton("OK")

      expect(mockRouteAfterLogout).toHaveBeenCalledWith(false)
      expect(routeNames()).toEqual(["Primary"])
    })

    it("gives the way back when the server refuses the deletion", async () => {
      const mutation = await startDeletion()

      await act(async () => {
        mutation.resolve({
          data: { accountDelete: { success: false, errors: [{ message: "locked" }] } },
        })
      })

      expect(screen.queryByTestId("account-deletion-lock")).toBeNull()
      expect(alertCalls.at(-1)?.title).toBe("Error")

      await act(async () => {
        pressHardwareBack()
      })
      expect(routeNames()).toEqual(["Primary", "settings"])
    })
  })
})
