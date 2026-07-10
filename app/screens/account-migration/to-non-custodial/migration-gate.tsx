import React, { useCallback, useState } from "react"

import { useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"

import { DollarBalanceMigrationModal } from "@app/components/dollar-balance-migration-modal"
import { useWalletOverviewScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { getUsdWallet } from "@app/graphql/wallets-utils"
import { useCustodialMigrationRequired } from "@app/hooks/use-custodial-migration-required"
import { useDollarBalanceRestricted } from "@app/hooks/use-dollar-balance-restricted"
import { useTransferBlocked } from "@app/hooks/use-transfer-blocked"
import { RootStackParamList } from "@app/navigation/stack-param-lists"

import { useActiveApiKeys, useWindDownStatus } from "../hooks"
import { WindDownStatus } from "../utils/backend-mock"

import { MigrationApiServiceScreen } from "./api-service-screen"
import { MigrationRequiredScreen } from "./migration-required-screen"

type MigrationGateProps = {
  onClose?: () => void
}

/**
 * Entry gate for the migration flow, the single choke point for both entry points
 * (Settings and the forced root blocker). Order of checks: a custodial Dollar Balance
 * blocks entry first (the user empties it manually; post-gate this does not apply since
 * the flow itself converts dollars), then accounts with active API keys see the
 * API-service warning, and finally the "Time to upgrade" screen.
 *
 * The mode is inferred from the entry: a forced-cohort account reaches the gate as
 * the root blocker (migration required), while the voluntary route from Settings is
 * not. The wind-down status (mocked until the backend query ships) already drives the
 * dollar-precondition exception; selecting the post-deadline "gate" mode from it is
 * wired separately.
 */
export const MigrationGate: React.FC<MigrationGateProps> = ({ onClose }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>()
  const { hasActiveApiKeys, loading: apiKeysLoading } = useActiveApiKeys()
  const isForced = useCustodialMigrationRequired()
  const { status: windDownStatus } = useWindDownStatus()
  const isTransferBlocked = useTransferBlocked()
  const isDollarBalanceRestricted = useDollarBalanceRestricted()
  const [apiWarningAcknowledged, setApiWarningAcknowledged] = useState(false)

  const isAuthed = useIsAuthed()
  const { data, loading: walletsLoading } = useWalletOverviewScreenQuery({
    skip: !isAuthed,
  })

  const acknowledgeApiWarning = useCallback(() => setApiWarningAcknowledged(true), [])

  const exitFlow = useCallback(() => {
    if (onClose) {
      onClose()
      return
    }
    navigation.goBack()
  }, [onClose, navigation])

  const goToDollarTransfer = useCallback(() => {
    navigation.navigate("conversionDetails")
  }, [navigation])

  if (apiKeysLoading || walletsLoading) return null

  const usdBalance = getUsdWallet(data?.me?.defaultAccount?.wallets)?.balance ?? 0
  const hasCustodialDollarBalance = usdBalance > 0
  const isGated = windDownStatus === WindDownStatus.GatedClosed
  /** Post-gate the user enters WITH dollars and the flow converts them at the final
   *  step, so the empty-your-dollars precondition only guards the pre-deadline paths.
   *  TODO: the backend re-enforces this precondition on migrationStart; this modal is
   *  the UX half of the check. */
  const shouldBlockOnDollarBalance = hasCustodialDollarBalance && !isGated
  if (shouldBlockOnDollarBalance) {
    /** The conversion screen bounces blocked or dollar-restricted regions back home, so
     *  the Transfer variant only shows when the user can actually reach it; restricted
     *  regions empty their dollars through the home's forced convert modal instead. */
    const canTransferInApp = !isTransferBlocked && !isDollarBalanceRestricted
    const transferAction = canTransferInApp ? goToDollarTransfer : undefined
    return (
      <DollarBalanceMigrationModal
        isVisible={true}
        toggleModal={exitFlow}
        onTransfer={transferAction}
      />
    )
  }

  const shouldWarnAboutApiKeys = hasActiveApiKeys && !apiWarningAcknowledged
  if (shouldWarnAboutApiKeys) {
    /** Same close rules as the "Time to upgrade" screen: closable until the gate arms. */
    const apiCloseAction = isGated ? undefined : exitFlow
    return (
      <MigrationApiServiceScreen
        onContinue={acknowledgeApiWarning}
        onClose={apiCloseAction}
      />
    )
  }

  const mode = isForced ? "forcedPreDeadline" : "voluntary"
  return <MigrationRequiredScreen mode={mode} onClose={onClose} />
}
