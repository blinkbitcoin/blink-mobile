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
import { useAccountRegistry } from "@app/hooks/use-account-registry"
import {
  TwoFactorEnforcementRecord,
  TwoFactorMethod,
  TwoFactorTier,
} from "@app/types/two-factor-enforcement"
import { AccountType } from "@app/types/wallet"
import { reportError } from "@app/utils/error-logging"
import { loadJson, saveJson } from "@app/utils/storage"

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

export type TwoFactorEnforcementState = {
  tier: TwoFactorTier
  hasTwoFactor: boolean
  missingMethod: TwoFactorMethod
  /** An address the account holds but never verified. It cannot be registered again as
   *  new, so the setup has to send it through re-verification instead. */
  unverifiedEmail: string | null
  shouldShowNudgeCard: boolean
  shouldShowSettingsBanner: boolean
  dismissNudgeCard: () => void
}

const INERT_STATE: TwoFactorEnforcementState = {
  tier: TwoFactorTier.None,
  hasTwoFactor: false,
  missingMethod: TwoFactorMethod.Email,
  unverifiedEmail: null,
  shouldShowNudgeCard: false,
  shouldShowSettingsBanner: false,
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
  const { activeAccount } = useAccountRegistry()
  const { custodialTwoFactorEnforcementEnabled } = useRemoteConfig()
  const [stored, setStored] = useState<StoredState>(INITIAL_STORED)
  /** The record as last written, so two writes in the same pass build on each other:
   *  a dismissal and a tier raise that land together must both survive. */
  const latestStoredRef = useRef<StoredState>(INITIAL_STORED)

  /** The account's registered type rather than the wallet state, so the answer holds
   *  steady through the self-custodial cold-start window while the SDK connects. */
  const isSelfCustodialAccount = activeAccount?.type === AccountType.SelfCustodial
  const isEnabled =
    custodialTwoFactorEnforcementEnabled && isAuthed && !isSelfCustodialAccount

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
    loadJson(storageKeyFor(accountId)).then((raw) => {
      if (isMounted) commitStored({ accountId, record: normalizeStoredRecord(raw) })
    })
    return () => {
      isMounted = false
    }
  }, [accountId, commitStored])

  const persist = useCallback(
    (update: RecordUpdate) => {
      const latest = latestStoredRef.current
      if (!accountId || latest.accountId !== accountId) return
      const record = update(latest.record)
      commitStored({ accountId, record })
      saveJson(storageKeyFor(accountId), record).catch((err) =>
        reportError("Two-factor enforcement write", err),
      )
    },
    [accountId, commitStored],
  )

  const isLoadedForAccount = accountId !== null && stored.accountId === accountId
  const balanceTier = resolveBalanceTier(me?.defaultAccount.wallets)
  const tier =
    balanceTier > stored.record.highestTier ? balanceTier : stored.record.highestTier

  useEffect(() => {
    if (!isLoadedForAccount || balanceTier <= stored.record.highestTier) return
    persist((record) => ({ ...record, highestTier: balanceTier }))
  }, [isLoadedForAccount, balanceTier, stored.record, persist])

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

  const isEnforced = isEnabled && isLoadedForAccount && !isTwoFactorSet
  const isNudgeCardDismissed = stored.record.nudgeCardDismissed
  const shouldShowNudgeCard =
    isEnforced && tier >= TwoFactorTier.Nudge && !isNudgeCardDismissed
  /** No banner at the authenticator tier: that tier asks for a third factor, which the
   *  banner's setup never offers first. */
  const isBannerTier = tier === TwoFactorTier.Nudge || tier === TwoFactorTier.Required
  const shouldShowSettingsBanner = isEnforced && isBannerTier

  const dismissNudgeCard = useCallback(() => {
    persist((record) => ({ ...record, nudgeCardDismissed: true }))
  }, [persist])

  const contextValue = useMemo(
    () => ({
      tier,
      hasTwoFactor: isTwoFactorSet,
      missingMethod,
      unverifiedEmail,
      shouldShowNudgeCard,
      shouldShowSettingsBanner,
      dismissNudgeCard,
    }),
    [
      tier,
      isTwoFactorSet,
      missingMethod,
      unverifiedEmail,
      shouldShowNudgeCard,
      shouldShowSettingsBanner,
      dismissNudgeCard,
    ],
  )

  return (
    <TwoFactorEnforcementContext.Provider value={contextValue}>
      {children}
    </TwoFactorEnforcementContext.Provider>
  )
}
