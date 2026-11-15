import React from "react"
import { Network as mockSparkNetwork } from "@breeztech/breez-sdk-spark-react-native"
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
} from "@react-navigation/native-stack"
import { ThemeProvider } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { CODE_CHECK_HOLD_MS } from "@app/hooks/use-code-check-hold"
import TypesafeI18n from "@app/i18n/i18n-react"
import { i18nObject } from "@app/i18n/i18n-util"
import { loadLocale } from "@app/i18n/i18n-util.sync"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import theme from "@app/rne-theme/theme"
import { AcceptTermsAndConditionsScreen } from "@app/screens/accept-t-and-c/accept-t-and-c"
import { BackupSuccessScreen } from "@app/screens/self-custodial/onboarding/backup-success-screen"
import { useRestoreWallet } from "@app/screens/self-custodial/onboarding/restore/hooks/use-restore-wallet"
import { readPendingRestore } from "@app/screens/self-custodial/onboarding/restore/pending-restore"
import { RestoreConnectTimeoutError } from "@app/self-custodial/bridge"

/**
 * The restore's terms on a real stack, with the real restore behind them and only the
 * bridge and storage below it mocked. The sibling specs mock the navigator, so they can
 * say what a screen asks of it but not where the user ends up: that a back from the
 * success splash lands home, and that a terms screen opened while an earlier restore
 * still runs shows it running. Those are the contracts here.
 */

loadLocale("en")
const LL = i18nObject("en")

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

type Restored = { serverMode: null; isServerModeKnown: boolean }
const mockSelfCustodialRestoreWallet = jest.fn<
  Promise<Restored>,
  [{ mnemonic: string }]
>()
jest.mock("@app/self-custodial/bridge", () => ({
  selfCustodialRestoreWallet: (params: { mnemonic: string }) =>
    mockSelfCustodialRestoreWallet(params),
  RestoreConnectTimeoutError: class RestoreConnectTimeoutError extends Error {},
}))

jest.mock("bip39", () => ({ validateMnemonic: () => true }))

jest.mock("@app/self-custodial/hooks/use-spark-network", () => ({
  useSparkNetwork: () => mockSparkNetwork.Regtest,
}))

let mockAccountCount = 0
jest.mock("react-native-quick-crypto", () => ({
  randomUUID: () => {
    mockAccountCount += 1
    return `account-${mockAccountCount}`
  },
}))

jest.mock("@app/self-custodial/storage/account-index", () => ({
  findSelfCustodialAccountByMnemonic: () => Promise.resolve({ status: "ok", id: null }),
  StorageReadStatus: { Ok: "ok", ReadFailed: "read-failed" },
}))

jest.mock("@app/self-custodial/providers/backup-state", () => ({
  markBackupCompletedFor: () => Promise.resolve(),
  BackupMethod: { Manual: "manual", Cloud: "cloud", Recovery: "recovery" },
}))

jest.mock("@app/hooks/use-self-custodial-info-bulletin-state", () => ({
  markSelfCustodialInfoBulletinDismissedFor: () => Promise.resolve(),
}))

jest.mock("@app/hooks/use-account-registry", () => ({
  useAccountRegistry: () => ({ reloadSelfCustodialAccounts: () => Promise.resolve() }),
}))

const mockUpdateState = jest.fn()
jest.mock("@app/store/persistent-state", () => ({
  usePersistentStateContext: () => ({ updateState: mockUpdateState }),
}))

jest.mock("@app/self-custodial/providers/wallet", () => ({
  useSelfCustodialWallet: () => ({ retry: jest.fn() }),
}))

jest.mock("@app/config/feature-flags-context", () => ({
  useFeatureFlags: () => ({ deviceAccountEnabled: false }),
  useRemoteConfig: () => ({ selfCustodialDepositClaimLeewayVbyte: 5 }),
}))

jest.mock("@react-native-firebase/crashlytics", () => () => ({
  recordError: jest.fn(),
  log: jest.fn(),
}))

const mockToastShow = jest.fn()
jest.mock("@app/utils/toast", () => ({
  toastShow: (args: unknown) => mockToastShow(args),
}))

/** The terms screen's other flows, as its sibling spec mocks them. */
jest.mock("@app/hooks/use-device-location", () => ({
  __esModule: true,
  default: () => ({
    countryCode: "SV",
    loading: false,
    detectionFailed: false,
    source: "phone",
  }),
  useIpCountryCode: () => undefined,
  isBlockedCountry: () => false,
  LocationSource: { Phone: "phone", Ip: "ip" },
}))

jest.mock("@app/screens/account-migration/hooks", () => ({
  ...jest.requireActual("@app/screens/account-migration/hooks"),
  useMigrationCheckpoint: () => ({ saveCheckpoint: jest.fn() }),
}))

jest.mock("@app/screens/get-started-screen/use-device-token", () => ({
  __esModule: true,
  default: () => undefined,
}))

jest.mock("@app/screens/get-started-screen/use-create-device-account", () => ({
  useCreateDeviceAccount: () => ({
    createDeviceAccountAndLogin: jest.fn(),
    loading: false,
  }),
}))

jest.mock("react-native-inappbrowser-reborn", () => ({
  __esModule: true,
  default: { open: jest.fn() },
}))

/** The splash animations, as the success screen's own spec stands them in: done at once,
 *  so only the screen's hold before going home is left. */
jest.mock("@app/components/success-animation/success-icon-animation", () => {
  const { View } = jest.requireActual("react-native")
  return {
    SuccessIconAnimation: ({ children }: { children: React.ReactNode }) => (
      <View>{children}</View>
    ),
  }
})

jest.mock("@app/components/success-animation/success-text-animation", () => {
  const { useEffect } = jest.requireActual("react")
  const { View } = jest.requireActual("react-native")
  const CompletedTextAnimation = ({
    children,
    onComplete,
  }: {
    children: React.ReactNode
    onComplete?: () => void
  }) => {
    useEffect(() => {
      onComplete?.()
    }, [onComplete])
    return <View>{children}</View>
  }
  return { CompletedTextAnimation }
})

const Stack = createNativeStackNavigator<RootStackParamList>()
const navigationRef = createNavigationContainerRef<RootStackParamList>()

/** Home, with the way into a restore and, for a flow that is not one, into creation's
 *  terms. */
const HomeStub = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  return (
    <>
      <Pressable
        testID="open-restore"
        onPress={() => navigation.navigate("selfCustodialRestoreMethod")}
      >
        <Text>home</Text>
      </Pressable>
      <Pressable
        testID="open-creation-terms"
        onPress={() =>
          navigation.navigate("acceptTermsAndConditions", { flow: "selfCustodial" })
        }
      >
        <Text>create</Text>
      </Pressable>
    </>
  )
}

const WalletCreationStub = () => <Text>creating</Text>

/** Where the phrase is given: the real request behind it, which checks the phrase,
 *  holds it and opens the terms. */
const PhraseStub = () => {
  const { requestRestore } = useRestoreWallet()
  return (
    <>
      <Pressable testID="request-a" onPress={() => requestRestore("phrase a")}>
        <Text>phrase a</Text>
      </Pressable>
      <Pressable testID="request-b" onPress={() => requestRestore("phrase b")}>
        <Text>phrase b</Text>
      </Pressable>
    </>
  )
}

const OutageStub = () => {
  const navigation = useNavigation()
  return (
    <Pressable testID="try-again-later" onPress={() => navigation.goBack()}>
      <Text>outage</Text>
    </Pressable>
  )
}

const renderStack = async () => {
  render(
    <ThemeProvider theme={theme}>
      <TypesafeI18n locale="en">
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Primary" component={HomeStub} />
            <Stack.Screen name="selfCustodialRestoreMethod" component={PhraseStub} />
            <Stack.Screen
              name="acceptTermsAndConditions"
              component={AcceptTermsAndConditionsScreen}
            />
            <Stack.Screen
              name="selfCustodialBackupSuccess"
              component={BackupSuccessScreen}
            />
            <Stack.Screen
              name="selfCustodialOperatorUnreachable"
              component={OutageStub}
            />
            <Stack.Screen
              name="selfCustodialWalletCreation"
              component={WalletCreationStub}
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

const pressHardwareBack = async () => {
  await act(async () => {
    ;[...hardwareBackHandlers].reverse().some((handler) => handler())
  })
}

const pressAccept = () =>
  press(screen.getByText(LL.AcceptTermsAndConditionsScreen.accept()))

const isAcceptBusy = (): boolean =>
  screen.UNSAFE_getByType(GaloyPrimaryButton).props.disabled === true

/** From home to the terms, with `testID`'s phrase held. */
const openTermsWith = async (testID: string) => {
  await press(screen.getByTestId("open-restore"))
  await press(screen.getByTestId(testID))
  expect(currentRoute()).toBe("acceptTermsAndConditions")
}

describe("the restore's terms in a stack", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    hardwareBackHandlers.length = 0
    mockAccountCount = 0
    mockSelfCustodialRestoreWallet.mockResolvedValue({
      serverMode: null,
      isServerModeKnown: true,
    })
  })

  /** The restore lock is the app's, so a restore a test left running is settled before
   *  the next test, which would find the lock still held. */
  let settleLeftRestore: ((err: unknown) => void) | null = null
  afterEach(async () => {
    await act(async () => {
      settleLeftRestore?.(new Error("test over"))
    })
    settleLeftRestore = null
    jest.useRealTimers()
  })

  /** The splash clears the terms only with its reset to Primary, which leaving the
   *  splash used to cancel, landing the user on terms still busy for a restore that had
   *  landed, the account already active and no way on to home. */
  describe("a back from the success splash", () => {
    it("goes home", async () => {
      await renderStack()
      await openTermsWith("request-a")
      await pressAccept()
      expect(currentRoute()).toBe("selfCustodialBackupSuccess")

      await pressHardwareBack()

      expect(currentRoute()).toBe("Primary")
      expect(stackRouteNames()).toEqual(["Primary"])
    })

    it("lets the held phrase go with the terms", async () => {
      await renderStack()
      await openTermsWith("request-a")
      await pressAccept()

      await pressHardwareBack()

      expect(readPendingRestore()).toBeNull()
    })

    it("leaves the terms idle under the splash", async () => {
      await renderStack()
      await openTermsWith("request-a")
      await pressAccept()
      expect(currentRoute()).toBe("selfCustodialBackupSuccess")

      expect(isAcceptBusy()).toBe(false)
    })
  })

  /** The terms hold the user's back only so long: past the hold a restore that has not
   *  answered can be left, and a new terms screen opened. That screen must show the
   *  restore still running, and be free once it answers, never an Accept that does
   *  nothing for the rest of the session. */
  describe("a restore left running past the hold", () => {
    /** Restore A started, held, and left once the hold ran out: back on the restore
     *  method with A still running. */
    const leaveRestoreAPastTheHold = async () => {
      let failA: (err: unknown) => void = () => {}
      mockSelfCustodialRestoreWallet.mockImplementationOnce(
        () =>
          new Promise<Restored>((_resolve, reject) => {
            failA = reject
            settleLeftRestore = reject
          }),
      )
      jest.useFakeTimers({ doNotFake: ["setImmediate"] })
      await renderStack()
      await openTermsWith("request-a")
      await pressAccept()
      expect(isAcceptBusy()).toBe(true)

      // Still held: the back is refused while the restore runs.
      await pressHardwareBack()
      expect(currentRoute()).toBe("acceptTermsAndConditions")

      await act(async () => {
        jest.advanceTimersByTime(CODE_CHECK_HOLD_MS)
      })
      await pressHardwareBack()
      expect(currentRoute()).toBe("selfCustodialRestoreMethod")
      return { failA }
    }

    const leaveRestoreARunning = async () => {
      const { failA } = await leaveRestoreAPastTheHold()
      await press(screen.getByTestId("request-b"))
      expect(currentRoute()).toBe("acceptTermsAndConditions")
      return { failA }
    }

    it("shows on the new terms as running", async () => {
      await leaveRestoreARunning()

      expect(isAcceptBusy()).toBe(true)
    })

    /** A tap that lands before the busy button is drawn, which the disabled button
     *  would otherwise refuse. */
    it("starts no second restore from them", async () => {
      await leaveRestoreARunning()

      await act(async () => {
        await screen.UNSAFE_getByType(GaloyPrimaryButton).props.onPress()
      })

      expect(mockSelfCustodialRestoreWallet).toHaveBeenCalledTimes(1)
    })

    it("frees the new terms once it answers, for the phrase they hold", async () => {
      const { failA } = await leaveRestoreARunning()

      await act(async () => {
        failA(new RestoreConnectTimeoutError())
      })
      expect(currentRoute()).toBe("selfCustodialOperatorUnreachable")
      await press(screen.getByTestId("try-again-later"))
      expect(currentRoute()).toBe("acceptTermsAndConditions")
      expect(isAcceptBusy()).toBe(false)

      await pressAccept()

      expect(mockSelfCustodialRestoreWallet).toHaveBeenCalledTimes(2)
      expect(mockSelfCustodialRestoreWallet).toHaveBeenLastCalledWith(
        expect.objectContaining({ mnemonic: "phrase b" }),
      )
      expect(currentRoute()).toBe("selfCustodialBackupSuccess")
    })

    /** The running restore is the restore's terms' business only: creation's terms,
     *  opened while it runs, take Accept and the way back as their own. */
    it("leaves the terms of another flow free", async () => {
      await leaveRestoreAPastTheHold()
      await pressHardwareBack()
      expect(currentRoute()).toBe("Primary")

      await press(screen.getByTestId("open-creation-terms"))
      expect(currentRoute()).toBe("acceptTermsAndConditions")
      expect(isAcceptBusy()).toBe(false)

      await pressHardwareBack()
      expect(currentRoute()).toBe("Primary")

      await press(screen.getByTestId("open-creation-terms"))
      await pressAccept()
      expect(currentRoute()).toBe("selfCustodialWalletCreation")
    })
  })
})
