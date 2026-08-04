import { useCustodialSecuritySignals } from "@app/custodial/hooks/use-security-signals"
import { useHideBalanceQuery } from "@app/graphql/generated"
import { useSelfCustodialSecuritySignals } from "@app/self-custodial/hooks/use-security-signals"
import type {
  SecurityScore,
  SecurityScoreLevel,
  SecuritySignalDescriptor,
} from "@app/types/security-score"

type DeviceLockState = {
  isBiometricsEnabled: boolean
  isPinEnabled: boolean
}

// Shared by both account modes: these protect the device surface, not the account.
export const deviceSecuritySignals = (
  deviceLock: DeviceLockState,
  isHideBalanceEnabled: boolean,
): SecuritySignalDescriptor[] => [
  {
    key: "appLock",
    done: deviceLock.isBiometricsEnabled || deviceLock.isPinEnabled,
    retriggerable: false,
  },
  { key: "hideBalance", done: isHideBalanceEnabled, retriggerable: false },
]

export const computeSecurityScore = (
  signals: SecuritySignalDescriptor[],
): SecurityScore => {
  const done = signals.filter((signal) => signal.done).length
  const ratio = done / signals.length
  const level: SecurityScoreLevel = ratio === 1 ? "high" : ratio < 0.5 ? "low" : "medium"

  return { signals, done, total: signals.length, level }
}

// Mode-agnostic aggregator: each mode hook returns its contribution or null for
// "not my mode". Device lock comes in as a parameter because the security screen
// owns that async keystore state and updates it synchronously on toggle.
export const useSecurityScore = (deviceLock: DeviceLockState): SecurityScore | null => {
  const selfCustodial = useSelfCustodialSecuritySignals()
  const custodial = useCustodialSecuritySignals()
  const { data: { hideBalance } = { hideBalance: false } } = useHideBalanceQuery()

  const modeSignals = selfCustodial ?? custodial
  if (!modeSignals) return null

  return computeSecurityScore([
    ...modeSignals,
    ...deviceSecuritySignals(deviceLock, hideBalance),
  ])
}
