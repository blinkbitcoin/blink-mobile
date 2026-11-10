import { useCallback, useState, useSyncExternalStore } from "react"
import { validateMnemonic } from "bip39"
import Crypto from "react-native-quick-crypto"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import { createInFlightGuard, InFlightStatus } from "@app/hooks/use-in-flight-guard"
import { markSelfCustodialInfoBulletinDismissedFor } from "@app/hooks/use-self-custodial-info-bulletin-state"
import { useI18nContext } from "@app/i18n/i18n-react"
import {
  ChooseExperienceContinueRoute,
  RootStackParamList,
} from "@app/navigation/stack-param-lists"
import { logSelfCustodialRestoreCompleted } from "@app/self-custodial/analytics"
import {
  RestoreConnectTimeoutError,
  selfCustodialRestoreWallet,
} from "@app/self-custodial/bridge"
import { useLnurlServer } from "@app/self-custodial/hooks/use-lnurl-server"
import { useSparkNetwork } from "@app/self-custodial/hooks/use-spark-network"
import { measureFor, ScEvent } from "@app/self-custodial/measurement"
import { classifySdkError, SelfCustodialErrorCode } from "@app/self-custodial/sdk-error"
import {
  BackupMethod,
  markBackupCompletedFor,
} from "@app/self-custodial/providers/backup-state"
import { useSelfCustodialWallet } from "@app/self-custodial/providers/wallet"
import {
  findSelfCustodialAccountByMnemonic,
  StorageReadStatus,
} from "@app/self-custodial/storage/account-index"
import { usePersistentStateContext } from "@app/store/persistent-state"
import { withSelfCustodialModeFromServer } from "@app/store/persistent-state/self-custodial-server-account-mode"
import { AccountMode } from "@app/types/account"
import { reportError } from "@app/utils/error-logging"
import { normalizeMnemonic } from "@app/utils/mnemonic"
import { toastShow } from "@app/utils/toast"

import { holdPendingRestore } from "../pending-restore"

const RestoreWalletStatus = {
  Idle: "idle",
  Restoring: "restoring",
  Error: "error",
} as const

type RestoreWalletStatus = (typeof RestoreWalletStatus)[keyof typeof RestoreWalletStatus]

/** One restore at a time across the app, not per screen: the terms screen that started a
 *  restore can be left and a new one opened over the same phrase. Two restores of one
 *  phrase would both miss the account index, which the bridge only writes once the SDK
 *  is up, and provision two accounts for it. */
const restoreGuard = createInFlightGuard()

/** An outage and a wrong phrase are indistinguishable inside the restore's catch, and the
 *  generic "check your phrase" toast sends an outage victim looking for a mistake they did
 *  not make. A connect that never answered is the same outage. */
const isOperatorOutage = (err: unknown): boolean =>
  err instanceof RestoreConnectTimeoutError ||
  classifySdkError(err) === SelfCustodialErrorCode.NetworkError

export const useRestoreWallet = () => {
  const { LL } = useI18nContext()
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { updateState, persistentState } = usePersistentStateContext()
  const { retry: reinitSdk } = useSelfCustodialWallet()
  const { reloadSelfCustodialAccounts } = useAccountRegistry()
  /** What this screen's last restore or request ended in, an error or nothing. */
  const [settledStatus, setSettledStatus] = useState<RestoreWalletStatus>(
    RestoreWalletStatus.Idle,
  )
  /** Restoring is the app's, not this screen's: a screen opened while a restore started
   *  elsewhere is still running shows it busy, rather than an Accept that does nothing. */
  const isRestoreRunning = useSyncExternalStore(
    restoreGuard.subscribe,
    restoreGuard.isRunning,
  )
  const status = isRestoreRunning ? RestoreWalletStatus.Restoring : settledStatus
  const network = useSparkNetwork()
  const lnurlServer = useLnurlServer()
  const { selfCustodialDepositClaimLeewayVbyte } = useRemoteConfig()

  const activateAccount = useCallback(
    (accountId: string) => {
      updateState((prev) => {
        if (!prev) return prev
        return { ...prev, activeAccountId: accountId }
      })
    },
    [updateState],
  )

  /** A restored account takes its mode from the server, never from a fresh question: it
   *  was chosen on a device this one may never have been. */
  const adoptServerMode = useCallback(
    (accountId: string, serverMode: AccountMode | null) => {
      updateState(
        (prev) => prev && withSelfCustodialModeFromServer(prev, accountId, serverMode),
      )
    },
    [updateState],
  )

  /** `method` is where the phrase came from, recorded as the account's backup: a
   *  cloud restore means the seed is already in the cloud, so the emergency
   *  bundle follows it there. A typed phrase leaves the bundle on the device.
   *
   *  Resolves to `AlreadyRunning` when a restore started elsewhere still runs; that one's
   *  answer is the one the user gets. A restore that lands leaves the status Idle, so the
   *  screen it moved on from is not left busy for it, should the user come back there. */
  const restore = useCallback(
    async (
      mnemonic: string,
      method: BackupMethod = BackupMethod.Manual,
    ): Promise<InFlightStatus> => {
      const result = await restoreGuard.attempt(async () => {
        setSettledStatus(RestoreWalletStatus.Idle)

        const normalized = normalizeMnemonic(mnemonic)
        if (!validateMnemonic(normalized)) {
          setSettledStatus(RestoreWalletStatus.Error)
          toastShow({ message: LL.RestoreScreen.invalidMnemonic(), LL })
          return
        }

        try {
          const lookup = await findSelfCustodialAccountByMnemonic(normalized)
          if (lookup.status === StorageReadStatus.ReadFailed) throw lookup.error

          /** Already on this device, so its mode is already stored: re-entering the
           *  phrase is not a new answer about how the account should behave. */
          if (lookup.id) {
            /** A cloud restore proves the seed is in the cloud whether or not the
             *  account was already here, so it is recorded the same way as a new one
             *  and the bundle follows it there. A typed phrase made no new backup. */
            const isCloudRestore = method === BackupMethod.Cloud
            if (isCloudRestore)
              await markBackupCompletedFor(lookup.id, BackupMethod.Cloud)
            await markSelfCustodialInfoBulletinDismissedFor(lookup.id)
            activateAccount(lookup.id)
            reinitSdk()
            /** Re-entering a phrase for an account already on the device is not a new
             *  account; only the restore is measured, against its stored mode. */
            logSelfCustodialRestoreCompleted({
              accountId: lookup.id,
              mode:
                persistentState?.selfCustodialAccountModeByAccountId?.[lookup.id] ?? null,
            })
            navigation.navigate("selfCustodialBackupSuccess")
            return
          }

          const accountId = Crypto.randomUUID()
          const { serverMode, isServerModeKnown } = await selfCustodialRestoreWallet({
            accountId,
            mnemonic: normalized,
            network,
            leewaySatPerVbyte: selfCustodialDepositClaimLeewayVbyte,
            lnurlServer,
          })
          await markBackupCompletedFor(accountId, method)
          /** Written before the account is active so the home screen never flashes the
           *  "this is a non-custodial account" bulletin to someone who just restored it. */
          await markSelfCustodialInfoBulletinDismissedFor(accountId)
          await reloadSelfCustodialAccounts()

          activateAccount(accountId)
          reinitSdk()

          /** The mode a restore measures against is the server's answer; an unanswered
           *  server leaves both events to the mode selection that follows. */
          const restored = { accountId, mode: isServerModeKnown ? serverMode : null }
          logSelfCustodialRestoreCompleted(restored)
          measureFor(restored, ScEvent.AccountCreated, { flow: "restore" })

          /** Only an unanswered server leaves the question open. Assuming a default here
           *  would push it back and overwrite whatever the account really holds. */
          if (!isServerModeKnown) {
            navigation.navigate("selfCustodialChooseExperience", {
              onContinue: {
                route: ChooseExperienceContinueRoute.BackupSuccess,
                accountId,
              },
            })
            return
          }

          adoptServerMode(accountId, serverMode)
          navigation.navigate("selfCustodialBackupSuccess")
        } catch (err) {
          reportError("Wallet restore", err)
          setSettledStatus(RestoreWalletStatus.Error)
          if (isOperatorOutage(err)) {
            navigation.navigate("selfCustodialOperatorUnreachable")
            return
          }
          toastShow({ message: LL.RestoreScreen.restoreFailed(), LL })
          throw err
        }
      })
      return result.status
    },
    [
      activateAccount,
      adoptServerMode,
      reinitSdk,
      reloadSelfCustodialAccounts,
      navigation,
      persistentState,
      LL,
      network,
      selfCustodialDepositClaimLeewayVbyte,
      lnurlServer,
    ],
  )

  /** The terms come last, as they do on creation: the phrase is checked first so a typo
   *  never reaches them, then held in memory until Accept on the terms runs `restore`. */
  const requestRestore = useCallback(
    async (mnemonic: string, method: BackupMethod = BackupMethod.Manual) => {
      const normalized = normalizeMnemonic(mnemonic)
      if (!validateMnemonic(normalized)) {
        setSettledStatus(RestoreWalletStatus.Error)
        toastShow({ message: LL.RestoreScreen.invalidMnemonic(), LL })
        return
      }
      setSettledStatus(RestoreWalletStatus.Idle)
      holdPendingRestore({ mnemonic: normalized, method })
      navigation.navigate("acceptTermsAndConditions", { flow: "selfCustodialRestore" })
    },
    [LL, navigation],
  )

  return { restore, requestRestore, status }
}

export { RestoreWalletStatus }
