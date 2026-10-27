import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"

import { useRemoteConfig } from "@app/config/feature-flags-context"
import { useSettingsScreenQuery } from "@app/graphql/generated"
import { useIsAuthed } from "@app/graphql/is-authed-context"
import { useLevel } from "@app/graphql/level-context"
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import {
  TwoFactorEnforcementRecord,
  TwoFactorMethod,
  TwoFactorPrompt,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"
import { AccountType } from "@app/types/wallet"
import {
  logTwoFactorPromptDismissed,
  logTwoFactorPromptShown,
} from "@app/utils/analytics"
import { reportError } from "@app/utils/error-logging"
import { loadJsonOrThrow, saveJson } from "@app/utils/storage"

import {
  DEFAULT_TWO_FACTOR_ENFORCEMENT,
  hasTwoFactor,
  normalizeStoredRecord,
  resolveBalanceTier,
  resolveMissingMethod,
} from "../two-factor-enforcement"

const STORAGE_KEY_PREFIX = "twoFactorEnforcement"

const storageKeyFor = (accountId: string): string => `${STORAGE_KEY_PREFIX}:${accountId}`

type StoredState = {
  accountId: string | null
  record: TwoFactorEnforcementRecord
}

const INITIAL_STORED: StoredState = {
  accountId: null,
  record: DEFAULT_TWO_FACTOR_ENFORCEMENT,
}

type RecordUpdate = (record: TwoFactorEnforcementRecord) => TwoFactorEnforcementRecord

/** The prompts reported as shown this session, by prompt and tier, for the account
 *  they were shown to. */
type ShownPrompts = {
  accountId: string | null
  impressions: Set<string>
}

export type TwoFactorEnforcementState = {
  tier: TwoFactorTier
  hasTwoFactor: boolean
  missingMethod: TwoFactorMethod
  /** An address the account holds but never verified. It cannot be registered again as
   *  new, so the setup has to send it through re-verification instead. */
  unverifiedEmail: string | null
  shouldShowNudgeCard: boolean
  shouldShowSettingsBanner: boolean
  /** Reports a prompt as shown, once per session for each tier it is shown at: a
   *  surface mounts again on every visit, and that is no new impression. */
  markPromptShown: (prompt: TwoFactorPrompt) => void
  dismissNudgeCard: () => void
}

const INERT_STATE: TwoFactorEnforcementState = {
  tier: TwoFactorTier.None,
  hasTwoFactor: false,
  missingMethod: TwoFactorMethod.Email,
  unverifiedEmail: null,
  shouldShowNudgeCard: false,
  shouldShowSettingsBanner: false,
  markPromptShown: () => {},
  dismissNudgeCard: () => {},
}

const TwoFactorEnforcementContext = createContext<TwoFactorEnforcementState>(INERT_STATE)

export const useTwoFactorEnforcement = (): TwoFactorEnforcementState =>
  useContext(TwoFactorEnforcementContext)

/**
 * Decides which two-factor prompts the active custodial account gets from its balance,
 * once for every surface that shows one, so a dismissal on the home is already known
 * to the settings. The tier only ever rises and is remembered per account outside the
 * persistent state, which a logout resets: a dismissal must survive logging back in.
 * The stored record is keyed to the account it was read for, so switching accounts
 * never shows one account's prompts from the other's record.
 */
export const TwoFactorEnforcementProvider: React.FC<React.PropsWithChildren> = ({
  children,
}) => {
  const isAuthed = useIsAuthed()
  const { isAtLeastLevelOne } = useLevel()
  const { activeAccount } = useAccountRegistry()
  const { custodialTwoFactorEnforcementEnabled } = useRemoteConfig()
  const [stored, setStored] = useState<StoredState>(INITIAL_STORED)
  /** The record as last written, so two writes in the same pass build on each other:
   *  a dismissal and a tier raise that land together must both survive. */
  const latestStoredRef = useRef<StoredState>(INITIAL_STORED)
  const shownPromptsRef = useRef<ShownPrompts>({
    accountId: null,
    impressions: new Set(),
  })

  /** The account's registered type rather than the wallet state, so the answer holds
   *  steady through the self-custodial cold-start window while the SDK connects. */
  const isSelfCustodialAccount = activeAccount?.type === AccountType.SelfCustodial
  /** A trial account adds no factor: the settings offer it no login methods, and it
   *  upgrades through the phone login instead, so it is not prompted. */
  const isEnabled =
    custodialTwoFactorEnforcementEnabled &&
    isAuthed &&
    isAtLeastLevelOne &&
    !isSelfCustodialAccount

  const { data } = useSettingsScreenQuery({
    skip: !isEnabled,
    fetchPolicy: "cache-first",
    nextFetchPolicy: "cache-and-network",
  })
  /** Read through the gate, not only the skip: a skipped query may still hand back the
   *  answer it last had, and that answer belongs to a session this one must not act on. */
  const me = isEnabled ? data?.me : undefined
  const accountId = me?.defaultAccount.id ?? null

  const commitStored = useCallback((next: StoredState) => {
    latestStoredRef.current = next
    setStored(next)
  }, [])

  useEffect(() => {
    if (!accountId) {
      commitStored(INITIAL_STORED)
      return
    }
    let isMounted = true
    /** A record that could not be read is not a missing one: with the account left
     *  unloaded, nothing is prompted and nothing is written, so a transient read
     *  failure cannot replace a dismissal or a reached tier with the defaults. The
     *  prompts stay off for that launch; the next one reads the record again. */
    loadJsonOrThrow(storageKeyFor(accountId))
      .then((raw) => {
        if (isMounted) commitStored({ accountId, record: normalizeStoredRecord(raw) })
      })
      .catch((err) => {
        if (isMounted) reportError("Two-factor enforcement read", err)
      })
    return () => {
      isMounted = false
    }
  }, [accountId, commitStored])

  /** Writes through the record, once this account's is loaded; tells whether it did. */
  const persist = useCallback(
    (update: RecordUpdate): boolean => {
      const latest = latestStoredRef.current
      if (!accountId || latest.accountId !== accountId) return false
      const record = update(latest.record)
      commitStored({ accountId, record })
      saveJson(storageKeyFor(accountId), record).catch((err) =>
        reportError("Two-factor enforcement write", err),
      )
      return true
    },
    [accountId, commitStored],
  )

  const isLoadedForAccount = accountId !== null && stored.accountId === accountId
  /** Only this account's record counts: while the next account's is still being read,
   *  the previous one's tier must not leak into the context or the events. */
  const record = isLoadedForAccount ? stored.record : DEFAULT_TWO_FACTOR_ENFORCEMENT
  const balanceTier = resolveBalanceTier(me?.defaultAccount.wallets)
  const tier = balanceTier > record.highestTier ? balanceTier : record.highestTier

  useEffect(() => {
    if (!isLoadedForAccount || balanceTier <= record.highestTier) return
    persist((current) => ({ ...current, highestTier: balanceTier }))
  }, [isLoadedForAccount, balanceTier, record.highestTier, persist])

  const emailAddress = me?.email?.address ?? null
  const isEmailVerified = Boolean(me?.email?.verified)
  const factors = {
    hasPhone: Boolean(me?.phone),
    hasVerifiedEmail: isEmailVerified,
    hasAuthenticator: Boolean(me?.totpEnabled),
  }
  const isTwoFactorSet = hasTwoFactor(factors)
  const missingMethod = resolveMissingMethod(factors)
  const hasUnverifiedEmail = emailAddress !== null && !isEmailVerified
  const unverifiedEmail = hasUnverifiedEmail ? emailAddress : null

  /** Both prompts ask from the suggested tier on and stop once the account holds two
   *  factors, whatever the tier: the setup they open leads with the authenticator,
   *  which is what the highest tier asks for. The card alone can be waved away. */
  const isEnforced = isEnabled && isLoadedForAccount && !isTwoFactorSet
  const shouldPrompt = isEnforced && tier >= TwoFactorTier.Suggested
  const shouldShowNudgeCard = shouldPrompt && !record.nudgeCardDismissed
  const shouldShowSettingsBanner = shouldPrompt

  /** Another account's impressions start afresh; the same account coming back through
   *  a gate that closed and opened again within the session keeps its own. With the
   *  gate closed there is no account to have shown a prompt to. */
  const markPromptShown = useCallback(
    (prompt: TwoFactorPrompt) => {
      if (!accountId) return
      const isAnotherAccount = shownPromptsRef.current.accountId !== accountId
      if (isAnotherAccount) {
        shownPromptsRef.current = { accountId, impressions: new Set() }
      }
      const { impressions } = shownPromptsRef.current
      const impression = `${prompt}:${tier}`
      if (impressions.has(impression)) return
      impressions.add(impression)
      logTwoFactorPromptShown({ tier, prompt })
    },
    [accountId, tier],
  )

  const dismissNudgeCard = useCallback(() => {
    const isDismissed = persist((current) => ({ ...current, nudgeCardDismissed: true }))
    if (isDismissed)
      logTwoFactorPromptDismissed({ tier, prompt: TwoFactorPrompt.HomeCard })
  }, [tier, persist])

  const contextValue = useMemo(
    () => ({
      tier,
      hasTwoFactor: isTwoFactorSet,
      missingMethod,
      unverifiedEmail,
      shouldShowNudgeCard,
      shouldShowSettingsBanner,
      markPromptShown,
      dismissNudgeCard,
    }),
    [
      tier,
      isTwoFactorSet,
      missingMethod,
      unverifiedEmail,
      shouldShowNudgeCard,
      shouldShowSettingsBanner,
      markPromptShown,
      dismissNudgeCard,
    ],
  )

  return (
    <TwoFactorEnforcementContext.Provider value={contextValue}>
      {children}
    </TwoFactorEnforcementContext.Provider>
  )
}
