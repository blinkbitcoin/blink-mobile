import { useCustodialSecuritySignals } from "@app/custodial/hooks"
import { useHideBalanceQuery } from "@app/graphql/generated"
/** Deep import on purpose: the self-custodial barrel pulls the payment-request
 *  module graph into every consumer, which the score hook doesn't need. */
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

const MEDIUM_LEVEL_COVERAGE = 0.5

/** Shared by both account modes: these protect the device surface, not the account. */
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

/** An empty list scores low, not high: unreachable through useSecurityScore
 *  (device signals always contribute), but computeSecurityScore is exported. */
const levelOf = (done: number, total: number): SecurityScoreLevel => {
  if (total === 0) return "low"
  if (done === total) return "high"
  if (done / total < MEDIUM_LEVEL_COVERAGE) return "low"
  return "medium"
}

export const computeSecurityScore = (
  signals: SecuritySignalDescriptor[],
): SecurityScore => {
  const total = signals.length
  const done = signals.filter((signal) => signal.done).length

  return { signals, done, total, level: levelOf(done, total) }
}

/**
 * Mode-agnostic aggregator: each mode hook returns its contribution or null for
 * "not my mode". Device lock comes in as a parameter because the security screen
 * owns that async keystore state and updates it synchronously on toggle.
 */
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
